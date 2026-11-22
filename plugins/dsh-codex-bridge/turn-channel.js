import { readFile } from 'node:fs/promises'
import { createConnection } from 'node:net'
import { pathToFileURL } from 'node:url'
import { bridgeDirectory, endpointFile, readLine, requestUuid } from './protocol.js'

const events = new Set(['UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'Stop', 'Interrupt'])
const isId = value => typeof value === 'string' && requestUuid.test(value)

export function createTurnChannel({ lifetimeMs = 6 * 60 * 60 * 1000, now = Date.now } = {}) {
  const active = new Map()
  const retiredThrough = new Map()
  const retiredOpaque = new Set()
  let closed = false

  // Native UUIDv7 turn IDs contain Unix milliseconds. One watermark per thread
  // rules out delayed events, even from an old turn this process never observed.
  function turnTime(id) {
    return id[14] === '7' ? Number.parseInt(id.slice(0, 8) + id.slice(9, 13), 16) : null
  }

  function retire(thread, id) {
    const timestamp = turnTime(id)
    if (timestamp === null) retiredOpaque.add(thread + '/' + id)
    else retiredThrough.set(thread, Math.max(retiredThrough.get(thread) ?? -1, timestamp))
    const turn = active.get(thread)
    if (turn?.id === id) {
      clearTimeout(turn.timer)
      active.delete(thread)
    }
  }

  function activeTurn(threadId) {
    if (!isId(threadId)) return null
    const thread = threadId.toLowerCase()
    const turn = active.get(thread)
    if (!turn) return null
    if (now() < turn.expiresAt) return turn.id
    retire(thread, turn.id)
    return null
  }

  function hook({ event, threadId, turnId }) {
    if (closed || !events.has(event) || !isId(threadId) || !isId(turnId)) return {}
    const thread = threadId.toLowerCase(), id = turnId.toLowerCase()
    if (event === 'Stop' || event === 'Interrupt') {
      retire(thread, id)
      return {}
    }
    const current = activeTurn(thread)
    if (current === id) {
      const turn = active.get(thread)
      turn.expiresAt = now() + lifetimeMs
      turn.timer.refresh()
      return {}
    }
    const time = turnTime(id)
    if (time === null ? retiredOpaque.has(thread + '/' + id) : time <= (retiredThrough.get(thread) ?? -1)) return {}
    if (current) {
      if (event !== 'UserPromptSubmit') return {}
      const previousTime = turnTime(current)
      if (previousTime !== null && time !== null && time <= previousTime) return {}
      retire(thread, current)
    }
    const timer = setTimeout(() => retire(thread, id), lifetimeMs).unref()
    active.set(thread, { id, timer, expiresAt: now() + lifetimeMs })
    return {}
  }

  function close() {
    closed = true
    for (const turn of active.values()) clearTimeout(turn.timer)
    active.clear()
    retiredThrough.clear()
    retiredOpaque.clear()
  }

  return { hook, activeTurn, close }
}

async function callBridge(fields) {
  const endpoint = JSON.parse(await readFile(endpointFile(bridgeDirectory()), 'utf8'))
  if (endpoint.version !== 1 || !/^\\\\\.\\pipe\\dsh-codex-[a-f0-9-]{36}$/i.test(endpoint.pipe) ||
      !/^[a-f0-9]{64}$/.test(endpoint.token)) return
  await new Promise((resolve, reject) => {
    const socket = createConnection(endpoint.pipe)
    const timer = setTimeout(() => socket.destroy(), 2000)
    socket.once('close', () => { clearTimeout(timer); resolve() })
    socket.once('error', reject)
    socket.once('connect', () => socket.write(JSON.stringify({ op: 'turn-hook', token: endpoint.token, ...fields }) + '\n'))
    readLine(socket, 4096, () => socket.destroy(), error => socket.destroy(error))
  })
}

export async function runTurnHook(input, call) {
  const { session_id: threadId, turn_id: turnId, hook_event_name: event } = input
  if (input.agent_id != null || input.agent_type != null || !isId(threadId) || !isId(turnId) || !events.has(event)) return
  await call({ event, threadId, turnId })
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const chunks = []
    let bytes = 0
    for await (const chunk of process.stdin) {
      bytes += chunk.length
      if (bytes > 16 * 1024 * 1024) break
      chunks.push(chunk)
    }
    if (bytes <= 16 * 1024 * 1024) await runTurnHook(JSON.parse(Buffer.concat(chunks).toString('utf8')), callBridge)
  } catch {
    // Losing contact with DSH must not block the user's Codex turn.
  }
}
