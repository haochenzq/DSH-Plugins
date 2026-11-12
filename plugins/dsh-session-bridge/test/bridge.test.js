import assert from 'node:assert/strict'
import { test } from 'node:test'
import { apply } from '../lib/index.js'

function registerTools(agents = [], config, get = () => undefined) {
  const tools = new Map()
  apply({
    tools: { register: tool => tools.set(tool.name, tool) },
    agents: { get: id => agents.find(agent => agent.id === id), list: () => agents },
    get,
    effect: () => {},
  }, config)
  return tools
}

function makeAgent(id, cwd = process.cwd()) {
  return {
    id,
    session: { header: { cwd } },
    received: [],
    injected: [],
    inbox: {
      nextStep: [],
      remove(id) { this.nextStep = this.nextStep.filter(message => message.id !== id) },
    },
    steer(message) {
      this.received.push(message)
      this.inbox.nextStep.push(message)
    },
    inject(message) {
      this.injected.push(message)
      this.inbox.nextStep.push(message)
    },
  }
}

test('bridge tools declare required parameters as arrays on the enclosing object', () => {
  const tools = registerTools()
  const requirements = {
    session_bridge_peers: [],
    session_bridge_send: ['session', 'message'],
    session_bridge_reply: ['message'],
    session_bridge_converse: ['target', 'objective'],
    session_bridge_finish: ['status'],
  }

  assert.equal(tools.size, Object.keys(requirements).length)
  for (const [name, required] of Object.entries(requirements)) {
    const { parameters } = tools.get(name)
    assert.deepEqual(parameters.required, required)
    for (const property of Object.values(parameters.properties)) {
      assert.equal(Object.hasOwn(property, 'required'), false)
    }
  }
})

test('peer output exposes the full ID, title, status and workspace of every result', () => {
  const { render } = registerTools().get('session_bridge_peers').output
  const items = [
    { id: 'session-test-a', title: '测试甲', cwd: process.cwd(), status: 'idle', sameWorkspace: true },
    { id: 'session-test-b', title: '测试乙\n第二行', cwd: 'other', status: 'running', sameWorkspace: false },
  ]
  const [summary, ...rows] = render({}, { items, total: 5, returned: 2 })[0].text.split('\n')
  assert.match(summary, /2 个（共 5 个候选）/)
  assert.deepEqual(rows.map(row => JSON.parse(row)), items)
  assert.match(render({}, { items: [], total: 0, returned: 0 })[0].text, /没有可对话的会话/)
})

test('a reply increments the incoming hop count and stops at the configured limit', async () => {
  const first = makeAgent('session-0f8841b0-70fa-4edb-beb2-0494b2a43f11')
  const second = makeAgent('session-22352f9a-622f-4f62-86b8-642d4a35578c')
  const tools = registerTools([first, second], { maxHops: 6 })
  const send = tools.get('session_bridge_send')
  const reply = tools.get('session_bridge_reply')

  const initial = await send.execute({ session: 'session-22352f9a', message: 'hello' }, { agent: first })
  assert.equal(initial.hops, 1)
  assert.equal(initial.sessionId, second.id)
  assert.equal(initial.shortId, 'session-22352f9a')
  assert.match(send.output.render({}, initial)[0].text, /session-22352f9a/)
  const [incoming] = second.received
  assert.equal(incoming.role, 'user')
  assert.equal(incoming.source.kind, 'session-bridge')
  assert.equal(incoming.source.senderSessionId, first.id)
  assert.match(incoming.content[0].text, /"shortId":"session-0f8841b0"/)
  assert.match(incoming.content[0].text, /^\[SESSION BRIDGE MESSAGE\][\s\S]+\nhello$/)
  for (let hops = 2; hops <= 6; hops++) {
    const sender = hops % 2 === 0 ? second : first
    const recipient = hops % 2 === 0 ? first : second
    const result = await reply.execute({ message: 'ack' }, { agent: sender })
    assert.equal(result.sessionId, recipient.id)
    assert.equal(result.hops, hops)
    const message = recipient.received.at(-1)
    assert.equal(message.source.hops, hops)
    assert.equal(message.source.senderSessionId, sender.id)
    assert.match(message.content[0].text, /\nack$/)
  }
  await assert.rejects(reply.execute({ message: 'ack' }, { agent: first }), /6 跳上限/)
  assert.equal(second.received.length, 3)
})

test('plain messages cross workspaces by default and report the destination workspace boundary', async () => {
  const first = makeAgent('session-test-a')
  const second = makeAgent('session-test-b', first.session.header.cwd + '-other')
  const send = registerTools([first, second]).get('session_bridge_send')
  const result = await send.execute({ session: second.id, message: 'hello' }, { agent: first })

  assert.equal(result.sameWorkspace, false)
  assert.equal(result.maxHops, 0)
  assert.match(send.output.render({}, result)[0].text, /跨工作区.*跳数 1$/)
  assert.match(second.received[0].content[0].text, /^hop: 1$/m)
})

test('an explicit workspace guard rejects delivery to a different workspace', async () => {
  const first = makeAgent('session-test-a')
  const second = makeAgent('session-test-b', first.session.header.cwd + '-other')
  const send = registerTools([first, second], { requireSameWorkspace: true }).get('session_bridge_send')

  await assert.rejects(
    send.execute({ session: second.id, message: 'hello' }, { agent: first }),
    /不在同一工作区/,
  )
  assert.equal(second.received.length, 0)
})

