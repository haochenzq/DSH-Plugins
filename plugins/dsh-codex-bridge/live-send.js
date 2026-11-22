import { readFile } from 'node:fs/promises'
import { createConnection } from 'node:net'
import { bridgeError, endpointFile, maxResponseBytes, readLine, socketTimeoutMs } from './protocol.js'

export async function callBridge(directory, threadId, request, { onReady, onMessage, signal } = {}) {
  const endpoint = await readFile(endpointFile(directory), 'utf8').then(JSON.parse).catch(error => {
    if (error.code === 'ENOENT') throw bridgeError('bridge-offline', 'Open DeepSeek Harness and enable the Codex chat bridge.')
    throw error
  })
  if (endpoint.version !== 1 || !/^\\\\\.\\pipe\\dsh-codex-[a-f0-9-]{36}$/i.test(endpoint.pipe) ||
      !/^[a-f0-9]{64}$/.test(endpoint.token)) {
    throw bridgeError('invalid-endpoint', 'The local DSH bridge endpoint is invalid.')
  }
  return new Promise((resolve, reject) => {
    const socket = createConnection({ path: endpoint.pipe, signal })
    let ended = false
    socket.setTimeout(onMessage ? 0 : socketTimeoutMs, () => socket.destroy(bridgeError('timeout', 'DSH bridge timed out.')))
    socket.once('error', reject)
    socket.once('close', () => { if (!ended) reject(bridgeError('connection-closed', 'DSH bridge closed before replying.')) })
    socket.once('connect', () => socket.write(JSON.stringify({
      ...request, codexThreadId: threadId, token: endpoint.token,
    }) + '\n'))
    readLine(socket, maxResponseBytes, line => {
      try {
        const response = JSON.parse(line)
        if (onReady && response.ready) {
          if (response.ready.threadId !== threadId) {
            throw bridgeError('invalid-live-address', '收件连接与发起配对的 Codex 聊天不匹配。')
          }
          onReady?.(response.ready)
          return true
        }
        if (onMessage && response.message) {
          onMessage(response.message)
          return true
        }
        if (!response.ok) throw bridgeError(response.code, response.message)
        ended = true
        resolve(response.value)
      } catch (error) {
        reject(error)
      }
      socket.destroy()
    }, error => socket.destroy(error))
  })
}

export async function sendText(request, call, write, pairing) {
  const receipt = await call(request)
  if (receipt?.accepted !== true) throw bridgeError('dsh-delivery-unknown', 'DSH 未确认接收。请核对原聊天，勿重发。')
  if (pairing && (receipt.paired !== true || receipt.codexThreadId !== pairing.binding.threadId)) {
    throw bridgeError('pair-unconfirmed', 'DSH 已接受握手，但没有确认本聊天的配对。请核对原聊天，勿重发。')
  }
  if (pairing && (typeof receipt.version !== 'string' || !receipt.version.trim())) {
    throw bridgeError('pair-receipt-incomplete', 'DSH 已确认配对，但回执缺少运行中的插件版本。')
  }
  if (pairing?.signal.aborted) throw bridgeError('pair-listener-closed', 'DSH 已接受握手，本轮收件连接已经关闭。')
  const event = {
    direction: 'Codex → DSH', status: pairing ? 'paired' : 'accepted', sessionId: request.sessionId,
    requestId: request.requestId, body: request.text,
    ...(pairing ? { threadId: pairing.binding.threadId, turnId: pairing.binding.turnId, version: receipt.version } : {}),
  }
  if (write) await write(JSON.stringify(event) + '\n')
  return event
}
