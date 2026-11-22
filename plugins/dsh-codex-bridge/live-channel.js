import { createHash, randomUUID } from 'node:crypto'
import { bridgeError, dshSessionId, requestUuid } from './protocol.js'

const unavailable = () => bridgeError('codex-no-live-receiver', 'No connected receiver for the selected DSH session and Codex turn.')
const unknown = () => bridgeError('codex-delivery-unknown', 'The receiver claimed this message but did not confirm writing the output.')

export function createLiveChannel({ activeTurn, ackMs = 8_000 } = {}) {
  const listeners = new Map()
  const deliveries = new Map()
  let closed = false

  function receive({ sessionId, threadId, expectedTurnId }, signal, onReady, onMessage) {
    const turnId = activeTurn(threadId)
    if (closed || signal?.aborted || typeof onMessage !== 'function' || !dshSessionId.test(sessionId) || !requestUuid.test(threadId) ||
        !requestUuid.test(turnId) || (expectedTurnId != null && turnId !== expectedTurnId)) throw unavailable()
    const prior = listeners.get(sessionId)
    if (prior && activeTurn(prior.threadId) !== prior.turnId) prior.finish()
    if (listeners.has(sessionId)) throw bridgeError('codex-live-receiver-exists', '此 DSH 会话已经接通一个 Codex 聊天。')
    const binding = { sessionId, threadId, turnId, receiverId: randomUUID() }

    return new Promise((resolve, reject) => {
      const cancel = error => { remove(); reject(error) }
      const abort = () => cancel(unavailable())
      const finish = () => {
        remove()
        resolve({ status: 'turn-ended', turnId })
      }
      const timer = setInterval(() => { if (activeTurn(threadId) !== turnId) finish() }, 5000)
      function remove() {
        listeners.delete(sessionId)
        clearTimeout(timer)
        signal?.removeEventListener('abort', abort)
      }
      listeners.set(sessionId, { cancel, threadId, turnId, binding, finish, accept: onMessage })
      signal?.addEventListener('abort', abort, { once: true })
      try { onReady?.(binding) } catch (error) { cancel(error) }
    })
  }

  function send({ sessionId, threadId, expectedTurnId, messageId, body, binding }) {
    if (!dshSessionId.test(sessionId) || !requestUuid.test(threadId) ||
        typeof messageId !== 'string' || !messageId || messageId.length > 256 ||
        typeof body !== 'string' || !body.trim() || body.length > 4000) {
      throw bridgeError('invalid-message', 'Invalid live delivery address, message ID, or text.')
    }
    const key = [sessionId, threadId, messageId].join('/')
    const hash = createHash('sha256').update(body).digest('hex')
    const previous = deliveries.get(key)
    if (previous) {
      if (previous.hash !== hash || (expectedTurnId != null && previous.turnId !== expectedTurnId)) {
        throw bridgeError('request-conflict', 'This message ID already identifies another live delivery.')
      }
      return previous.result
    }
    const turnId = activeTurn(threadId)
    const listener = listeners.get(sessionId)
    if (closed || listener?.threadId !== threadId || listener.turnId !== turnId || (expectedTurnId != null && turnId !== expectedTurnId) ||
        (binding !== undefined && binding !== listener.binding)) throw unavailable()
    // Only an existing receiver may claim the body. Keep only identity and acknowledgement state.
    const claimId = randomUUID()
    let resolve, reject
    const result = new Promise((accept, fail) => { resolve = accept; reject = fail })
    const entry = { turnId, claimId, hash, result }
    function settle(confirmed) {
      clearTimeout(entry.timer)
      delete entry.settle
      if (confirmed) resolve({ status: 'live-received', turnId, messageId })
      else reject(unknown())
      // Keep a bounded record of completed attempts, including ambiguous outcomes, to prevent replay.
      if (deliveries.size > 4096) {
        for (const [oldKey, old] of deliveries) {
          if (!old.settle) deliveries.delete(oldKey)
          if (deliveries.size <= 4096) break
        }
      }
    }
    entry.settle = settle
    entry.timer = setTimeout(() => settle(false), ackMs)
    deliveries.set(key, entry)
    try {
      listener.accept({ sessionId, threadId, turnId, messageId, claimId, body })
    } catch (error) {
      settle(false)
      listener.cancel(error)
    }
    return result
  }

  function ack({ sessionId, threadId, turnId, messageId, claimId }) {
    const entry = deliveries.get([sessionId, threadId, messageId].join('/'))
    if (!entry || entry.turnId !== turnId || entry.claimId !== claimId) {
      throw bridgeError('invalid-live-ack', 'The receipt does not identify the claimed message.')
    }
    entry.settle?.(true)
    return entry.result
  }

  function close() {
    closed = true
    for (const listener of listeners.values()) listener.cancel(unavailable())
    for (const entry of deliveries.values()) entry.settle?.(false)
  }
  function capture({ sessionId, threadId }) {
    const listener = listeners.get(sessionId)
    if (closed || !listener || (threadId !== undefined && listener.threadId !== threadId)) return null
    return listener.turnId === activeTurn(listener.threadId) ? listener.binding : null
  }
  function closeInactive(threadId) {
    const turnId = activeTurn(threadId)
    for (const listener of listeners.values()) {
      if (listener.threadId === threadId && listener.turnId !== turnId) listener.finish()
    }
  }
  return { receive, send, ack, close, closeInactive, capture }
}
