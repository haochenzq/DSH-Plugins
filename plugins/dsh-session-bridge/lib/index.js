/**
 * dsh-session-bridge —— 让两个互不相关的 DSH 会话互相发消息。
 *
 * 背景：DSH 原生的 send_message 只在一个 subagent 树内有效，独立会话之间没有通信通道。
 * 本插件在 Host 侧通过带来源的用户消息实现跨会话通信：
 *
 *   session_bridge_peers  列出可对话的会话（id、标题、工作区、状态）
 *   session_bridge_send   给指定会话发一条消息
 *   session_bridge_reply  回复上一条桥消息的来源会话
 *   session_bridge_converse  发起一次持续协作
 *   session_bridge_finish    完成、报告阻塞或停止协作
 *
 * 约束：
 * - 只依赖宿主服务，不 import @deepseek-ai/*（profile 里以裸模块加载）；
 *   工具参数与输出都用标准 JSON Schema。
 * - 消息通过 agent.steer/inject 进入目标收件箱，因此会写进目标 Session 日志，
 *   可在历史里回放；不会伪造工具调用。
 * - 只在同一进程内协调；跨进程/跨实例不做保证。
 */

import { DEFAULTS, RateWindow, formatHops, normalizeConfig, nextHops, renderEnvelope, sameWorkspace, shortId } from './bridge.js'

export const name = 'session-bridge'
export const inject = ['tools', 'agents']

/** 一条消息最多保留的来源记录数，避免长时间运行后内存增长。 */
const INBOUND_LIMIT = 500

/** 会话 id 的最小前缀长度，低于它不当作 id 猜。 */
const MIN_ID_PREFIX = 6

/**
 * 注册会话桥工具。
 * @param {import('@deepseek-ai/cordis').Context} ctx 宿主上下文
 * @param {object} rawConfig patch 层配置
 */
