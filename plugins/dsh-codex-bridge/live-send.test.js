import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import test from 'node:test'
import { sendText } from './live-send.js'

const sessionId = 'session-test', threadId = randomUUID(), turnId = randomUUID()
const address = { sessionId, threadId, turnId, receiverId: randomUUID() }

test('send emits original path text only after confirmed acceptance; uncertain submission is never repeated', async () => {
  const req = { op: 'send', sessionId, requestId: randomUUID(), text: '  文档\nD:\\a b\\报告.md  ' }
  const rows = []
  let sends = 0
  await sendText(req, async input => { assert.deepEqual(input, req); return { accepted: true } }, line => rows.push(JSON.parse(line)))
  assert.equal(rows[0].body, req.text)
  await assert.rejects(sendText(req, async () => { sends++; return {} }, assert.fail), { code: 'dsh-delivery-unknown' })
  assert.equal(sends, 1)
})

test('unconfirmed pair never emits a paired event', async () => {
  for (const receipt of [{ accepted: true, paired: false }, { accepted: true, paired: true, codexThreadId: randomUUID() }]) {
    await assert.rejects(sendText({ sessionId }, async () => receipt, assert.fail, { binding: address, signal: new AbortController().signal }),
      { code: 'pair-unconfirmed' })
  }
})
