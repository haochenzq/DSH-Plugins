/**
 * dsh-light-memory —— 轻量、纯本地的记忆插件。
 *
 * 设计约束（对应需求）：
 * - 完全本地：只用 node: 内置模块与本地 JSON 文件，不联网、不调用模型。
 * - 轻量：无第三方依赖，无向量/嵌入，检索是确定性的字面匹配。
 * - 不导入宿主包：插件在 profile 里以裸模块加载，直接向 ctx.tools 注册工具定义，
 *   参数与输出都用标准 JSON Schema，因此不需要 @deepseek-ai/* 的解析能力。
 *
 * 工具：
 *   memory_save   写入/更新一条记忆
 *   memory_search 按字面匹配检索
 *   memory_list   按时间列出最近的记忆
 *   memory_forget 按 id 或唯一前缀删除
 */

import {
  MAX_SEARCH_LIMIT,
  injectableRecords,
  normalizeTags,
  normalizeText,
  readDoc,
  removeRecord,
  resolveStorePath,
  searchRecords,
  summarize,
  upsertRecord,
  writeDoc,
} from './store.js'
import { registerRoutes } from './routes.js'

export const name = 'light-memory'
export const inject = ['tools', 'connection', 'systemPrompt']

/** 自动注入的预算：最多条数、每条截断长度、整段总字符上限。 */
const INJECT_MAX_COUNT = 30
const INJECT_LINE_CHARS = 160
const INJECT_MAX_CHARS = 3000

/** 一次记忆操作的互斥队列：同一文件上的读改写串行执行，避免并发覆盖。 */
let queue = Promise.resolve()

/**
 * 串行执行一个存储任务。
 * @template T
 * @param {() => Promise<T>} task 任务
 * @returns {Promise<T>}
 */
function serialized(task) {
  const run = queue.then(task, task)
  // 队列本身不能因为某个任务失败而中断。
  queue = run.then(() => undefined, () => undefined)
  return run
}

/** 把记录投影成模型可读的纯数据。 */
function view(record) {
  return {
    id: record.id,
    text: record.text,
    tags: record.tags ?? [],
    inject: record.inject === true,
    updatedAt: record.updatedAt,
  }
}

/**
 * 渲染注入系统提示的那一段。没有标记为"自动注入"的记忆时返回空串，
 * 宿主会因此不渲染该段，不占上下文。
 * @param {object[]} records 需要注入的记忆
 * @returns {string}
 */
function renderInjection(records) {
  if (records.length === 0) return ''
  const head = '以下是用户明确标记为「自动注入」的长期记忆，来自本地记忆库。'
    + '把它们当作背景事实；与当前任务冲突时以当前对话为准。'
  const body = []
  let used = head.length
  for (const record of records) {
    const text = record.text.length > INJECT_LINE_CHARS ? `${record.text.slice(0, INJECT_LINE_CHARS)}…` : record.text
    const line = `- ${text}`
    if (used + line.length > INJECT_MAX_CHARS) break
    used += line.length
    body.push(line)
  }
  return body.length === 0 ? '' : `${head}\n${body.join('\n')}`
}

/** 纯文本渲染：一行一条，便于模型与人同时阅读。 */
function lines(header, records) {
  if (records.length === 0) return [{ type: 'text', text: `${header}\n（无匹配记忆）` }]
  const body = records.map((record, index) => `${index + 1}. ${summarize(record)}`).join('\n')
  return [{ type: 'text', text: `${header}\n${body}` }]
}

const TEXT = { type: 'string', description: '要记住的内容，一句话一条，避免塞入整段日志。' }
const TAGS = { type: 'array', items: { type: 'string' }, description: '可选标签，用于后续过滤，例如 ["部署","约定"]。' }
const LIMIT = { type: 'integer', description: `返回条数，1-${MAX_SEARCH_LIMIT}，默认 5。` }

/**
 * 插件入口。
 * @param {object} ctx 宿主上下文，需要 ctx.tools / ctx.connection / ctx.systemPrompt
 * @param {{dir?: string, searchLimit?: number}} config 插件配置
 */