export function apply(ctx, rawConfig = {}) {
  const config = normalizeConfig(rawConfig)
  /** @type {Map<string, {senderId: string, hops: number, collaborationId?: string}>} */
  const inbound = new Map()
  /** @type {Map<string, {id: string, objective: string, participants: string[], hops: number}>} */
  const collaborations = new Map()
  const limiter = new RateWindow(config.maxSendsPerMinute)

  /**
   * 记录一次来源，超过上限时丢弃最旧的一条。
   * @param {string} sessionId 收到消息的会话
   * @param {{senderId: string, hops: number, collaborationId?: string}} entry 来源
   */
  function rememberInbound(sessionId, entry) {
    inbound.delete(sessionId)
    inbound.set(sessionId, entry)
    if (inbound.size > INBOUND_LIMIT) {
      const oldest = inbound.keys().next().value
      if (oldest !== undefined) inbound.delete(oldest)
    }
  }

  /** 读一个会话的标题；没有标题服务或读失败时返回 undefined。 */
  async function titleOf(sessionId, signal) {
    const query = ctx.get('sessionQuery')
    if (query === undefined || typeof query.readTitle !== 'function') return undefined
    try {
      const snapshot = await query.readTitle(sessionId, signal)
      return snapshot?.title
    } catch {
      return undefined
    }
  }

  /** 汇总已存会话：优先用 sessionController.list（含运行状态），退化为 sessionQuery 或在线 Agent。 */
  async function collectSessions(signal) {
    const controller = ctx.get('sessionController')
    if (controller !== undefined && typeof controller.list === 'function') {
      try {
        const value = await controller.list({}, signal)
        if (Array.isArray(value?.items)) {
          return value.items.map(row => ({
            id: String(row.sessionId),
            cwd: row.cwd,
            origin: row.origin,
            running: row.running === true,
            agentAvailable: row.agentAvailable === true,
            updatedAt: Number(row.updatedAt) || 0,
          }))
        }
      } catch {
        // 退到下面的只读路径；列表接口不可用不该让工具整体失败。
      }
    }
    const query = ctx.get('sessionQuery')
    if (query !== undefined && typeof query.listSessions === 'function') {
      try {
        const records = await query.listSessions(signal)
        return records.map(record => ({
          id: record.header.id,
          cwd: record.header.cwd,
          origin: record.header.origin,
          running: ctx.agents.get(record.header.id)?.status === 'running',
          agentAvailable: ctx.agents.get(record.header.id) !== undefined,
          updatedAt: 0,
        }))
      } catch {
        // 继续退化。
      }
    }
    return ctx.agents.list().map(agent => ({
      id: agent.id,
      cwd: agent.session?.header?.cwd,
      origin: agent.session?.header?.origin,
      running: agent.status === 'running',
      agentAvailable: true,
      updatedAt: 0,
    }))
  }

  /** 能否作为对话目标：不是在线的自己、不是 subagent 会话、记录过工作目录。 */
  function targetable(row, callerId) {
    if (row.id === callerId) return false
    if (row.origin === 'subagent') return false
    return typeof row.cwd === 'string' && row.cwd.length > 0
  }

  /**
   * 在可对话会话里解析用户给出的目标：完整 id、唯一 id 前缀、或唯一标题。
   * @returns {Promise<{id: string, title?: string, cwd?: string}>}
   */
  async function resolveTarget(callerId, raw, signal) {
    const text = String(raw ?? '').trim()
    if (text.length === 0) throw new Error('session_bridge: 需要给出目标会话（session_bridge_peers 返回的 id 或标题）')
    const rows = (await collectSessions(signal)).filter(row => targetable(row, callerId))
    const exact = rows.find(row => row.id === text)
    if (exact !== undefined) return { id: exact.id, cwd: exact.cwd }
    if (text.length >= MIN_ID_PREFIX) {
      const prefixed = rows.filter(row => row.id.startsWith(text.toLowerCase()))
      if (prefixed.length === 1) return { id: prefixed[0].id, cwd: prefixed[0].cwd }
      if (prefixed.length > 1) {
        const options = prefixed.slice(0, 5).map(row => shortId(row.id)).join(', ')
        throw new Error(`session_bridge: 前缀 "${text}" 命中多个会话（${options}）；请给出更长的 id`)
      }
    }
    const normalized = text.toLowerCase()
    const titled = []
    for (const row of rows) {
      const title = await titleOf(row.id, signal)
      if (title !== undefined && title.trim().toLowerCase() === normalized) titled.push(row.id)
    }
    if (titled.length === 1) return { id: titled[0], cwd: rows.find(row => row.id === titled[0])?.cwd }
    if (titled.length > 1) {
      throw new Error(`session_bridge: 标题 "${text}" 命中多个会话；请改用 id`)
    }
    throw new Error(`session_bridge: 找不到会话 "${text}"；先调用 session_bridge_peers 查看可用目标`)
  }

  /** 取目标的在线 Agent；必要时按配置恢复冷会话。 */
  async function targetAgent(sessionId) {
    const live = ctx.agents.get(sessionId)
    if (live !== undefined) return live
    if (!config.allowColdSessions) {
      throw new Error(`session_bridge: 会话 ${shortId(sessionId)} 当前没有打开；在界面中打开它，或把 allowColdSessions 设为 true`)
    }
    const controller = ctx.get('sessionController')
    if (controller === undefined || typeof controller.resolveAgent !== 'function') {
      throw new Error(`session_bridge: 会话 ${shortId(sessionId)} 当前没有打开，且本 profile 没有 sessionController 可以恢复它`)
    }
    const result = await controller.resolveAgent(sessionId)
    if (result?.agent !== undefined) return result.agent
    const detail = result?.error?.message ?? '未知错误'
    throw new Error(`session_bridge: 无法打开会话 ${shortId(sessionId)}：${detail}`)
  }

  /** 校验发送者与目标在允许的范围内。 */
  function assertScope(caller, targetSession, targetId) {
    const callerCwd = caller.session?.header?.cwd
    const targetCwd = targetSession?.header?.cwd
    const same = sameWorkspace(callerCwd, targetCwd)
    if (config.requireSameWorkspace && !same) {
      throw new Error(`session_bridge: 两个会话不在同一工作区（${callerCwd ?? '未记录'} 与 ${targetCwd ?? '未记录'}）；`
        + '跨工作区通信需要把 requireSameWorkspace 设为 false')
    }
    if (targetId === caller.id) throw new Error('session_bridge: 不能给自己发消息')
    return same
  }

  function messageBody(text) {
    const body = String(text ?? '').trim()
    if (body.length === 0) throw new Error('session_bridge: 消息正文不能为空')
    if (body.length > config.maxMessageChars) {
      throw new Error(`session_bridge: 消息超过 ${config.maxMessageChars} 字，请分段发送`)
    }
    return body
  }

  function activeCollaboration(callerId, id) {
    if (id !== undefined) {
      const collaboration = collaborations.get(id)
      if (collaboration?.participants.includes(callerId)) return collaboration
      throw new Error('session_bridge: 此会话没有该活动协作，或协作已结束')
    }
    const matches = [...collaborations.values()].filter(item => item.participants.includes(callerId))
    if (matches.length === 1) return matches[0]
    if (matches.length === 0) throw new Error('session_bridge: 此会话没有活动协作')
    throw new Error('session_bridge: 此会话有多项活动协作，请指定 collaborationId')
  }

  function discardPending(collaboration) {
    for (const id of collaboration.participants) {
      const inbox = ctx.agents.get(id)?.inbox
      for (const message of [...(inbox?.nextStep ?? []), ...(inbox?.nextTurn ?? [])]) {
        if (message.source?.kind === 'session-bridge' && message.source.collaborationId === collaboration.id) {
          inbox.remove(message.id)
        }
      }
    }
  }

  async function deliver(caller, targetId, text, signal, { collaboration, status = 'active' } = {}) {
    const body = messageBody(text)
    const target = await targetAgent(targetId)
    const same = assertScope(caller, target.session, targetId)
    const senderTitle = await titleOf(caller.id, signal)
    const targetTitle = await titleOf(targetId, signal)
    if (collaboration !== undefined && status === 'active') activeCollaboration(caller.id, collaboration.id)
    signal?.throwIfAborted()
    const maxHops = collaboration === undefined ? config.maxHops : 0
    const last = inbound.get(caller.id)
    const hops = collaboration === undefined
      ? nextHops(last?.collaborationId === undefined ? last : undefined, targetId)
      : collaboration.hops + Number(status === 'active')
    if (maxHops > 0 && hops > maxHops) {
      throw new Error(`session_bridge: 这段对话已到 ${config.maxHops} 跳上限，停止自动往返，把决定权交回用户`)
    }
    if (collaboration === undefined) limiter.hit(caller.id)
    const envelope = renderEnvelope({
      senderId: caller.id,
      senderTitle,
      hops,
      maxHops,
      text: body,
      collaboration: collaboration === undefined ? undefined : { id: collaboration.id, objective: collaboration.objective, status },
    })
    const message = {
      id: globalThis.crypto.randomUUID(),
      role: 'user',
      content: [{ type: 'text', text: envelope }],
      source: {
        kind: 'session-bridge',
        senderSessionId: caller.id,
        senderTitle: senderTitle ?? null,
        hops,
        maxHops,
        ...(collaboration === undefined ? {} : { collaborationId: collaboration.id, collaborationStatus: status }),
      },
    }
    if (config.wakeTarget && status !== 'stopped') target.steer(message)
    else target.inject(message)
    if (status === 'active') {
      if (collaboration !== undefined) collaboration.hops = hops
      rememberInbound(targetId, { senderId: caller.id, hops, collaborationId: collaboration?.id })
    }
    ctx.logger?.info?.(`session-bridge: ${shortId(caller.id)} -> ${shortId(targetId)} hop ${formatHops(hops, maxHops)}`)
    return {
      delivered: true,
      sessionId: targetId,
      shortId: shortId(targetId),
      ...(targetTitle === undefined ? {} : { title: targetTitle }),
      hops,
      maxHops,
      sameWorkspace: same,
      ...(collaboration === undefined ? {} : { collaborationId: collaboration.id }),
    }
  }

  const deliverySchema = {
    type: 'object',
    properties: {
      delivered: { type: 'boolean' },
      sessionId: { type: 'string' },
      shortId: { type: 'string' },
      title: { type: 'string' },
      hops: { type: 'integer' },
      maxHops: { type: 'integer' },
      sameWorkspace: { type: 'boolean' },
      collaborationId: { type: 'string' },
    },
    required: ['delivered', 'sessionId', 'shortId', 'hops', 'maxHops', 'sameWorkspace'],
  }

  function deliveryOutput(action) {
    return {
      schema: deliverySchema,
      render: (_args, value) => [{
        type: 'text',
        text: `${action}会话 ${value.shortId}${value.title ? `（${value.title}）` : ''}`
          + `${value.sameWorkspace ? '' : '（跨工作区）'}，跳数 ${formatHops(value.hops, value.maxHops)}`
          + (value.collaborationId === undefined ? '' : `，协作 ID ${value.collaborationId}`),
      }],
    }
  }

  // ---------------------------------------------------------------------------
  // 工具
  // ---------------------------------------------------------------------------

  ctx.tools.register({
    name: 'session_bridge_peers',
    description:
      '列出可以和当前会话对话的其他 DSH 会话（独立的对话窗口，不是 subagent）。'
      + '返回每个会话的 id、标题、工作目录和状态；用 send 工具向其中一个发消息。'
      + '每行用 sameWorkspace 标出是否同一工作区。',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '可选：按标题、id 或目录过滤。' },
        limit: { type: 'integer', description: `可选：返回条数，默认 ${DEFAULTS.peerLimit}。` },
      },
      required: [],
    },
    output: {
      schema: {
        type: 'object',
        properties: {
          items: { type: 'array' },
          total: { type: 'integer' },
          returned: { type: 'integer' },
        },
        required: ['items', 'total', 'returned'],
      },
      render: (_args, value) => [{
        type: 'text',
        text: value.returned === 0
          ? '没有可对话的会话'
          : [
              `可对话会话 ${value.returned} 个（共 ${value.total} 个候选）`,
              ...value.items.map(({ id, title, cwd, status, sameWorkspace }) =>
                JSON.stringify({ id, title, cwd, status, sameWorkspace })),
            ].join('\n'),
      }],
    },
    async execute(args, exec) {
      const caller = exec.agent
      if (caller === undefined) throw new Error('session_bridge_peers 需要一个调用方会话')
      const limit = Math.min(50, Math.max(1, Math.trunc(Number(args?.limit ?? config.peerLimit)) || config.peerLimit))
      const needle = String(args?.query ?? '').trim().toLowerCase()
      const callerCwd = caller.session?.header?.cwd
      const rows = (await collectSessions(exec.signal))
        .filter(row => targetable(row, caller.id))
        .sort((left, right) => (Number(right.agentAvailable) - Number(left.agentAvailable))
          || (right.updatedAt - left.updatedAt))
      // 只给可能入选的前若干行读标题，避免一次调用把所有冷会话日志都读一遍。
      const items = []
      for (const row of rows.slice(0, limit * 3)) {
        const title = await titleOf(row.id, exec.signal)
        const haystack = `${row.id}\n${title ?? ''}\n${row.cwd ?? ''}`.toLowerCase()
        if (needle.length > 0 && !haystack.includes(needle)) continue
        items.push({
          id: row.id,
          shortId: shortId(row.id),
          title: title ?? null,
          cwd: row.cwd ?? null,
          status: row.running ? 'running' : row.agentAvailable ? 'idle' : 'closed',
          sameWorkspace: sameWorkspace(callerCwd, row.cwd),
          updatedAt: row.updatedAt,
        })
        if (items.length >= limit) break
      }
      return { items, total: rows.length, returned: items.length }
    },
    presentCall: () => ({ card: 'generic', title: 'Session peers', kind: 'other' }),
  })

  ctx.tools.register({
    name: 'session_bridge_send',
    description:
      '把一条消息发给另一个独立的 DSH 会话（不是 subagent，也不是当前会话）。'
      + '默认插话到对方当前轮的下一步，空闲时唤醒它开始一轮。'
      + '发送单条消息用本工具。发起一次持续协作用 session_bridge_converse。',
    parameters: {
      type: 'object',
      properties: {
        session: {
          type: 'string',
          description: '目标会话：session_bridge_peers 返回的完整 id、唯一 id 前缀，或唯一标题。',
        },
        message: {
          type: 'string',
          description: '要投递的正文。说明你想让对方做什么；对方的正文原样送达。',
        },
      },
      required: ['session', 'message'],
    },
    output: deliveryOutput('已发送到'),
    async execute(args, exec) {
      const caller = exec.agent
      if (caller === undefined) throw new Error('session_bridge_send 需要一个调用方会话')
      const target = await resolveTarget(caller.id, args?.session, exec.signal)
      return deliver(caller, target.id, args?.message, exec.signal)
    },
    presentCall: args => ({ card: 'generic', title: 'Bridge message', kind: 'other', rawInput: args?.message ?? '' }),
  })

  ctx.tools.register({
    name: 'session_bridge_reply',
    description:
      '回复收到的桥消息。持续协作消息请带消息头中的 collaborationId，投递到该协作的另一方。'
      + '普通桥消息可回复最近来源，或显式指定会话。协作已结束时停止回复。',
    parameters: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: '回复正文。',
        },
        session: {
          type: 'string',
          description: '普通桥消息可选的目标会话 id 或标题。',
        },
        collaborationId: {
          type: 'string',
          description: '协作消息头中的 collaboration.id。',
        },
      },
      required: ['message'],
    },
    output: deliveryOutput('已回复'),
    async execute(args, exec) {
      const caller = exec.agent
      if (caller === undefined) throw new Error('session_bridge_reply 需要一个调用方会话')
      const last = inbound.get(caller.id)
      const explicitSession = typeof args?.session === 'string' && args.session.trim().length > 0
      const target = explicitSession ? await resolveTarget(caller.id, args.session, exec.signal) : undefined
      const collaborationId = args?.collaborationId
        ?? (target === undefined || target.id === last?.senderId ? last?.collaborationId : undefined)
      if (collaborationId !== undefined) {
        const collaboration = activeCollaboration(caller.id, collaborationId)
        const peer = collaboration.participants.find(id => id !== caller.id)
        if (target !== undefined && target.id !== peer) throw new Error('session_bridge: 目标会话不是该协作的另一方')
        return deliver(caller, peer, args?.message, exec.signal, { collaboration })
      }
      const targetId = target?.id ?? last?.senderId
      if (targetId === undefined) {
        throw new Error('session_bridge_reply: 本会话没有待回复的桥消息，可用 session_bridge_send 指定会话')
      }
      return deliver(caller, targetId, args?.message, exec.signal)
    },
    presentCall: args => ({ card: 'generic', title: 'Bridge reply', kind: 'other', rawInput: args?.message ?? '' }),
  })

  ctx.tools.register({
    name: 'session_bridge_converse',
    description:
      '按用户指定的目标会话与任务发起持续协作。双方自主推进，完成、需要用户介入或用户叫停时结束。'
      + '在收到现有协作的消息时用 session_bridge_reply 或 session_bridge_finish 继续该协作。',
    parameters: {
      type: 'object',
      properties: {
        target: { type: 'string', description: '目标会话的完整 id、唯一 id 前缀或唯一标题。' },
        objective: { type: 'string', description: '用户授权的目标、分工、范围及验收条件。' },
      },
      required: ['target', 'objective'],
    },
    output: deliveryOutput('已开始与'),
    async execute(args, exec) {
      const caller = exec.agent
      if (caller === undefined) throw new Error('session_bridge_converse 需要一个调用方会话')
      const objective = messageBody(args?.objective)
      const target = await resolveTarget(caller.id, args?.target, exec.signal)
      const id = globalThis.crypto.randomUUID()
      const collaboration = { id, objective, participants: [caller.id, target.id], hops: 0 }
      collaborations.set(id, collaboration)
      try {
        return await deliver(caller, target.id, objective, exec.signal, { collaboration })
      } catch (error) {
        collaborations.delete(id)
        throw error
      }
    },
    presentCall: args => ({ card: 'generic', title: 'Start session collaboration', kind: 'other', rawInput: args?.objective ?? '' }),
  })

  ctx.tools.register({
    name: 'session_bridge_finish',
    description:
      '结束当前持续协作。目标达成选 done，遇到需要用户处理的权限、边界或阻塞选 blocked，用户叫停选 stopped。'
      + '给出结果或需要用户处理的事项。结束后停止发送该协作的消息。',
    parameters: {
      type: 'object',
      properties: {
        collaborationId: { type: 'string', description: '协作 ID。当前会话只有一项协作时可省略。' },
        status: { type: 'string', enum: ['done', 'blocked', 'stopped'] },
        summary: { type: 'string', description: '完成结果或具体阻塞。用户叫停时可省略。' },
      },
      required: ['status'],
    },
    output: {
      schema: {
        type: 'object',
        properties: {
          collaborationId: { type: 'string' },
          status: { type: 'string' },
          summary: { type: 'string' },
          notified: { type: 'boolean' },
        },
        required: ['collaborationId', 'status', 'summary', 'notified'],
      },
      render: (_args, value) => [{
        type: 'text',
        text: `协作 ${value.collaborationId} 已结束（${value.status}）\n${value.summary}`
          + (value.notified ? '' : '\n对方当前未收到结束通知。'),
      }],
    },
    async execute(args, exec) {
      const caller = exec.agent
      if (caller === undefined) throw new Error('session_bridge_finish 需要一个调用方会话')
      const status = args?.status
      if (!['done', 'blocked', 'stopped'].includes(status)) throw new Error('session_bridge_finish: 状态必须是 done、blocked 或 stopped')
      const summary = messageBody(args?.summary ?? (status === 'stopped' ? '用户已叫停这次协作。' : ''))
      const collaboration = activeCollaboration(caller.id, args?.collaborationId)
      const peer = collaboration.participants.find(id => id !== caller.id)
      collaborations.delete(collaboration.id)
      discardPending(collaboration)
      const result = { collaborationId: collaboration.id, status, summary, notified: false }
      if (status === 'stopped' && ctx.agents.get(peer) === undefined) return result
      try {
        await deliver(caller, peer, summary, exec.signal, { collaboration, status })
        result.notified = true
      } catch (error) {
        ctx.logger?.warn?.('session-bridge: could not notify peer of collaboration end: %s', error.message)
      }
      return result
    },
    presentCall: args => ({ card: 'generic', title: 'Finish session collaboration', kind: 'other', rawInput: args?.summary ?? '' }),
  })

  ctx.effect(() => () => {
    limiter.clear()
    inbound.clear()
    collaborations.clear()
  })
}