test('wakeTarget false injects the message without steering or waking the recipient', async () => {
  const first = makeAgent('session-test-a')
  const second = makeAgent('session-test-b')
  const send = registerTools([first, second], { wakeTarget: false }).get('session_bridge_send')

  await send.execute({ session: second.id, message: 'hello' }, { agent: first })
  assert.equal(second.received.length, 0)
  assert.equal(second.injected.length, 1)
  assert.match(second.injected[0].content[0].text, /\nhello$/)
})

test('a cross-workspace collaboration pins both peers and continues without a hop or rate limit', async () => {
  const first = makeAgent('session-test-a')
  const second = makeAgent('session-test-b', first.session.header.cwd + '-other')
  const unrelated = makeAgent('session-test-c')
  const tools = registerTools([first, second, unrelated], { maxHops: 1, maxSendsPerMinute: 1 })
  const converse = tools.get('session_bridge_converse')
  const reply = tools.get('session_bridge_reply')
  const finish = tools.get('session_bridge_finish')

  const start = await converse.execute({ target: second.id, objective: '核对两份测试清单' }, { agent: first })
  const { collaborationId } = start
  assert.equal(start.sameWorkspace, false)
  assert.equal(start.hops, 1)
  const header = second.received[0].content[0].text.split('\n').find(line => line.startsWith('collaboration: '))
  assert.deepEqual(JSON.parse(header.slice('collaboration: '.length)), {
    id: collaborationId, objective: '核对两份测试清单', status: 'active',
  })
  await assert.rejects(reply.execute({ collaborationId, message: 'outside' }, { agent: unrelated }), /没有该活动协作/)
  await assert.rejects(reply.execute({ collaborationId, session: unrelated.id, message: 'redirect' }, { agent: second }), /不是该协作的另一方/)
  await assert.rejects(finish.execute({ collaborationId, status: 'stopped' }, { agent: unrelated }), /没有该活动协作/)
  const automatic = await reply.execute({ message: 'first contribution' }, { agent: second })
  assert.equal(automatic.collaborationId, collaborationId)
  assert.equal(automatic.hops, 2)

  for (let hops = 3; hops <= 140; hops++) {
    const sender = hops % 2 === 0 ? second : first
    const recipient = hops % 2 === 0 ? first : second
    const result = await reply.execute({ collaborationId, message: `progress ${hops}` }, { agent: sender })
    assert.equal(result.hops, hops)
    assert.equal(result.sessionId, recipient.id)
    assert.equal(result.maxHops, 0)
  }
  const result = await finish.execute({ collaborationId, status: 'done', summary: '核对完成' }, { agent: first })
  assert.equal(result.notified, true)
  assert.equal(second.received.at(-1).source.collaborationStatus, 'done')
  assert.equal(second.inbox.nextStep.length, 1)
  await assert.rejects(reply.execute({ collaborationId, message: 'again' }, { agent: second }), /已结束/)
  await assert.rejects(reply.execute({ message: 'again' }, { agent: second }), /已结束/)
})

test('blocked and stopped collaborations close before any further replies', async () => {
  const first = makeAgent('session-test-a')
  const second = makeAgent('session-test-b')
  const tools = registerTools([first, second])
  const converse = tools.get('session_bridge_converse')
  const reply = tools.get('session_bridge_reply')
  const finish = tools.get('session_bridge_finish')
  const send = tools.get('session_bridge_send')
  await send.execute({ session: second.id, message: 'unrelated' }, { agent: first })
  const blocked = await converse.execute({ target: second.id, objective: '权限测试' }, { agent: first })
  const result = await finish.execute({ status: 'blocked', summary: '需要用户提供样例' }, { agent: second })
  assert.equal(result.collaborationId, blocked.collaborationId)
  assert.equal(result.status, 'blocked')
  assert.equal(first.received.at(-1).source.collaborationStatus, 'blocked')
  assert.match(first.received.at(-1).content[0].text, /需要用户提供样例$/)

  const stopped = await converse.execute({ target: second.id, objective: '停止测试' }, { agent: first })
  const wakeCount = second.received.length
  await finish.execute({ collaborationId: stopped.collaborationId, status: 'stopped' }, { agent: first })
  assert.equal(second.received.length, wakeCount)
  assert.equal(second.injected.at(-1).source.collaborationStatus, 'stopped')
  assert.equal(second.inbox.nextStep.filter(message => message.source.collaborationId === stopped.collaborationId).length, 1)
  assert.ok(second.inbox.nextStep.some(message => message.content[0].text.endsWith('\nunrelated')))
  await assert.rejects(reply.execute({ collaborationId: stopped.collaborationId, message: 'again' }, { agent: second }), /已结束/)
})

test('stopping a collaboration prevents a concurrent reply from reaching its peer', async () => {
  const first = makeAgent('session-test-a')
  const second = makeAgent('session-test-b')
  const gate = Promise.withResolvers()
  let holdTitle = false
  const tools = registerTools([first, second], {}, name => name === 'sessionQuery' ? {
    async readTitle(id) {
      if (holdTitle && id === second.id) await gate.promise
    },
  } : undefined)
  const start = await tools.get('session_bridge_converse').execute({ target: second.id, objective: '并发停止' }, { agent: first })
  holdTitle = true
  const pending = tools.get('session_bridge_reply').execute({ collaborationId: start.collaborationId, message: 'late' }, { agent: second })
  const rejected = assert.rejects(pending, /已结束/)
  const stopping = tools.get('session_bridge_finish').execute({ status: 'stopped' }, { agent: first })
  gate.resolve()
  await stopping
  await rejected
  assert.equal(first.received.length, 0)
})
