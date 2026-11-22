import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addUsage, emptyDocument, KEEP_DAYS, localDayKey, normalizeDocument, normalizeUsage, providerFamily,
  isOffPeak, pruneDays, summarize,
} from '../lib/store.js';

test('localDayKey uses local calendar date', () => {
  const date = new Date(2026, 10, 12, 23, 59, 0);
  assert.equal(localDayKey(date), '2026-11-12');
});

test('normalizeUsage accepts DSH TokenUsage with disjoint buckets', () => {
  const usage = normalizeUsage({ inputTokens: 100, outputTokens: 40, cacheReadTokens: 30, cacheWriteTokens: 5, reasoningTokens: 9 });
  assert.deepEqual(usage, { input: 100, output: 40, cached: 30, cacheWrite: 5, reasoning: 9, requests: 1 });
});

test('normalizeUsage converts OpenAI native usage by subtracting cached input', () => {
  const usage = normalizeUsage({
    input_tokens: 1000,
    output_tokens: 200,
    input_tokens_details: { cached_tokens: 600 },
    output_tokens_details: { reasoning_tokens: 80 },
  });
  assert.equal(usage.input, 400);
  assert.equal(usage.cached, 600);
  assert.equal(usage.output, 200);
  assert.equal(usage.reasoning, 80);
});

test('normalizeUsage rejects empty or invalid samples', () => {
  assert.equal(normalizeUsage(null), null);
  assert.equal(normalizeUsage({ inputTokens: 0, outputTokens: 0 }), null);
  assert.equal(normalizeUsage({ inputTokens: -5 }), null);
});

test('providerFamily groups DeepSeek routes and OpenAI', () => {
  assert.equal(providerFamily('deepseek-account'), 'deepseek');
  assert.equal(providerFamily('deepseek-official'), 'deepseek');
  assert.equal(providerFamily('openai'), 'openai');
  assert.equal(providerFamily('relay'), 'other');
  assert.equal(providerFamily(undefined), 'other');
});

test('addUsage folds provider and model buckets', () => {
  const doc = emptyDocument();
  const at = new Date(2026, 10, 12, 10, 0, 0);
  addUsage(doc, 'deepseek-account', 'deepseek-flash', { inputTokens: 10, outputTokens: 5 }, at);
  addUsage(doc, 'deepseek-account', 'deepseek-flash', { inputTokens: 1, outputTokens: 2, cacheReadTokens: 3 }, at);
  addUsage(doc, 'openai', 'gpt-6-astra', { inputTokens: 7, outputTokens: 1 }, at);
  const day = doc.days['2026-11-12'];
  assert.equal(day.input, 18);
  assert.equal(day.providers['deepseek-account'].input, 11);
  assert.equal(day.providers.openai.input, 7);
  assert.equal(day.models['deepseek-account|deepseek-flash'].requests, 2);
  assert.equal(day.models['openai|gpt-6-astra'].input, 7);
  assert.equal(doc.updatedAt, at.toISOString());
});

test('pruneDays keeps the newest entries only', () => {
  const doc = emptyDocument();
  for (let index = 0; index < KEEP_DAYS + 5; index += 1) {
    const date = new Date(2025, 0, 1 + index);
    doc.days[localDayKey(date)] = { input: 1, output: 0, cached: 0, cacheWrite: 0, reasoning: 0, requests: 1, providers: {}, models: {} };
  }
  pruneDays(doc);
  assert.equal(Object.keys(doc.days).length, KEEP_DAYS);
  const keys = Object.keys(doc.days).sort();
  assert.equal(keys[keys.length - 1], localDayKey(new Date(2025, 0, 1 + KEEP_DAYS + 4)));
});

test('summarize splits families and totals', () => {
  const doc = emptyDocument();
  const now = new Date(2026, 10, 12, 12, 0, 0);
  addUsage(doc, 'deepseek-account', 'deepseek-flash', { inputTokens: 100, outputTokens: 10 }, now);
  addUsage(doc, 'deepseek-official', 'deepseek-v4-pro', { inputTokens: 30, outputTokens: 3 }, new Date(2026, 10, 10, 9, 0, 0));
  addUsage(doc, 'openai', 'gpt-6-astra', { inputTokens: 7, outputTokens: 1 }, now);
  addUsage(doc, 'relay', 'some-model', { inputTokens: 5, outputTokens: 1 }, now);
  addUsage(doc, 'openai', 'gpt-6-astra', { inputTokens: 50, outputTokens: 5 }, new Date(2026, 9, 1, 9, 0, 0));

  const summary = summarize(doc, now);
  assert.equal(summary.today.input, 112, 'today includes deepseek, openai and other');
  assert.equal(summary.families.deepseek.today.input, 100);
  assert.equal(summary.families.deepseek.last7.input, 130);
  assert.equal(summary.families.deepseek.allTime.input, 130);
  assert.equal(summary.families.openai.today.input, 7);
  assert.equal(summary.families.openai.allTime.input, 57);
  assert.equal(summary.families.other.today.input, 5);
  assert.equal(summary.families.deepseek.days.length, 30);
  assert.deepEqual(summary.families.deepseek.models.map((m) => m.model), ['deepseek-flash', 'deepseek-v4-pro']);
  assert.equal(summary.families.openai.models.length, 1, 'model outside 30 days is not listed');
});

