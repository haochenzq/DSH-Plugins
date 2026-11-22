import assert from 'node:assert/strict'
import test from 'node:test'
import { createDshTurnGuard } from './dsh-turn-guard.js'

const uuid = '00000000-0000-4000-b000-000000000001'

function fixture() {
  const listeners = new Map()
  const events = []
  const agent = { status: 'running', session: {
    get seq() { return events.length }, inheritedEventCount: 0, snapshotEvents: (start, end) => events.slice(start, end),
  } }
  const boundary = { lastTurn: 3, openTurnStartSeq: 32 }
  const controller = new AbortController()
  const bind = createDshTurnGuard({
    on: (name, cb) => listeners.set(name, cb),
    agents: { get: () => agent, turnBoundaryOf: () => boundary },
  })
  const observe = (event, turn = boundary.lastTurn) =>
    listeners.get(event)({ agent, turn, signal: controller.signal }, () => 'continue')
  return { agent, boundary, controller, events, observe, bind: () => bind('session-1', uuid) }
}

test('DSH guard rejects a canceled or stopping turn and preserves ordinary idle wake', () => {
  const f = fixture()
  assert.equal(f.observe('agent/pre-step'), 'continue')
  const admission = f.bind()
  assert.equal(admission(), false)
  f.controller.abort()
  assert.throws(admission, { code: 'dsh-turn-closing' })
  assert.throws(f.bind(), { code: 'dsh-turn-closing' })
  f.agent.status = 'idle'
  assert.equal(f.bind()(), false)
  assert.throws(admission, { code: 'dsh-turn-closing' })
})

test('DSH guard pins a running turn across asynchronous routing or attachment preparation', () => {
  const f = fixture()
  f.observe('agent/pre-step')
  const admission = f.bind()
  f.observe('agent/turn-stopping')
  assert.throws(admission, { code: 'dsh-turn-closing' })
  const stopping = f.bind()
  f.observe('agent/pre-step')
  assert.equal(admission(), false)
  assert.throws(stopping, { code: 'dsh-turn-closing' })
  f.boundary.lastTurn++
  f.boundary.openTurnStartSeq++
  assert.throws(admission, { code: 'dsh-turn-closing' })
  assert.equal(f.bind()(), false)
})

test('DSH guard returns the original acceptance on retry while the same turn is closing', () => {
  const f = fixture()
  f.observe('agent/turn-stopping')
  f.events.push({ seq: 0, type: 'agent/inbox/spliced', data: { inserted: [{ source: { kind: 'user', rpcId: 'codex-bridge:' + uuid } }] } })
  assert.equal(f.bind()(), true)
  f.agent.session.inheritedEventCount = 1
  assert.throws(f.bind(), { code: 'dsh-turn-closing' })
})
