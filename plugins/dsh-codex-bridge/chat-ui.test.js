import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'

function loadChatUI() {
  let definition, renderer
  const ctx = {
    uiConversation: { events: { register(value) { definition = value } } },
    slots: { inject(_name, install) { install() }, register(_slot, component) { renderer = component } },
  }
  const loader = { load({ id, factory }) {
    assert.equal(id, '@local/dsh-codex-bridge')
    factory(() => ({ createElement: (...args) => args })).apply(ctx)
  } }
  vm.runInNewContext(readFileSync(new URL('./chat-ui.js', import.meta.url), 'utf8'), { window: { __ModuleLoader__: loader } })
  return { definition, renderer }
}

// Durable history records keep the complete tool arguments as a JSON string; tool/call
// carries no surfaceOp, while tool/result is an appended surface event whose text is the
// current live-received receipt or the real tool error.
function toolCall(seq, callId, message, { name = 'reply_to_codex', extra } = {}) {
  return {
    type: 'tool/call', seq, time: 1795364800000 + seq,
    data: { turn: 1, step: seq, callId, name, arguments: JSON.stringify({ message, ...extra }) },
  }
}

function toolResult(seq, callId, text, { isError = false, error } = {}) {
  return {
    type: 'tool/result', seq, time: 1795364800000 + seq, sourceEventSeqs: [seq - 1], surfaceOp: 'append',
    data: {
      turn: 1, step: seq - 1,
      ...(error ? { error } : {}),
      message: {
        role: 'tool', source: { kind: 'tool', callId }, toolCallId: callId,
        content: [{ type: 'text', text }], isError, id: 'result-' + seq,
      },
    },
  }
}

function liveReceipt(seq, callId) {
  return toolResult(seq, callId, JSON.stringify({
    status: 'live-received', turnId: '00000000-0000-4000-8000-000000000011', messageId: 'message-' + seq,
  }))
}

function ptcDispatch(seq, subCallId, message, text, { isError = false } = {}) {
  return {
    type: 'tool/ptc-dispatch', seq, time: 1795364800000 + seq,
    data: {
      parentCallId: 'root', subCallId, name: 'reply_to_codex', arguments: { message },
      content: [{ type: 'text', text }], isError,
    },
  }
}

// Minimal replay of the Conversation assembler: a Context starts at its earliest loaded
// start Match, later Matches update it, and a refresh replays the complete window.
function replay(definition, events) {
  const contexts = new Map()
  for (const event of events) {
    const match = definition.match(event)
    if (match === null) continue
    const existing = contexts.get(match.id)
    if (existing === undefined) {
      if (match.role !== 'start') continue
      const start = { event, role: 'start', location: { kind: 'unresolved' } }
      const context = {
        key: 'context:' + match.id, kind: definition.kind, id: match.id,
        matches: [start], start, state: undefined,
      }
      context.state = definition.start(context, start, { previous: () => undefined })
      contexts.set(match.id, context)
      continue
    }
    const update = { event, role: match.role, location: { kind: 'unresolved' } }
    existing.matches.push(update)
    existing.state = definition.update(existing, update)
  }
  return [...contexts.values()].flatMap(context => {
    const node = definition.buildViewNode(context)
    return node === null ? [] : [node]
  }).sort((left, right) => left.anchorSeq - right.anchorSeq)
}

