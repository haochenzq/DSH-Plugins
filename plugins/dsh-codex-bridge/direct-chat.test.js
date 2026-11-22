import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { createDirectChat } from './direct-chat.js'
import { createLiveChannel } from './live-channel.js'

function fixture(t) {
  const turns = new Map()
  const live = createLiveChannel({ activeTurn: id => turns.get(id) })
  t.after(() => live.close())
  const sessionId = 'session-test'
  const messages = []
  const calls = []
  function connect(threadId = randomUUID()) {
    const controller = new AbortController()
    turns.set(threadId, randomUUID())
    let binding
    const stopped = live.receive({ sessionId, threadId }, controller.signal, address => { binding = address }, message => {
      messages.push(message)
      live.ack(message)
    }).catch(() => {})
    return { binding, async close() { controller.abort(); await stopped } }
  }
  function host(bindGuard = () => () => false) {
    const tools = []
    const chat = createDirectChat({ tools: { register: tool => tools.push(tool) } }, live, bindGuard)
    assert.deepEqual(tools.map(tool => tool.name), ['reply_to_codex'])
    return { ...chat, reply(message, callId = randomUUID()) {
      return tools[0].execute({ message }, { agent: { session: { id: sessionId } }, callId })
    } }
  }
  function request(binding, text = '握手', pair = true) {
    return { op: 'send', sessionId, codexThreadId: binding.threadId, requestId: randomUUID(), text,
      ...(pair ? { pair, liveReceiverId: binding.receiverId, liveTurnId: binding.turnId } : {}) }
  }
  async function invoke(method, { request }) {
    assert.equal(method, 'prompt')
    assert.equal(request.mode, 'steer')
    calls.push(request)
    return { accepted: true }
  }
  return { connect, host, request, invoke, sessionId, messages, calls, turns, live }
}

test('a confirmed live pair carries exact text in both directions and two identical tool calls deliver once', async t => {
  const f = fixture(t)
  const { binding } = f.connect()
  const chat = f.host()
  await assert.rejects(chat.reply('尚未配对'), { code: 'pair-disconnected' })
  await assert.rejects(chat.send(f.request(binding, '尚未配对', false), f.invoke), { code: 'pair-disconnected' })
  const pair = f.request(binding)
  const result = await chat.send(pair, f.invoke)
  const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))
  assert.deepEqual(result, { accepted: true, paired: true, codexThreadId: binding.threadId, version })
  const text = '  开头保留缩进\n\nD:/本机 素材/图.png\n'
  const restarted = f.host()
  await assert.rejects(restarted.send(f.request(binding, text, false), f.invoke), { code: 'pair-disconnected' })
  await assert.rejects(restarted.reply(text), { code: 'pair-disconnected' })
  await chat.send(f.request(binding, text, false), f.invoke)
  assert.deepEqual(f.calls[1].content, [{ type: 'text', text: '【Codex】' + text }])
  const callId = randomUUID()
  const receipt = JSON.parse(await chat.reply(text, callId))
  assert.equal(receipt.turnId, binding.turnId)
  assert.equal(receipt.status, 'live-received')
  await chat.reply(text, callId)
  assert.deepEqual(f.messages.map(item => item.body), [text])
  const missingId = JSON.parse(await chat.reply('缺少宿主调用 ID 时仍能回传', null))
  assert.match(missingId.messageId, /^[0-9a-f-]{36}$/)
})

test('a second chat cannot take over the DSH call; disconnects and turn changes require a fresh pairing', async t => {
  const f = fixture(t)
  const first = f.connect()
  const chat = f.host()
  await chat.send(f.request(first.binding), f.invoke)
  assert.throws(() => f.connect(), { code: 'codex-live-receiver-exists' })
  await first.close()
  const next = f.connect()
  await assert.rejects(chat.reply('旧消息'), { code: 'pair-disconnected' })
  await assert.rejects(chat.send(f.request(next.binding, '未握手', false), f.invoke), { code: 'pair-disconnected' })
  await chat.send(f.request(next.binding), f.invoke)
  await assert.rejects(chat.send(f.request(first.binding, '旧端发送', false), f.invoke), { code: 'pair-disconnected' })
  assert.equal(JSON.parse(await chat.reply('新连接')).turnId, next.binding.turnId)
  f.turns.set(next.binding.threadId, randomUUID())
  await assert.rejects(chat.reply('错误轮次'), { code: 'pair-disconnected' })
  assert.deepEqual(f.messages.map(item => item.body), ['新连接'])
})

test('different UUIDs steer independently; a duplicate UUID shares its receipt and cannot change its content', async t => {
  const f = fixture(t)
  const { binding } = f.connect()
  const chat = f.host()
  await chat.send(f.request(binding), f.invoke)
  const message = f.request(binding, '第一条', false)
  const started = Promise.withResolvers()
  const release = Promise.withResolvers()
  let count = 0
  const pending = chat.send(message, async () => {
    count++
    started.resolve()
    await release.promise
    return { accepted: true }
  })
  await started.promise
  const duplicate = chat.send(message, () => assert.fail('duplicate request'))
  await assert.rejects(chat.send({ ...message, text: '改写' }, f.invoke), { code: 'request-conflict' })
  await chat.send(f.request(binding, '独立消息', false), f.invoke)
  release.resolve()
  await Promise.all([pending, duplicate])
  await chat.send(message, () => assert.fail('completed request'))
  assert.equal(count, 1)
  assert.equal(f.calls.length, 2)
})

test('a failed prompt or a disconnected listener cannot confirm the handshake', async t => {
  const f = fixture(t)
  const { binding } = f.connect()
  const chat = f.host()
  const failed = f.request(binding)
  const gone = new Error('宿主未确认')
  await assert.rejects(chat.send(failed, async () => { throw gone }), gone)
  await assert.rejects(chat.send(failed, () => assert.fail('ambiguous send replay')), gone)
  await assert.rejects(chat.reply('未确认'), { code: 'pair-disconnected' })
  const receipt = await chat.send(f.request(binding), async () => {
    f.turns.delete(binding.threadId)
    return { accepted: true }
  })
  assert.equal(receipt.accepted, true)
  assert.equal(receipt.paired, false)
})

test('only the defined fields and the original live receiver are admitted before a prompt is sent', async t => {
  const f = fixture(t)
  const { binding } = f.connect()
  const chat = f.host()
  for (const change of [{ filePath: 'D:/x.txt' }, { replyTo: randomUUID() }, { text: ' ' }, { requestId: 'x' }]) {
    await assert.rejects(chat.send({ ...f.request(binding), ...change }, f.invoke), { code: 'invalid-message' })
  }
  await assert.rejects(chat.send({ ...f.request(binding), liveReceiverId: randomUUID() }, f.invoke),
    { code: 'pair-disconnected' })
  assert.equal(f.calls.length, 0)
})