export function apply(ctx, config = {}) {
  const file = resolveStorePath(config.dir)
  const defaultLimit = clampLimit(config.searchLimit)

  /** 自动注入的缓存：每次写盘后刷新，供系统提示段同步读取。 */
  let injectCache = []

  /** 重新读取需要注入的记忆。 */
  const refreshInjection = async () => {
    try {
      injectCache = injectableRecords(await readDoc(file), INJECT_MAX_COUNT)
    } catch {
      injectCache = []
    }
  }

  // 插件挂载时先加载一次，确保第一个会话就能看到已标记的记忆。
  void refreshInjection()

  // 把「自动注入」的记忆作为一段系统提示。text 是同步函数，读缓存。
  ctx.systemPrompt.section({
    name: 'light-memory:injected',
    order: ctx.systemPrompt.getSectionOrder?.('FILE_REFERENCE') ?? 1000,
    interpolate: false,
    text: () => renderInjection(injectCache),
  })

  // 「个性化」设置页的数据接口：全局 AGENTS.md 读写 + 记忆库 CRUD。
  registerRoutes(ctx, { file, limit: defaultLimit, onChange: () => void refreshInjection() })

  /**
   * 读改写一条：载入文档、执行变更、写回。
   * @param {(doc: object, now: string) => object} mutate 变更函数，返回工具结果
   */
  const mutate = mutate_ => serialized(async () => {
    const now = new Date().toISOString()
    const doc = await readDoc(file)
    const before = JSON.stringify(doc)
    const result = mutate_(doc, now)
    if (JSON.stringify(doc) !== before) {
      await writeDoc(file, doc)
      // 模型通过工具改了记忆，注入段也要跟着变。
      await refreshInjection()
    }
    return result
  })

  ctx.tools.register({
    name: 'memory_save',
    description:
      '把一条值得跨会话保留的事实、偏好或决定写入本地记忆库（纯本地 JSON 文件，不联网）。'
      + '记忆是全局的：任何工作区、任何会话都能检索到同一条。'
      + '正文完全相同的记录会被视为同一条并只更新时间，不会重复堆积。',
    parameters: {
      type: 'object',
      properties: { text: TEXT, tags: TAGS },
      required: ['text'],
    },
    output: {
      schema: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          created: { type: 'boolean' },
          text: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } },
          total: { type: 'integer' },
          trimmed: { type: 'integer' },
        },
        required: ['id', 'created', 'text', 'tags', 'total', 'trimmed'],
      },
      render: (_args, value) => [{
        type: 'text',
        text: value.created
          ? `已记住（${value.id.slice(0, 8)}）：${value.text}`
          : `已更新已有记忆（${value.id.slice(0, 8)}）：${value.text}`,
      }],
    },
    execute: async args => {
      const text = normalizeText(args?.text)
      const tags = normalizeTags(args?.tags)
      return mutate((doc, now) => {
        const { record, created, trimmed } = upsertRecord(doc, { text, tags }, now)
        return {
          id: record.id,
          created,
          text: record.text,
          tags: record.tags ?? [],
          total: doc.records.length,
          trimmed,
        }
      })
    },
    presentCall: args => ({ card: 'generic', title: 'Save memory', kind: 'other', rawInput: args?.text ?? '' }),
  })

  ctx.tools.register({
    name: 'memory_search',
    description:
      '在本地记忆库里做字面检索：正文字符串包含 + 词元命中 + 标签匹配，按分数与更新时间排序。'
      + '记忆全局共享，不区分工作区。不做语义检索、不调用模型。query 留空表示按更新时间倒序列出。',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '检索词；可留空。' },
        tags: { ...TAGS, description: '只返回带这些标签（或标签包含该词）的记忆。' },
        limit: LIMIT,
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
      render: (args, value) => lines(
        `检索 ${JSON.stringify(args?.query ?? '')}：命中 ${value.total} 条，返回 ${value.returned} 条`,
        value.items,
      ),
    },
    execute: async args => serialized(async () => {
      const doc = await readDoc(file)
      const { items, total, limit } = searchRecords(doc, {
        query: args?.query,
        tags: args?.tags,
        limit: args?.limit ?? defaultLimit,
      })
      return { items: items.map(view), total, returned: items.length, limit }
    }),
    presentCall: args => ({ card: 'generic', title: 'Search memory', kind: 'other', rawInput: args?.query ?? '' }),
  })

  ctx.tools.register({
    name: 'memory_list',
    description: '按最近更新时间列出本地记忆，用于人工核对记忆库里到底有什么。',
    parameters: {
      type: 'object',
      properties: { limit: LIMIT },
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
      render: (_args, value) => lines(`最近 ${value.returned} 条记忆（共 ${value.total} 条）`, value.items),
    },
    execute: async args => serialized(async () => {
      const doc = await readDoc(file)
      const limit = clampLimit(args?.limit ?? defaultLimit)
      const sorted = [...doc.records].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
      const items = sorted.slice(0, limit).map(view)
      return { items, total: doc.records.length, returned: items.length }
    }),
    presentCall: () => ({ card: 'generic', title: 'List memories', kind: 'other' }),
  })

  ctx.tools.register({
    name: 'memory_forget',
    description: '按完整 id 或唯一前缀删除一条本地记忆。前缀命中多条时拒绝执行，避免误删。',
    parameters: {
      type: 'object',
      properties: { id: { type: 'string', description: '记忆 id 或唯一前缀。' } },
      required: ['id'],
    },
    output: {
      schema: {
        type: 'object',
        properties: {
          removed: { type: 'boolean' },
          id: { type: 'string' },
          text: { type: 'string' },
          remaining: { type: 'integer' },
        },
        required: ['removed', 'id', 'text', 'remaining'],
      },
      render: (_args, value) => [{
        type: 'text',
        text: `已删除（${value.id.slice(0, 8)}）：${value.text}；剩余 ${value.remaining} 条`,
      }],
    },
    execute: async args => mutate((doc) => {
      const outcome = removeRecord(doc, args?.id)
      if (outcome.error !== undefined) throw new Error(`memory_forget: ${outcome.error}`)
      return {
        removed: true,
        id: outcome.removed.id,
        text: outcome.removed.text,
        remaining: doc.records.length,
      }
    }),
    presentCall: args => ({ card: 'generic', title: 'Forget memory', kind: 'other', rawInput: args?.id ?? '' }),
  })
}

/** 约束 limit 到 1..MAX_SEARCH_LIMIT。 */
function clampLimit(raw) {
  const value = Number(raw)
  if (!Number.isFinite(value)) return 5
  return Math.min(MAX_SEARCH_LIMIT, Math.max(1, Math.trunc(value)))
}

/** 便于手工排查：暴露解析出的存储路径。 */
export { resolveStorePath }
