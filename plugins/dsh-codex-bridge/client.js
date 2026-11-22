import { pathToFileURL } from 'node:url'
import { callBridge, sendText } from './live-send.js'
import { bridgeDirectory, bridgeError, dshSessionId, requestUuid } from './protocol.js'

const usage = [
  '配对接收使用 live-client.js 的 startPushPair，由当前 Codex 轮次订阅推送。',
  'node client.js send <sessionId> <requestUuid> <text>',
].join('\n')

const writeOutput = text => new Promise((resolve, reject) =>
  process.stdout.write(text, error => error ? reject(error) : resolve()))

async function main([op, sessionId, requestId, ...parts]) {
  if (!op || op === '--help') return console.log(usage)
  if (op === 'pair') throw bridgeError('push-watcher-required', usage)
  if (op !== 'send') throw bridgeError('unknown-operation', '未知命令。\n' + usage)
  if (!dshSessionId.test(sessionId)) throw bridgeError('invalid-session', '请提供准确的 DSH 会话 ID。')
  if (!requestUuid.test(process.env.CODEX_THREAD_ID)) throw bridgeError('invalid-thread', '请在目标 Codex 主聊天运行。')
  if (requestUuid.test(requestId) && parts.join(' ').trim()) {
    const directory = bridgeDirectory(), threadId = process.env.CODEX_THREAD_ID.toLowerCase()
    const call = request => callBridge(directory, threadId, request)
    return sendText({ op, sessionId, requestId, text: parts.join(' ') }, call, writeOutput)
  }
  throw bridgeError('invalid-arguments', usage)
}

if (typeof process !== 'undefined' && process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await main(process.argv.slice(2))
  } catch (error) {
    console.error(JSON.stringify({ code: error.code || 'bridge-error', message: error.message }))
    process.exitCode = 1
  }
}