test('current record: reply_to_codex keeps the verbatim text and the live-received status', () => {
  const { definition, renderer } = loadChatUI()
  const message = '第一行\n    缩进四空格\n\t制表符\n\n最后一行\n'
  const call = toolCall(33, 'call_1', message)
  const result = liveReceipt(34, 'call_1')

  assert.equal(definition.match(call).id, 'call_1')
  assert.equal(definition.match(call).role, 'start')
  assert.equal(definition.match(result).id, 'call_1')
  assert.equal(definition.match(result).role, 'update')

  const pending = replay(definition, [call])
  assert.equal(pending.length, 1)
  assert.equal(pending[0].data.status, '等待回执')
  assert.equal(pending[0].data.message, message)

  const nodes = replay(definition, [call, result])
  assert.equal(nodes.length, 1)
  const [node] = nodes
  assert.deepEqual(Object.keys(node.data), ['message', 'status'])
  assert.equal(node.data.message, message)
  assert.equal(node.data.status, 'Codex 已接收')
  assert.equal(node.anchorSeq, 33)
  assert.equal(node.groupTree, 'input')
  assert.equal(node.visibility, 'visible')
  const rendered = renderer({ node })
  assert.equal(rendered[2][2], 'DSH → Codex')
  assert.equal(rendered[3][2], 'Codex 已接收')
  assert.equal(rendered[5][2], message)
  assert.equal(rendered[6], null)
  assert.equal(JSON.stringify(rendered).includes('附件'), false)

  // Inbound Codex text stays an ordinary DSH user message; other tools are no longer ours.
  assert.equal(definition.match({ type: 'user/message', surfaceOp: 'append', seq: 30, data: { content: '【Codex】正文', source: { kind: 'user', rpcId: 'codex-bridge:abc' } } }), null)
  for (const name of ['send_to_codex', 'send_text_to_codex', 'send_to_active_codex']) {
    assert.equal(definition.match(toolCall(40, 'other', '正文', { name })), null)
  }
  const withAttachment = replay(definition, [
    toolCall(50, 'call_2', '只保留正文', { extra: { attachmentId: 'sha256:' + 'a'.repeat(64) } }),
  ])
  assert.deepEqual(Object.keys(withAttachment[0].data), ['message', 'status'])
  assert.equal(withAttachment[0].data.message, '只保留正文')
  assert.equal(definition.buildViewNode({}), null)
})

test('consecutive messages render one row each, including nested dispatches', () => {
  const { definition, renderer } = loadChatUI()
  const first = '第一条\n第二行'
  const second = '第二条\n    ' + '长正文'.repeat(1200)
  const third = '第三条 嵌套'
  const events = [
    toolCall(40, 'c1', first), liveReceipt(41, 'c1'),
    toolCall(60, 'c2', second), liveReceipt(61, 'c2'),
    ptcDispatch(80, 'c3', third, JSON.stringify({ status: 'live-received', turnId: '01a2', messageId: 'm3' })),
  ]
  const nodes = replay(definition, events)
  assert.deepEqual(nodes.map(node => node.id), ['c1', 'c2', 'c3'])
  assert.deepEqual(nodes.map(node => node.data.message), [first, second, third])
  assert.deepEqual(nodes.map(node => node.data.status), ['Codex 已接收', 'Codex 已接收', 'Codex 已接收'])
  assert.deepEqual(nodes.map(node => node.anchorSeq), [40, 60, 80])
  assert.equal(new Set(nodes.map(node => node.id)).size, 3)
  for (const node of nodes) assert.equal(renderer({ node })[5][2], node.data.message)
})

test('failed sends keep the verbatim text and the real reason, and never claim success', () => {
  const { definition, renderer } = loadChatUI()
  const failedText = '发送失败的正文\n    缩进行 DSHCHAT-FAIL'
  const failed = replay(definition, [
    toolCall(70, 'c6', failedText),
    toolResult(71, 'c6', 'Error: thread 00000000-0000-4000-8000-000000000022 already has an active writer', { isError: true }),
  ])
  assert.equal(failed.length, 1)
  assert.equal(failed[0].data.message, failedText)
  assert.equal(failed[0].data.status, '发送失败')
  assert.equal(failed[0].data.reason, 'thread 00000000-0000-4000-8000-000000000022 already has an active writer')
  const rendered = renderer({ node: failed[0] })
  assert.equal(rendered[5][2], failedText)
  assert.equal(rendered[6][2], '原因：thread 00000000-0000-4000-8000-000000000022 already has an active writer')

  const nestedFailure = replay(definition, [
    ptcDispatch(90, 'c7', '嵌套失败正文', 'Error: 目标 Codex 会话不可用', { isError: true }),
  ])
  assert.equal(nestedFailure[0].data.status, '发送失败')
  assert.equal(nestedFailure[0].data.reason, '目标 Codex 会话不可用')
  assert.equal(nestedFailure[0].data.message, '嵌套失败正文')

  const staleReceipt = replay(definition, [
    toolCall(100, 'c8', '旧回执正文'),
    toolResult(101, 'c8', JSON.stringify({ status: 'sent', turnId: '01a3', messageId: 'm8' })),
  ])
  assert.equal(staleReceipt[0].data.message, '旧回执正文')
  assert.equal(staleReceipt[0].data.status, '回执未确认')
})

