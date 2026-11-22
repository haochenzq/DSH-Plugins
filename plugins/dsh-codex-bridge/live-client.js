import { randomUUID } from 'node:crypto'
import { bridgeError, dshSessionId, requestUuid } from './protocol.js'
import { callBridge, sendText } from './live-send.js'

// event(id) acknowledges the preceding notification *after* installing its next
// waiter. Only receipt identifiers cross that gap. Message bodies are never queued.
export function startPushPair(sessionId, threadId, directory) {
  if (!dshSessionId.test(sessionId) || !requestUuid.test(threadId) || typeof directory !== 'string' || !directory) {
    throw bridgeError('invalid-pair-address', '请提供 DSH 会话 ID、当前 Codex 主聊天 ID 和桥接目录。')
  }
  threadId = threadId.toLowerCase()
  const controller = new AbortController()
  const call = (request, options) => callBridge(directory, threadId, request, options)
  let started = false, binding, waiter, outstanding, terminal

  function finish(error) {
    if (terminal) return
    terminal = { kind: 'closed', sessionId, threadId, ...(error ? { code: error.code || 'bridge-error', reason: error.message } : {}) }
    controller.abort()
    outstanding = undefined
    waiter?.resolve(terminal)
    waiter = undefined
  }

  function publish(kind, data, ack) {
    if (terminal || !waiter) throw bridgeError('push-waiter-unavailable', '当前轮次未挂起推送接收。')
    const id = randomUUID()
    outstanding = { id, ack }
    const next = waiter
    waiter = undefined
    next.resolve({ kind, id, ...data })
  }

  function ready(address) {
    if (binding || address?.sessionId !== sessionId || address.threadId !== threadId ||
        !requestUuid.test(address.turnId) || !requestUuid.test(address.receiverId)) {
      throw bridgeError('invalid-live-address', '收件连接与目标会话不匹配。')
    }
    binding = address
    sendText({
      op: 'send', pair: true, sessionId, requestId: randomUUID(), liveTurnId: address.turnId, liveReceiverId: address.receiverId,
      text: 'Codex 请求与本 DSH 会话配对。可用 reply_to_codex 主动同步进展、问题和结果。共享文件时请把本机绝对路径写入正文。',
    }, call, undefined, { binding, signal: controller.signal })
      .then(result => publish('paired', result)).catch(finish)
  }

  function receive(message) {
    if (!binding || message?.sessionId !== sessionId || message.threadId !== threadId ||
        message.turnId !== binding.turnId || !requestUuid.test(message.claimId) || typeof message.messageId !== 'string' ||
        typeof message.body !== 'string') throw bridgeError('invalid-live-message', '来信与当前通话不匹配。')
    const { turnId, messageId, claimId, body } = message
    publish('message', { direction: 'DSH → Codex', sessionId, threadId, turnId, messageId, body },
      { op: 'ack-live', sessionId, turnId, messageId, claimId })
  }

  function event(confirmedEventId) {
    if (terminal) return Promise.resolve(terminal)
    if (waiter || outstanding?.id !== confirmedEventId) {
      return Promise.reject(bridgeError('invalid-push-confirmation', '请在推送完成后使用该事件的 ID 订阅下一条。'))
    }
    const previous = outstanding
    outstanding = undefined
    const next = Promise.withResolvers()
    waiter = next
    if (!started) {
      started = true
      call({ op: 'receive-live', sessionId }, { signal: controller.signal, onReady: ready, onMessage: receive })
        .then(() => finish(), finish)
    } else if (previous?.ack) {
      call(previous.ack).catch(finish)
    }
    return next.promise
  }
  return { event, close: () => finish() }
}
