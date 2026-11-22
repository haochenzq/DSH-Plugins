import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { createTurnChannel, runTurnHook } from './turn-channel.js'
const threadId = randomUUID()
const input = (event, threadId, turnId) => ({
  session_id: threadId, turn_id: turnId, hook_event_name: event,
  prompt: 'private user input', tool_response: { private: true },
})

test('main chat hook forwards only the lifecycle event and IDs', async () => {
  const turnId = randomUUID(), seen = []
  const fields = input('PreToolUse', threadId, turnId)
  await runTurnHook(fields, request => seen.push(request))
  assert.deepEqual(seen, [{ event: 'PreToolUse', threadId, turnId }])
  for (const extra of [{ agent_id: randomUUID() }, { agent_type: 'worker' }, { turn_id: '?' }, { session_id: [threadId] }, { hook_event_name: 'ack' }]) {
    await runTurnHook({ ...fields, ...extra }, assert.fail)
  }
})

test('recovery, supersession, late stop and interrupt stay local to the thread and turn', t => {
  const channel = createTurnChannel()
  t.after(channel.close)
  const first = randomUUID(), second = randomUUID(), unrelated = randomUUID()
  const hook = (event, turnId, owner = threadId) => channel.hook({ event, threadId: owner, turnId })
  hook('PreToolUse', first)
  hook('PostToolUse', first, unrelated)
  hook('UserPromptSubmit', second)
  hook('Stop', first)
  hook('PostToolUse', first)
  assert.equal(channel.activeTurn(threadId), second)
  assert.deepEqual(hook('Interrupt', second), {})
  hook('UserPromptSubmit', first)
  hook('PreToolUse', second)
  assert.equal(channel.activeTurn(threadId), null)
  assert.equal(channel.activeTurn(unrelated), first)
  channel.close()
  hook('UserPromptSubmit', randomUUID())
  assert.equal(channel.activeTurn(threadId), null)
})

test('late previously unseen UUIDv7 cannot reopen a thread after a newer turn stopped', t => {
  const channel = createTurnChannel()
  t.after(channel.close)
  const id = i => '019b0000-' + i.toString(16).padStart(4, '0') + '-7000-8010-000000000001'
  const hook = (event, i) => channel.hook({ event, threadId, turnId: id(i) })
  hook('UserPromptSubmit', 4)
  hook('UserPromptSubmit', 1)
  assert.equal(channel.activeTurn(threadId), id(4))
  hook('Stop', 4)
  hook('PostToolUse', 2)
  assert.equal(channel.activeTurn(threadId), null)
  hook('PostToolUse', 5)
  assert.equal(channel.activeTurn(threadId), id(5))
})

test('activity refreshes the lease and an expired turn cannot be revived', t => {
  let clock = 0
  const channel = createTurnChannel({ now: () => clock, lifetimeMs: 1000 })
  t.after(channel.close)
  const turnId = randomUUID(), hook = event => channel.hook({ event, threadId, turnId })
  hook('UserPromptSubmit')
  clock = 900
  hook('PostToolUse')
  clock = 1200
  assert.equal(channel.activeTurn(threadId), turnId)
  clock = 2000
  hook('PreToolUse')
  assert.equal(channel.activeTurn(threadId), null)
})

test('Windows command hook registers and retires over the private pipe without emitting output',
  { skip: process.platform !== 'win32' }, async t => {
    const directory = await mkdtemp(join(tmpdir(), 'dsh-hook-'))
    const pipe = '\\\\.\\pipe\\dsh-codex-' + randomUUID()
    const token = randomBytes(32).toString('hex')
    const turnId = randomUUID()
    const channel = createTurnChannel()
    const server = createServer(socket => {
      let data = ''
      socket.setEncoding('utf8').on('data', chunk => {
        data += chunk
        if (!data.endsWith('\n')) return
        const fields = JSON.parse(data)
        assert.equal(fields.token, token)
        assert.equal(fields.op, 'turn-hook')
        assert.equal('tool_response' in fields, false)
        socket.end(JSON.stringify({ ok: true, value: channel.hook(fields) }) + '\n')
      })
    })
    t.after(async () => {
      channel.close()
      await new Promise(resolve => server.close(resolve))
      await rm(directory, { recursive: true, force: true })
    })
    server.listen(pipe)
    await once(server, 'listening')
    await writeFile(join(directory, 'endpoint.json'), JSON.stringify({ version: 1, token, pipe }))
    async function run(event) {
      const child = spawn(process.execPath, [fileURLToPath(new URL('./turn-channel.js', import.meta.url))],
        { env: { ...process.env, DSH_CODEX_BRIDGE_DIR: directory }, windowsHide: true })
      let stdout = ''
      child.stdout.setEncoding('utf8').on('data', chunk => { stdout += chunk })
      child.stdin.end(JSON.stringify(input(event, threadId, turnId)))
      const [code] = await once(child, 'close')
      assert.equal(code, 0)
      return stdout
    }
    assert.equal(await run('UserPromptSubmit'), '')
    assert.equal(channel.activeTurn(threadId), turnId)
    assert.equal(await run('Stop'), '')
    assert.equal(channel.activeTurn(threadId), null)
  })
