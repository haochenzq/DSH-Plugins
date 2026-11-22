import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { balanceEstimate, costStartUnix, fetchCostTotal } from '../lib/balance.js';
import { normalizeDocument } from '../lib/store.js';
import { apply } from '../lib/index.js';

const bucket = value => ({ results: [{ amount: { value, currency: 'usd' } }] });

test('uses UTC day and subtracts snapshot baseline, including negative adjustments', () => {
  assert.equal(costStartUnix('2026-11-15T00:30:00+08:00'), Date.parse('2026-11-14T00:00:00Z') / 1000);
  assert.deepEqual(balanceEstimate({ amountUsd: 200, baselineCostUsd: 15, latestCostUsd: 20, costSyncedAt: 'now' }), { amountUsd: 195, spentUsd: 5, lastSync: 'now', error: null });
  assert.equal(balanceEstimate({ amountUsd: 200, baselineCostUsd: 15, latestCostUsd: 14 }).amountUsd, 201);
  assert.equal(balanceEstimate({ amountUsd: 200 }), null);
});

test('fetches every Costs page with the original UTC-day start, including a month boundary', async () => {
  const start = costStartUnix('2026-10-31T23:00:00Z');
  const calls = [];
  const result = await fetchCostTotal(async url => {
    const params = new URL(url).searchParams;
    calls.push(params);
    return params.has('page') ? { data: [bucket(8)], has_more: false } : { data: [bucket(12)], has_more: true, next_page: 'next' };
  }, 'test-key', start);
  assert.equal(result, 20);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].get('start_time'), String(start));
  assert.equal(calls[1].get('page'), 'next');
});

test('rejects invalid pages and non-USD amounts instead of reporting a false balance', async () => {
  await assert.rejects(fetchCostTotal(async () => ({ data: [], has_more: true, next_page: '' }), 'x', 0), /分页/);
  await assert.rejects(fetchCostTotal(async () => ({ data: [{ results: [{ amount: { value: 5, currency: 'eur' } }] }] }), 'x', 0), /币种/);
  await assert.rejects(fetchCostTotal(async () => ({ data: [{ results: [{ amount: { value: null, currency: 'usd' } }] }] }), 'x', 0), /金额/);
});

test('persists baseline and leaves legacy snapshots unestimated', () => {
  const base = { schemaVersion: 2, days: {}, balance: { amountUsd: 200, capturedAt: '2026-11-15T00:00:00Z', baselineCostUsd: 15, latestCostUsd: 20, costSyncedAt: '2026-11-15T01:00:00Z', costError: 'failed' } };
  const loaded = normalizeDocument(JSON.parse(JSON.stringify(base)));
  assert.equal(balanceEstimate(loaded.balance).amountUsd, 195);
  assert.equal(balanceEstimate(loaded.balance).error, 'failed');
  delete base.balance.baselineCostUsd;
  assert.equal(balanceEstimate(normalizeDocument(base).balance), null);
});

test('routes capture baseline, update on refresh, and preserve stale estimate on failure', async t => {
  const home = await mkdtemp(join(tmpdir(), 'dsh-balance-test-'));
  const previousHome = process.env.DSH_HOME;
  process.env.DSH_HOME = home;
  t.after(async () => { if (previousHome === undefined) delete process.env.DSH_HOME; else process.env.DSH_HOME = previousHome; await rm(home, { recursive: true, force: true }); });
  let cost = 15;
  let failed = false;
  const credentials = { resolve: () => ({ value: 'test-admin-key' }), describe: () => ({ configured: true }) };
  t.mock.method(globalThis, 'fetch', async url => {
    if (String(url).includes('/organization/costs')) return failed ? Response.json({ error: { message: 'test failure' } }, { status: 503 }) : Response.json({ data: [bucket(cost)], has_more: false });
    return Response.json({ data: [] });
  });
  const routes = new Map();
  apply({ connection: { fetch: { register: route => routes.set(route.path.split('/').at(-1), route) } }, get: () => credentials, on: () => {}, provide: () => {}, effect: () => {} });
  const call = async (name, body) => {
    const response = await routes.get(name).fetch(new Request('http://localhost', { method: body === undefined ? 'GET' : 'POST', body: body === undefined ? undefined : JSON.stringify(body) }));
    return { status: response.status, json: await response.json() };
  };
  let result = await call('balance', { amountUsd: 200 });
  assert.equal(result.status, 200);
  assert.equal(result.json.balanceEstimate.amountUsd, 200);
  cost = 20;
  result = await call('refresh-admin', {});
  assert.equal(result.json.balanceEstimate.amountUsd, 195);
  failed = true;
  result = await call('refresh-admin', {});
  assert.equal(result.json.balanceEstimate.amountUsd, 195);
  assert.match(result.json.balanceEstimate.error, /503/);
  result = await call('balance', { amountUsd: 100 });
  assert.equal(result.status, 400);
  assert.match(result.json.error, /503/);
  assert.equal((await call('summary')).json.balanceEstimate.amountUsd, 195, 'failed recalibration preserves the previous estimate');
  // Concurrent explicit saves serialize their writes to the shared temporary file.
  failed = false;
  const concurrent = await Promise.all(Array.from({ length: 8 }, (_, index) => call('balance', { amountUsd: 100 + index })));
  assert.ok(concurrent.every(item => item.status === 200));
  // Clearing triggers an immediate flush and cancels the debounce timer.
  result = await call('balance', { amountUsd: null });
  assert.equal(result.status, 200);
  const saved = JSON.parse(await readFile(join(home, 'openai-usage', 'usage.json'), 'utf8'));
  assert.equal(saved.balance, null);
});
