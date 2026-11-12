import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { createDirectChat, sendCodexMessage } from './direct-chat.js'
import { deliverToDesktopOwner } from './codex-desktop.js'
import { withCodexService } from './codex-service.js'
import { bridgeError } from './protocol.js'
import { dispatch } from './index.js'

function routeDirectory(t) {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-codex-routes-'))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  return directory
}

function input(rpcId, text) {
  return { type: 'user/message', surfaceOp: 'append', data: {
    source: { kind: 'user', rpcId }, content: [{ type: 'text', text }],
  } }
}

function chatTools(directory, sent, findAttachment) {
  const tools = new Map()
  const chat = createDirectChat({ tools: { register(value) { tools.set(value.name, value) } } },
    directory, async (target, message, attachment) => {
      sent.push({ target, message, ...(attachment === undefined ? {} : { attachment }) })
      return { status: 'sent' }
    }, findAttachment)
  return { tools, chat }
}

function testSession(id, events) {
  return { id, get seq() { return events.length }, snapshotEvents: (from, to) => events.slice(from, to) }
}

test('direct delivery resumes only an unloaded chat and submits exactly once', async () => {
  for (const status of ['idle', 'active', 'notLoaded']) {
    const target = randomUUID()
    const turnId = randomUUID()
    const calls = []
    const connect = (_cli, run) => run(async (method, params) => {
      assert.equal(params.threadId, target)
      calls.push([method, params])
      if (method === 'thread/read') return { thread: { status: { type: status } } }
      if (method === 'turn/start') return { turn: { id: turnId } }
    })
    const receipt = await sendCodexMessage(target, 'Test message', undefined, connect, async () => null)
    assert.deepEqual(calls.map(([method]) => method), status === 'notLoaded'
      ? ['thread/read', 'thread/resume', 'turn/start'] : ['thread/read', 'turn/start'])
    assert.deepEqual(calls.at(-1)[1].input, [{ type: 'text', text: '【DSH】Test message', text_elements: [] }])
    assert.deepEqual(receipt, { messageId: calls.at(-1)[1].clientUserMessageId, turnId, status: 'sent' })
  }
})

test('a desktop-owned thread never goes through the managed service', async () => {
  const target = randomUUID()
  const turnId = randomUUID()
  const receipt = await sendCodexMessage(target, 'Desktop reply', undefined, () => assert.fail(), async request => {
    assert.equal(request.threadId, target)
    assert.equal(request.input[0].text, '【DSH】Desktop reply')
    return { turn: { id: turnId } }
  })
  assert.equal(receipt.turnId, turnId)
  await assert.rejects(sendCodexMessage(target, 'Unknown delivery', undefined, () => assert.fail(), async () => {
    throw bridgeError('codex-delivery-unknown', 'Desktop receipt missing')
  }), { code: 'codex-delivery-unknown' })
})

test('desktop delivery steers an active turn without starting a provisional turn', async () => {
  const request = { threadId: randomUUID(), clientUserMessageId: randomUUID(),
    input: [{ type: 'text', text: '【DSH】Follow-up', text_elements: [] }] }
  const turnId = randomUUID()
  let calls = 0
  const result = await deliverToDesktopOwner(request, 'owner', async (method, version, params, target) => {
    calls++
    assert.equal(method, 'thread-follower-steer-turn')
    assert.equal(version, 1)
    assert.equal(target, 'owner')
    assert.equal(params.conversationId, request.threadId)
    assert.equal(params.clientUserMessageId, request.clientUserMessageId)
    assert.equal(params.restoreMessage.id, request.clientUserMessageId)
    assert.equal(params.input, request.input)
    return { resultType: 'success', handledByClientId: 'owner', result: { result: { turnId } } }
  }, () => assert.fail('unexpected delivery failure'))
  assert.deepEqual(result, { turn: { id: turnId } })
  assert.equal(calls, 1)
})

test('desktop delivery opens a turn only after a definite inactive-turn rejection', async () => {
  const request = { threadId: randomUUID(), clientUserMessageId: randomUUID(), input: [] }
  const turn = { id: randomUUID() }
  const calls = []
  const failure = () => bridgeError('codex-delivery-unknown', 'Delivery could not be confirmed')
  const result = await deliverToDesktopOwner(request, 'owner', async (method, version, params, target) => {
    calls.push(method)
    if (method === 'thread-follower-steer-turn') return { resultType: 'error',
      error: `Cannot steer conversation ${request.threadId} because its active turn already ended` }
    assert.equal(target, 'owner')
    assert.equal(params.turnStart.request, request)
    return { resultType: 'success', handledByClientId: 'owner', result: { result: { turn } } }
  }, failure)
  assert.deepEqual(result, { turn })
  assert.deepEqual(calls, ['thread-follower-steer-turn', 'thread-follower-start-turn'])

  for (const response of [{ resultType: 'error', error: 'timeout' }, { resultType: 'success', handledByClientId: 'owner' }]) {
    await assert.rejects(deliverToDesktopOwner(request, 'owner', async method => {
      assert.equal(method, 'thread-follower-steer-turn')
      return response
    }, failure), { code: 'codex-delivery-unknown' })
  }
})

