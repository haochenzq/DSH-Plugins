import { bridgeError, requestPrefix, requestUuid } from './protocol.js'

export function createDshTurnGuard(ctx) {
  const phases = new WeakMap()

  ctx.on('agent/pre-step', ({ agent, turn, signal }, next) => {
    phases.set(agent, { turn, signal, stopping: false })
    return next()
  })
  ctx.on('agent/turn-stopping', ({ agent, turn, signal }) => {
    phases.set(agent, { turn, signal, stopping: true })
  })

  function running(sessionId) {
    const agent = ctx.agents.get(sessionId)
    if (agent?.status !== 'running') return null
    const { lastTurn: turn, openTurnStartSeq: start } = ctx.agents.turnBoundaryOf(agent.session)
    const phase = phases.get(agent)
    const observed = phase?.turn === turn
    if (start == null && !observed) return null
    return { agent, turn, start, closing: start == null || (observed && (phase.stopping || phase.signal.aborted)) }
  }

  // The public prompt method returns accepted for every previously admitted request ID,
  // including one whose pending input was subsequently removed by the user.
  function alreadyAccepted(session, requestId) {
    const rpcId = requestPrefix + requestId.toLowerCase()
    for (let end = session.seq; end > 0; end -= 500) {
      const start = Math.max(0, end - 500)
      if (session.snapshotEvents(start, end).some(event => {
        if (event.seq < session.inheritedEventCount) return false
        const inputs = event.type === 'agent/inbox/spliced' ? event.data.inserted :
          event.type === 'user/message' ? [event.data] : []
        return inputs.some(input => input.source?.kind === 'user' && input.source.rpcId === rpcId)
      })) return true
    }
    return false
  }

  return function bind(sessionId, requestId) {
    const original = running(sessionId)
    return () => {
      const current = running(sessionId)
      const changed = original && (current?.agent !== original.agent || current.turn !== original.turn || current.start !== original.start)
      if (!original?.closing && !changed && !current?.closing) return false
      const session = (original ?? current).agent.session
      if (requestUuid.test(requestId) && alreadyAccepted(session, requestId)) return true
      throw bridgeError('dsh-turn-closing', 'The selected DSH turn is closing, canceled, or has ended. This request was not submitted to the next turn.')
    }
  }
}
