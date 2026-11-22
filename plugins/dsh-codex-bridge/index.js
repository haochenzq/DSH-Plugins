import { randomBytes, randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { bridgeDirectory, bridgeError, dshSessionId, endpointFile, maxRequestBytes, readLine, requestUuid, sameToken, socketTimeoutMs } from './protocol.js'
import { createDirectChat } from './direct-chat.js'
import { createLiveChannel } from './live-channel.js'
import { createTurnChannel } from './turn-channel.js'
import { createDshTurnGuard } from './dsh-turn-guard.js'

export const inject = ['connection', 'typertGateway', 'tools', 'agents']
export async function apply(ctx) {
  const peer = ctx.connection.createPeer({ principal: { kind: 'owner' }, interactions: 'none' })
  const gateway = ctx.typertGateway
  const directory = bridgeDirectory()
  const endpoint = endpointFile(directory)
  const pipe = '\\\\.\\pipe\\dsh-codex-' + randomUUID()
  const token = randomBytes(32).toString('hex')
  const temporary = endpoint + '.' + randomUUID()
  const sockets = new Set()
  const channel = createTurnChannel()
  const live = createLiveChannel({ activeTurn: channel.activeTurn })
  const chat = createDirectChat(ctx, live, createDshTurnGuard(ctx))

  const server = createServer(socket => {
    sockets.add(socket)
    const connection = new AbortController()
    const signal = AbortSignal.any([connection.signal, peer.signal])
    socket.setTimeout(socketTimeoutMs, () => socket.destroy())
    socket.on('error', () => socket.destroy())
    socket.on('close', () => {
      sockets.delete(socket)
      connection.abort()
    })
    const respond = response => {
      if (!socket.destroyed) socket.end(JSON.stringify(response) + '\n')
    }
    const reject = error => respond({
      ok: false,
      code: error.code || 'bridge-error',
      message: error.message || 'DSH could not complete the bridge request.',
    })
    readLine(socket, maxRequestBytes, async line => {
      try {
        const request = JSON.parse(line)
        if (!sameToken(request?.token, token)) throw bridgeError('unauthorized', 'Invalid local bridge token.')
        const call = (method, args) => gateway.invoke({ namespace: 'session', method, args, peer, signal })
        switch (request.op) {
          case 'turn-hook': {
            const output = channel.hook(request)
            live.closeInactive(request.threadId)
            return respond({ ok: true, value: output })
          }
          case 'send':
            return respond({ ok: true, value: await chat.send(request, call) })
          case 'receive-live':
          case 'ack-live': {
            const { sessionId, codexThreadId: threadId } = request
            if (!dshSessionId.test(sessionId) || !requestUuid.test(threadId)) throw bridgeError('invalid-address', '配对地址无效。')
            if (request.op === 'ack-live') {
              const value = await live.ack({ sessionId, threadId, turnId: request.turnId,
                messageId: request.messageId, claimId: request.claimId })
              return respond({ ok: true, value })
            }
            socket.setTimeout(0)
            const value = await live.receive({ sessionId, threadId }, signal, ready => {
              socket.write(JSON.stringify({ ready }) + '\n')
            }, message => {
              if (socket.destroyed || !socket.writable) throw bridgeError('connection-closed', '配对连接已关闭。')
              socket.write(JSON.stringify({ message }) + '\n')
            })
            return respond({ ok: true, value })
          }
          default:
            throw bridgeError('unknown-operation', '未知操作。')
        }
      } catch (error) {
        reject(error)
      }
    }, reject)
  })

  ctx.effect(() => () => {
    live.close()
    channel.close()
    for (const socket of sockets) socket.destroy()
    server.close()
    rmSync(temporary, { force: true })
    try {
      if (JSON.parse(readFileSync(endpoint, 'utf8')).pipe === pipe) rmSync(endpoint)
    } catch (error) {
      if (error.code !== 'ENOENT') ctx.logger('codex-bridge').warn('Could not remove the bridge endpoint: %s', error.message)
    }
  })

  mkdirSync(directory, { recursive: true, mode: 0o700 })
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(pipe, () => {
      server.off('error', reject)
      server.on('error', error => ctx.logger('codex-bridge').error(error))
      resolve()
    })
  })
  peer.signal.throwIfAborted()
  writeFileSync(temporary, JSON.stringify({ version: 1, pipe, token }), { flag: 'wx', mode: 0o600 })
  renameSync(temporary, endpoint)
}