test('a writer conflict before submission rechecks ownership without submitting to the managed service', async () => {
  const target = randomUUID()
  const turnId = randomUUID()
  const calls = []
  const desktop = async () => {
    calls.push('desktop')
    return calls.length === 1 ? null : { turn: { id: turnId } }
  }
  const connect = (_cli, run) => run(async method => {
    calls.push(method)
    if (method === 'thread/read') return { thread: { status: { type: 'notLoaded' } } }
    throw bridgeError('codex-request-rejected', 'thread already has an active writer')
  })
  const receipt = await sendCodexMessage(target, 'Follow the owner', undefined, connect, desktop)
  assert.equal(receipt.turnId, turnId)
  assert.deepEqual(calls, ['desktop', 'thread/read', 'thread/resume', 'desktop'])
})

test('messages use the exact destination selected by the human or the originating Codex chat', async t => {
  const directory = routeDirectory(t)
  const sent = []
  const { tools, chat } = chatTools(directory, sent)
  const from = randomUUID()
  const selected = randomUUID()
  const sessionId = 'session-dsh'
  const requestId = randomUUID()
  const request = { op: 'send', sessionId, codexThreadId: from, requestId, text: 'Send a reply.' }
  const prompt = await chat.submit(request, payload => dispatch(payload, (method, args) => {
    assert.equal(method, 'prompt')
    return args.request
  }))
  assert.equal(prompt.content[0].text, '【Codex】Send a reply.')
  assert.equal(prompt.sessionId, sessionId)
  assert.equal(prompt.mode, 'steer')
  let events = [{ type: 'turn/start', seq: 1 }, input(prompt.requestId, '')]
  const session = { id: sessionId, get seq() { return events.length }, snapshotEvents: (from, to) => events.slice(from, to) }
  const send = (message, target, to = session) => tools.get('send_to_codex').execute({ message, target }, { agent: { session: to } })
  const textReply = tools.get('reply_to_codex')
  const reply = (message, to = session) => textReply.execute({ message }, { agent: { session: to } })
  assert.deepEqual(Object.keys(textReply.parameters.properties), ['message'])
  await assert.rejects(send('Wrong target', selected), { code: 'codex-target-not-authorized' })
  await assert.rejects(send('Wrong DSH chat', from, { ...session, id: 'session-other' }), { code: 'codex-target-not-authorized' })
  await reply('Direct reply.')
  await send('Direct reply.', '')
  await assert.rejects(reply('Wrong DSH chat', { ...session, id: 'session-other' }), { code: 'codex-target-not-authorized' })
  events.push(input('human-other', '请联系 Codex 线程：codex://threads/' + selected + '，发消息说已完成。'))
  await assert.rejects(reply('Ambiguous target'), { code: 'codex-target-not-authorized' })
  await assert.rejects(send('Ambiguous blank target', ' '), { code: 'codex-target-not-authorized' })
  events = [{ type: 'turn/start', seq: 12 }, input('human', '请联系 Codex 线程：codex://threads/' + selected + '，发消息说已完成。')]
  await send('已完成。')
  await assert.rejects(send('Old target', from), { code: 'codex-target-not-authorized' })
  events.push({ type: 'turn/end', seq: 15 })
  await assert.rejects(send('Expired turn', selected), { code: 'codex-target-not-authorized' })
  await assert.rejects(reply('Expired turn'), { code: 'codex-target-not-authorized' })
  events.push({ type: 'turn/start', seq: 16 }, input('human-later', '请把下一步发给 Codex。'))
  await reply('下一步。')
  assert.deepEqual(sent, [{ target: from, message: 'Direct reply.' }, { target: selected, message: '已完成。' },
    { target: selected, message: '下一步。' }])
})