test('migrates schema 1 documents into the openai family', () => {
  const doc = normalizeDocument({
    schemaVersion: 1,
    updatedAt: '2026-11-12T00:00:00.000Z',
    days: {
      '2026-11-12': { input: 11, output: 5, requests: 1, models: { 'gpt-6-luna': { input: 11, output: 5, requests: 1 } } },
    },
    balance: { amountUsd: 1.21, capturedAt: '2026-11-12T11:23:14.732Z' },
    admin: null,
  });
  assert.equal(doc.schemaVersion, 2);
  assert.equal(doc.days['2026-11-12'].providers.openai.input, 11);
  assert.equal(doc.days['2026-11-12'].models['openai|gpt-6-luna'].output, 5);
  assert.equal(doc.balance.amountUsd, 1.21);
  const summary = summarize(doc, new Date(2026, 10, 12, 12, 0, 0));
  assert.equal(summary.families.openai.today.input, 11);
  assert.equal(summary.families.deepseek.today.input, 0);
});

test('normalizeDocument rejects unknown schema and keeps valid data', () => {
  assert.equal(Object.keys(normalizeDocument({ schemaVersion: 99 }).days).length, 0);
  const doc = normalizeDocument({
    schemaVersion: 2,
    days: {
      '2026-11-12': {
        input: 3, output: 1, requests: 1,
        providers: { 'deepseek-account': { input: 3, output: 1, requests: 1 } },
        models: { 'deepseek-account|deepseek-flash': { input: 3, output: 1, requests: 1 } },
      },
    },
    balance: { amountUsd: 12.5, capturedAt: '2026-11-12T00:00:00.000Z' },
    admin: null,
  });
  assert.equal(doc.days['2026-11-12'].providers['deepseek-account'].input, 3);
  assert.equal(doc.days['2026-11-12'].models['deepseek-account|deepseek-flash'].output, 1);
  assert.equal(doc.balance.amountUsd, 12.5);
  assert.equal(doc.admin, null);
});

test('normalizeDocument keeps official daily series and model rows', () => {
  const doc = normalizeDocument({
    schemaVersion: 2,
    days: {},
    admin: {
      lastSync: '2026-11-12T11:37:15.000Z',
      error: null,
      monthCostUsd: 1.5,
      monthInputTokens: 10,
      monthOutputTokens: 5,
      monthRequests: 2,
      costDays: [{ date: '2026-11-12', costUsd: 1.5 }, { date: 'bad', costUsd: 9 }],
      usageDays: [{ date: '2026-11-12', inputTokens: 10, outputTokens: 5, cachedTokens: 4, requests: 2 }],
      models: [{ model: 'gpt-6-astra', inputTokens: 10, outputTokens: 5, cachedTokens: 4, requests: 2 }],
    },
  });
  assert.equal(doc.admin.costDays.length, 1);
  assert.equal(doc.admin.costDays[0].costUsd, 1.5);
  assert.equal(doc.admin.usageDays[0].cachedTokens, 4);
  assert.equal(doc.admin.models[0].model, 'gpt-6-astra');
});

test('isOffPeak follows the configured window', () => {
  const day = (h, m) => new Date(2026, 10, 12, h, m);
  assert.equal(isOffPeak(day(0, 29)), false);
  assert.equal(isOffPeak(day(0, 30)), true);
  assert.equal(isOffPeak(day(8, 29)), true);
  assert.equal(isOffPeak(day(8, 30)), false);
  assert.equal(isOffPeak(day(19, 0)), false);
  assert.equal(isOffPeak(day(0, 10), { start: '22:00', end: '06:00' }), true);
});

test('addUsage splits DeepSeek peak and off-peak bands only for DeepSeek', () => {
  const doc = emptyDocument();
  addUsage(doc, 'deepseek-account', 'deepseek-flash', { inputTokens: 10 }, new Date(2026, 10, 12, 3, 0));
  addUsage(doc, 'deepseek-account', 'deepseek-flash', { inputTokens: 20 }, new Date(2026, 10, 12, 10, 0));
  addUsage(doc, 'openai', 'gpt-6-astra', { inputTokens: 5 }, new Date(2026, 10, 12, 3, 0));
  const day = doc.days['2026-11-12'];
  assert.equal(day.bands.offpeak.input, 10);
  assert.equal(day.bands.peak.input, 20);
  assert.equal(day.input, 35);
  const summary = summarize(doc, new Date(2026, 10, 12, 12, 0));
  assert.equal(summary.families.deepseek.bands.last30.offpeak.input, 10);
  assert.equal(summary.families.deepseek.bands.last30.peak.input, 20);
  assert.equal(summary.families.deepseek.bands.allTime.offpeak.input, 10);
});

test('summarize places each day bucket at its own ascending series slot', () => {
  const doc = emptyDocument();
  const now = new Date(2026, 10, 12, 12, 0, 0);
  addUsage(doc, 'deepseek-account', 'deepseek-flash', { inputTokens: 42 }, now);
  addUsage(doc, 'deepseek-account', 'deepseek-flash', { inputTokens: 7 }, new Date(2026, 10, 10, 9, 0, 0));
  const summary = summarize(doc, now);
  const days = summary.families.deepseek.days;
  assert.equal(days.length, 30);
  assert.equal(days[0].date, '2026-10-14', 'series starts 30 days before today');
  assert.equal(days[0].input, 0, 'oldest slot must not receive today usage');
  assert.equal(days[days.length - 1].date, '2026-11-12');
  assert.equal(days[days.length - 1].input, 42, 'today bucket lands in the last slot');
  assert.equal(days[days.length - 3].input, 7, 'earlier day keeps its own slot');
  assert.equal(summary.families.deepseek.last30.input, 49);
});
