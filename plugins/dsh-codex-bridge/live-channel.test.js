import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { createLiveChannel } from './live-channel.js'
import { startPushPair } from './live-client.js'
import { readLine } from './protocol.js'

const threadId = randomUUID(), turnId = randomUUID(), sessionId = 'session-live-test'
const address = { sessionId, threadId, expectedTurnId: turnId }
const text = '第一行\n第二行 📬'
function message() { return { ...address, messageId: randomUUID(), body: text } }

test('one DSH session admits only one connected Codex conversation and never lets a stale sender claim its replacement', async t => {
  const channel = createLiveChannel({ activeTurn: () => turnId })
  t.after(channel.close)
  const cancel = new AbortController(), frames = []
  const stream = channel.receive(address, cancel.signal, undefined, value => frames.push(value))
  const first = channel.capture(address), other = { ...address, threadId: randomUUID() }
  assert.throws(() => channel.receive(other, undefined, undefined, assert.fail), { code: 'codex-live-receiver-exists' })
  assert.throws(() => channel.send({ ...message(), ...other }), { code: 'codex-no-live-receiver' })
  const packet = message(), sent = channel.send(packet)
  assert.throws(() => channel.ack({ ...frames[0], claimId: randomUUID() }), { code: 'invalid-live-ack' })
  assert.throws(() => channel.send({ ...packet, body: 'different' }), { code: 'request-conflict' })
  await channel.ack(frames[0])
  await sent
  assert.equal(frames.length, 1)
  cancel.abort()
  await assert.rejects(stream)
  const replacement = channel.receive(address, undefined, undefined, assert.fail)
  assert.notEqual(first.receiverId, channel.capture(address).receiverId)
  assert.notEqual(channel.capture(address), first)
  assert.throws(() => channel.send({ ...message(), binding: first }), { code: 'codex-no-live-receiver' })
  channel.close()
  await assert.rejects(replacement)
})

test('unknown CLI commands fail locally', async () => {
  const child = spawn(process.execPath, [fileURLToPath(new URL('./client.js', import.meta.url)), 'obsolete-command'],
    { windowsHide: true, env: { ...process.env, DSH_CODEX_BRIDGE_DIR: join(tmpdir(), randomUUID()) } })
  let errors = ''
  child.stderr.setEncoding('utf8').on('data', value => { errors += value })
  const [code] = await once(child, 'close')
  assert.equal(code, 1)
  assert.equal(JSON.parse(errors).code, 'unknown-operation')
})

test('a continuous receiver writes consecutive frames immediately, acknowledges each, and never follows a new turn', async t => {
  let active = turnId
  const channel = createLiveChannel({ activeTurn: () => active })
  t.after(channel.close)
  const envelopes = [], addresses = []
  const listening = channel.receive(address, undefined, ready => addresses.push(ready), value => envelopes.push(value))
  assert.deepEqual(addresses, [channel.capture(address)])
  const first = message(), second = { ...message(), body: '紧接着的第二条' }
  const ackOne = channel.send(first), ackTwo = channel.send(second)
  assert.deepEqual(envelopes.map(x => x.body), [first.body, second.body])
  assert.equal(channel.capture(address).turnId, turnId)
  assert.deepEqual(await channel.ack(envelopes[1]), await ackTwo)
  assert.deepEqual(await channel.ack(envelopes[0]), await ackOne)
  assert.deepEqual(await channel.send(first), await ackOne)
  assert.equal(envelopes.length, 2)
  active = randomUUID()
  channel.closeInactive(threadId)
  assert.deepEqual(await listening, { status: 'turn-ended', turnId })
  assert.throws(() => channel.send(message()), { code: 'codex-no-live-receiver' })
})

test('continuous receiver disconnect before ack never replays claimed or later text', async t => {
  const channel = createLiveChannel({ activeTurn: () => turnId, ackMs: 15 })
  t.after(channel.close)
  const controller = new AbortController(), original = message()
  const stream = channel.receive(address, controller.signal, undefined, () => {})
  const sent = channel.send(original)
  controller.abort()
  await assert.rejects(stream, { code: 'codex-no-live-receiver' })
  assert.throws(() => channel.send(message()), { code: 'codex-no-live-receiver' })
  const next = channel.receive(address, undefined, undefined, assert.fail)
  await assert.rejects(sent, { code: 'codex-delivery-unknown' })
  await assert.rejects(channel.send(original), { code: 'codex-delivery-unknown' })
  channel.close()
  await assert.rejects(next)
})

test('push notifies a waiting consumer; only confirmation after notification sends an ACK; no missing consumer is replayed',
  { skip: process.platform !== 'win32' }, async t => {
    const directory = await mkdtemp(join(tmpdir(), 'dsh-push-')), token = 'f'.repeat(64)
    const pipe = '\\\\.\\pipe\\dsh-codex-' + randomUUID()
    const binding = { sessionId, threadId, turnId, receiverId: randomUUID() }
    const acks = [], packets = [1, 2, 3].map(n => ({ ...binding, messageId: randomUUID(), claimId: randomUUID(), body: '独立来信 ' + n }))
    let stream, handshakes = 0
    const write = (socket, frame) => socket.write(JSON.stringify(frame) + '\n')
    const sendPacket = n => write(stream, { message: packets[n] })
    const server = createServer(socket => readLine(socket, 65536, line => {
      const request = JSON.parse(line)
      assert.equal(request.token, token)
      assert.equal(request.codexThreadId, threadId)
      if (request.op === 'receive-live') {
        stream = socket
        write(socket, { ready: binding })
      } else if (request.op === 'send') {
        handshakes++
        assert.equal(request.liveReceiverId, binding.receiverId)
        socket.end(JSON.stringify({ ok: true, value: { accepted: true, paired: true, codexThreadId: threadId, version: '1.2.3-test' } }) + '\n')
      } else {
        assert.equal(request.op, 'ack-live')
        acks.push(request.messageId)
        if (acks.length === 1) sendPacket(1)
        socket.end(JSON.stringify({ ok: true, value: { status: 'live-received' } }) + '\n')
      }
    }, assert.fail))
    const h = startPushPair(sessionId, threadId, directory)
    t.after(async () => {
      h.close()
      stream?.destroy()
      await new Promise(resolve => server.close(resolve))
      await rm(directory, { recursive: true, force: true })
    })
    server.listen(pipe)
    await once(server, 'listening')
    await writeFile(join(directory, 'endpoint.json'), JSON.stringify({ version: 1, pipe, token }))
    const paired = await h.event()
    assert.equal(paired.kind, 'paired')
    assert.equal(paired.version, '1.2.3-test')
    assert.equal(handshakes, 1)
    const first = h.event(paired.id)
    sendPacket(0)
    const received = await first
    assert.equal(received.body, packets[0].body)
    assert.deepEqual(acks, [])
    await assert.rejects(h.event('wrong-confirmation'), { code: 'invalid-push-confirmation' })
    const next = await h.event(received.id)
    assert.deepEqual(acks, [packets[0].messageId])
    assert.equal(next.body, packets[1].body)
    sendPacket(2) // Misbehaving peer sends without a registered waiter.
    await once(stream, 'close')
    assert.equal((await h.event(next.id)).kind, 'closed')
    assert.deepEqual(acks, [packets[0].messageId])
  })
