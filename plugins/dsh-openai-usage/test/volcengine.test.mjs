import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { apply } from '../lib/index.js';
import { createVolcOverview, parseArkUsage, parseMediaBills, signVolcRequest, VOLC_IAM_CREDENTIAL } from '../lib/volcengine.js';

test('matches a fixed balance request signature with synthetic credentials', () => {
  const request = signVolcRequest({
    host: 'billing.volcengineapi.com', service: 'billing', action: 'QueryBalanceAcct', version: '2022-01-01',
  }, {
    accessKey: 'example-accessKey-for-offline-tests',
    secretKey: 'example-secretKey-for-offline-tests',
  }, new Date('2025-03-29T18:09:37Z'));
  assert.match(request.options.headers.authorization, /Signature=2e72fe6f486ae5f185691d88186982c0da01e10108e80a26e93ef8efd22f8cb8$/);
});

test('uses the published field order to aggregate official Ark model and day totals', () => {
  const payload = {
    Fields: ['ReqCnt', 'OutputTokens', 'Day', 'ModelName', 'InputTokens'].map(Name => ({ Name })),
    Data: [['1', '20', '2026-11-09', 'doubao', '100'], ['2', '25', '2026-11-09', 'doubao', '200']],
    DataCount: 2,
  };
  const result = parseArkUsage(payload);
  assert.equal(result.input, 300);
  assert.equal(result.output, 45);
  assert.equal(result.requests, 3);
  assert.equal(result.days[0].input, 300);
  assert.equal(result.models[0].model, 'doubao');
  assert.equal(parseArkUsage({ DataCount: 0 }).requests, 0);
  assert.throws(() => parseArkUsage({ ...payload, Fields: [] }), /格式异常/);
});

test('preserves distinct MediaKit and Speech units and genuine zero usage', () => {
  const usage = parseMediaBills([
    { ProductZh: 'AI MediaKit', Element: '转码', Count: '0.5', Unit: '分钟', PayableAmount: '0.02' },
    { ProductZh: 'AI MediaKit', Element: '转码', Count: '0.5', Unit: '分钟', PayableAmount: '0.03' },
    { ProductZh: 'AI MediaKit', Element: '转码', Count: '4', Unit: '次', PayableAmount: '0' },
    { Product: 'speech_saas_prod', Element: '识别', Count: '0', Unit: '小时', PayableAmount: '0' },
    { ProductZh: '对象存储', Count: '30', Unit: 'GB' },
  ]);
  assert.deepEqual(usage.map(row => [row.product, row.unit, row.quantity, row.amount]), [
    ['AI MediaKit', '分钟', 1, 0.05],
    ['AI MediaKit', '次', 4, 0],
    ['豆包语音', '小时', 0, 0],
  ]);
});

test('caches successful queries independently and coalesces concurrent refreshes', async mock => {
  let denyBalance = false;
  const fetchMock = mock.mock.method(globalThis, 'fetch', async url => {
    const action = new URL(url).searchParams.get('Action');
    if (action === 'QueryBalanceAcct') {
      return denyBalance
        ? Response.json({ ResponseMetadata: { Error: { Code: 'AccessDenied', Message: 'sensitive' } } }, { status: 403 })
        : Response.json({ Result: { AvailableBalance: '0' } });
    }
    if (action === 'GetInferenceUsage') return Response.json({ Result: { DataCount: 0 } });
    return Response.json({ Result: { Total: 0 } });
  });
  const overview = createVolcOverview(async name => name === VOLC_IAM_CREDENTIAL
    ? JSON.stringify({ accessKey: 'test-access', secretKey: 'test-secret' }) : null);
  const [first, second] = await Promise.all([overview.refresh(), overview.refresh(true)]);
  assert.equal(first, second);
  assert.equal(first.balance.value, 0);
  assert.equal(first.ark.value.input, 0);
  assert.deepEqual(first.media.value, []);
  await overview.refresh();
  assert.equal(fetchMock.mock.callCount(), 3);
  denyBalance = true;
  const refreshed = await overview.refresh(true);
  assert.equal(refreshed.balance.value, 0);
  assert.equal(refreshed.balance.error, '火山接口 HTTP 403 AccessDenied');
  assert.equal(refreshed.ark.error, undefined);
  assert.doesNotMatch(JSON.stringify(refreshed), /sensitive|test-access|test-secret/);
});

test('host routes save and clear IAM through the credential service', async t => {
  const home = await mkdtemp(join(tmpdir(), 'dsh-volc-usage-test-'));
  const previousHome = process.env.DSH_HOME;
  process.env.DSH_HOME = home;
  t.after(async () => {
    if (previousHome === undefined) delete process.env.DSH_HOME;
    else process.env.DSH_HOME = previousHome;
    await rm(home, { recursive: true, force: true });
  });
  const credentials = new Map();
  const routes = new Map();
  t.mock.method(globalThis, 'fetch', async url => {
    const action = new URL(url).searchParams.get('Action');
    return Response.json({ Result: action === 'QueryBalanceAcct' ? { AvailableBalance: '-0.5' }
      : action === 'GetInferenceUsage' ? { DataCount: 0 } : { Total: 0 } });
  });
  apply({
    connection: { fetch: { register: route => routes.set(route.path.split('/').at(-1), route) } },
    get: () => ({
      resolve: key => ({ value: credentials.get(key) }),
      set: (key, value) => credentials.set(key, value),
      unset: key => credentials.delete(key),
    }),
    on() {},
    provide() {},
    effect() {},
  });
  const call = (path, payload) => routes.get(path).fetch({ text: async () => JSON.stringify(payload) });
  assert.equal((await call('volcengine-iam', { accessKey: 'example-key' })).status, 400);
  const saved = await (await call('volcengine-iam', { accessKey: 'example-key', secretKey: 'example-secret' })).json();
  assert.equal(saved.balance.value, -0.5);
  assert.doesNotMatch(JSON.stringify(saved), /example-key|example-secret/);
  assert.equal(credentials.size, 1);
  await call('volcengine-iam', { clear: true });
  assert.equal(credentials.size, 0);
});