test('refresh replays the whole window without duplicates, loss or old rows', () => {
  const { definition } = loadChatUI()
  const inbound = { type: 'user/message', surfaceOp: 'append', seq: 10, data: { content: '【Codex】入站正文\n第二行', source: { kind: 'user', rpcId: 'codex-bridge:abc' } } }
  const events = [
    inbound,
    toolCall(20, 'c1', '刷新后仍在\n    缩进'), liveReceipt(21, 'c1'),
    toolCall(30, 'c2', '刷新后失败'), toolResult(31, 'c2', 'Error: 未配对', { isError: true }),
    toolCall(40, 'legacy', '旧工具记录', { name: 'send_to_codex' }),
    toolResult(41, 'legacy', JSON.stringify({ status: 'sent', turnId: '01a4', messageId: 'm9' })),
  ]
  const first = replay(definition, events)
  assert.equal(first.length, 2)
  assert.deepEqual(first.map(node => node.id), ['c1', 'c2'])
  assert.deepEqual(first.map(node => node.data.status), ['Codex 已接收', '发送失败'])
  assert.equal(first[0].data.message, '刷新后仍在\n    缩进')
  assert.equal(first[1].data.reason, '未配对')
  assert.deepEqual(replay(definition, events), first)
})

test('inline notice distinguishes undelivered and uncertain; never duplicates on replay', () => {
  const { definition, renderer } = loadChatUI()
  const noLink = toolResult(11, 'no', 'Error: 当前通话未连接，请在目标 Codex 主聊天重新配对。', { isError: true })
  const unknown = toolResult(21, 'unknown', 'Error: The receiver claimed this message but did not confirm writing the output.', { isError: true })
  const events = [
    toolCall(10, 'no', '重连测试'), noLink, noLink,
    toolCall(20, 'unknown', '回执测试'), unknown,
    toolCall(30, 'ok', '成功测试'), liveReceipt(31, 'ok'),
    toolCall(40, 'pending', '等待测试'),
    toolCall(50, 'empty', '空回执测试'), toolResult(51, 'empty', ''),
  ]
  const nodes = replay(definition, events)
  assert.deepEqual(nodes.map(n => n.data.status), ['发送失败', '回执未确认', 'Codex 已接收', '等待回执', '回执未确认'])
  assert.match(nodes[0].data.notice, /重新接通后，再手动发送/)
  assert.match(nodes[1].data.notice, /先核对原会话，不要重发/)
  assert.equal(nodes[2].data.notice, undefined)
  assert.equal(nodes[3].data.notice, undefined)
  assert.match(nodes[4].data.notice, /不要重发/)
  assert.equal(JSON.stringify(renderer({ node: nodes[0] })).split(nodes[0].data.notice).length, 2)
  assert.deepEqual(replay(definition, events), nodes)
  const recovered = replay(definition, [toolCall(20, 'unknown', '回执测试'), unknown, liveReceipt(22, 'unknown')])[0]
  assert.equal(recovered.data.notice, undefined)
  assert.equal(recovered.data.reason, undefined)
})