test('an accepted Codex message pairs text and attachments with only the selected DSH session', async t => {
  const directory = routeDirectory(t)
  const first = randomUUID()
  const unknown = randomUUID()
  const rejected = randomUUID()
  const alternate = randomUUID()
  const sessionId = 'session-dsh'
  const sent = []
  const { chat } = chatTools(directory, sent)
  await chat.submit({ sessionId, requestId: randomUUID(), codexThreadId: first }, async () => ({ accepted: true }))
  await assert.rejects(chat.submit({ sessionId, requestId: randomUUID(), codexThreadId: rejected },
    async () => { throw new Error('Rejected by DSH') }), /Rejected by DSH/)
  await chat.submit({ sessionId, requestId: randomUUID(), codexThreadId: rejected, replyTo: alternate },
    async () => ({ accepted: true }))

  const attachment = { kind: 'image', mediaType: 'image/png', data: 'test' }
  const attachmentId = 'sha256:' + 'a'.repeat(64)
  const { tools, chat: restarted } = chatTools(directory, sent, async (session, digest, seq) => {
    assert.equal(session.id, sessionId)
    assert.equal(digest, attachmentId)
    assert.equal(seq, 3)
    return attachment
  })
  const events = [{ type: 'turn/start', seq: 0 }, input('human', '请主动联系 Codex。')]
  const session = testSession(sessionId, events)
  const exec = { agent: { session } }
  const send = tools.get('send_to_codex')
  const reply = tools.get('reply_to_codex')
  await reply.execute({ message: 'Progress update' }, exec)
  await send.execute({ message: 'Progress update', target: first }, exec)
  for (const target of [unknown, rejected, alternate]) {
    await assert.rejects(send.execute({ message: 'Unknown', target }, exec), { code: 'codex-target-not-authorized' })
    await assert.rejects(send.execute({ message: 'Unknown', target, attachmentId, sourceSeq: 3 }, exec),
      { code: 'codex-target-not-authorized' })
  }
  await assert.rejects(reply.execute({ message: 'Wrong DSH session' },
    { agent: { session: testSession('session-unpaired', events) } }), { code: 'codex-target-not-authorized' })
  await assert.rejects(send.execute({ message: 'Wrong DSH session', attachmentId, sourceSeq: 3 },
    { agent: { session: testSession('session-unpaired', events) } }), { code: 'codex-target-not-authorized' })
  await send.execute({ message: 'Paired attachment', attachmentId, sourceSeq: 3 }, exec)
  await send.execute({ message: 'Paired attachment', target: first, attachmentId, sourceSeq: 3 }, exec)
  const requestId = randomUUID()
  await restarted.submit({ sessionId, requestId, codexThreadId: first }, async () => ({ accepted: true }))
  events.push(input('codex-bridge:' + requestId, 'Please send the authorized attachment.'))
  await send.execute({ message: 'Attachment', attachmentId, sourceSeq: 3 }, exec)
  assert.deepEqual(sent, [
    { target: first, message: 'Progress update' },
    { target: first, message: 'Paired attachment', attachment },
    { target: first, message: 'Attachment', attachment },
  ])
})

test('multiple paired destinations require a selection and a long active turn keeps its original authorization', async t => {
  const directory = routeDirectory(t)
  const sent = []
  const { tools, chat } = chatTools(directory, sent)
  const first = randomUUID()
  const second = randomUUID()
  const priorTurn = randomUUID()
  const sessionId = 'session-dsh'
  for (const codexThreadId of [first, second]) {
    await chat.submit({ sessionId, requestId: randomUUID(), codexThreadId }, async () => ({ accepted: true }))
  }
  const events = [
    { type: 'turn/start', seq: 0 },
    input('prior-human', '请联系 Codex ' + priorTurn),
    { type: 'turn/end', seq: 2 },
    { type: 'turn/start', seq: 3 },
  ]
  const exec = { agent: { session: testSession(sessionId, events) } }
  const send = tools.get('send_to_codex')
  const reply = tools.get('reply_to_codex')
  await assert.rejects(reply.execute({ message: 'Ambiguous' }, exec), /several paired Codex chats/)
  await send.execute({ message: 'Explicit pairing', target: 'codex://threads/' + second }, exec)
  const requestId = randomUUID()
  await chat.submit({ sessionId, requestId, codexThreadId: first }, async () => ({ accepted: true }))
  events.push(input('codex-bridge:' + requestId, 'The current destination.'))
  const appendSteps = () => {
    for (let i = 0; i < 550; i++) events.push({ type: 'step/end', seq: events.length })
  }
  appendSteps()
  await reply.execute({ message: 'Same active turn' }, exec)
  appendSteps()
  await reply.execute({ message: 'Same active turn' }, exec)
  await assert.rejects(send.execute({ message: 'Previous turn', target: priorTurn }, exec),
    { code: 'codex-target-not-authorized' })
  assert.deepEqual(sent, [{ target: second, message: 'Explicit pairing' }, { target: first, message: 'Same active turn' }])
})

test('direct delivery starts the daemon and reconnects once after a refused handshake', async () => {
  const calls = []
  const deliver = () => ({ status: 'sent' })
  const connect = async (cli, run) => {
    calls.push(['connect', cli])
    if (calls.length === 1) throw bridgeError('codex-control-unreachable', 'Connection refused')
    return run()
  }
  const start = async cli => { calls.push(['start', cli]) }
  assert.deepEqual(await withCodexService('codex.exe', deliver, connect, start), { status: 'sent' })
  assert.deepEqual(calls, [['connect', 'codex.exe'], ['start', 'codex.exe'], ['connect', 'codex.exe']])
})

test('direct delivery never reconnects after an unknown outcome', async () => {
  let attempts = 0
  const connect = async () => {
    attempts++
    throw bridgeError('codex-delivery-unknown', 'Connection dropped during delivery')
  }
  await assert.rejects(withCodexService('codex.exe', () => assert.fail(), connect, () => assert.fail()),
    { code: 'codex-delivery-unknown' })
  assert.equal(attempts, 1)
})
