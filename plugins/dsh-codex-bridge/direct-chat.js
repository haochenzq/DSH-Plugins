import { createHash, randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { bridgeError, dshSessionId, requestPrefix, requestUuid } from './protocol.js'

const fields = new Set(['op', 'token', 'sessionId', 'codexThreadId', 'requestId', 'text', 'pair', 'liveTurnId', 'liveReceiverId'])
const disconnected = () => bridgeError('pair-disconnected', '当前通话未连接，请在目标 Codex 主聊天重新配对。')
export function createDirectChat(ctx, live, bindDshTurn) {
  const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))
  const confirmed = new WeakSet()
  const attempts = new Map()

  ctx.tools.register({
    name: 'reply_to_codex',
    description: '向正在与本 DSH 聊天配对的 Codex 原轮次发送文字。共享本机文件时将绝对路径写入正文。',
    parameters: { type: 'object', required: ['message'], additionalProperties: false,
      properties: { message: { type: 'string', minLength: 1, maxLength: 4000 } } },
    output: { schema: { type: 'string' }, render: (_args, value) => [{ type: 'text', text: value }] },
    async execute(args, exec) {
      if (Object.keys(args).some(key => key !== 'message') || typeof args.message !== 'string' ||
          !args.message.trim() || args.message.length > 4000) throw bridgeError('invalid-text', '请输入 1–4,000 字符的正文。')
      exec.signal?.throwIfAborted()
      const sessionId = exec.agent?.session?.id
      const binding = live.capture({ sessionId })
      if (!confirmed.has(binding)) throw disconnected()
      const messageId = typeof exec.callId === 'string' && exec.callId.length > 0 && exec.callId.length <= 256
        ? exec.callId : randomUUID()
      const result = await live.send({ sessionId, threadId: binding.threadId, expectedTurnId: binding.turnId, binding,
        messageId, body: args.message })
      return JSON.stringify(result)
    },
  })

  async function send(request, invoke) {
    const { sessionId, codexThreadId: threadId, requestId, text, pair = false } = request
    if (Object.keys(request).some(key => !fields.has(key)) || typeof pair !== 'boolean' ||
        (!pair && (request.liveTurnId !== undefined || request.liveReceiverId !== undefined)) ||
        !dshSessionId.test(sessionId) || !requestUuid.test(threadId) || !requestUuid.test(requestId) ||
        typeof text !== 'string' || !text.trim() || text.length > 12000) {
      throw bridgeError('invalid-message', '请使用指定会话 ID、请求 UUID 和 1–12,000 字符的正文。')
    }
    const binding = live.capture({ sessionId, threadId })
    if (!binding) throw disconnected()
    if (pair) {
      if (binding.turnId !== request.liveTurnId || binding.receiverId !== request.liveReceiverId) throw disconnected()
    } else if (!confirmed.has(binding)) throw disconnected()

    const key = sessionId + '/' + requestId.toLowerCase()
    const signature = createHash('sha256').update(JSON.stringify([binding.receiverId, pair, text])).digest('hex')
    const prior = attempts.get(key)
    if (prior) {
      if (prior.signature !== signature) throw bridgeError('request-conflict', '同一请求 UUID 已用于其他消息。')
      return prior.result
    }
    const checkTurn = bindDshTurn(sessionId, requestId)
    const entry = { signature, settled: false }
    entry.result = Promise.resolve().then(async () => {
      if (live.capture({ sessionId, threadId }) !== binding) throw disconnected()
      const receipt = checkTurn() ? { accepted: true } : await invoke('prompt', { request: {
        sessionId, requestId: requestPrefix + requestId.toLowerCase(), mode: 'steer',
        content: [{ type: 'text', text: '【Codex】' + text }],
      } })
      if (!pair || receipt?.accepted !== true) return receipt
      if (live.capture({ sessionId, threadId }) !== binding) {
        return { ...receipt, paired: false, warning: 'DSH 已接受握手，原收件连接已结束。' }
      }
      confirmed.add(binding)
      return { ...receipt, paired: true, codexThreadId: threadId, version }
    }).finally(() => {
      entry.settled = true
      if (attempts.size > 2048) {
        for (const [oldKey, old] of attempts) {
          if (old.settled) attempts.delete(oldKey)
          if (attempts.size <= 2048) break
        }
      }
    })
    attempts.set(key, entry)
    return entry.result
  }

  return { send }
}
