// dsh-openai-usage: local AI token accounting (DeepSeek + OpenAI) plus optional
// official OpenAI (Admin API) spend data, exposed to the browser panel through
// the host routes below. Usage samples come from DSH's own LLM streams
// (`llm/stream` usage chunks) and from the local OpenAI access plugin through
// the `openAiUsage.record()` service this plugin provides.
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import {
  addUsage, emptyDocument, localDayKey, normalizeDocument, parseOffpeakWindow, providerFamily, pruneDays, summarize,
} from './store.js';
import { createVolcOverview, parseIam, VOLC_IAM_CREDENTIAL } from './volcengine.js';
import { balanceEstimate, costStartUnix, fetchCostTotal } from './balance.js';

export const name = 'openai-usage';
export const inject = ['llm', 'connection'];

const ADMIN_KEY_NAME = process.env.DSH_OPENAI_USAGE_ADMIN_KEY || 'OPENAI_ADMIN_API_KEY';
const ADMIN_REFRESH_MS = Math.max(1, Number(process.env.DSH_OPENAI_USAGE_ADMIN_REFRESH_MINUTES || 10)) * 60_000;
const SAVE_DEBOUNCE_MS = 800;
const OFFPEAK_WINDOW = parseOffpeakWindow(process.env.DSH_AI_USAGE_OFFPEAK);
const MAX_BODY_BYTES = 10_000;

function openAiError(payload, status) {
  const error = payload?.error;
  const detail = typeof error?.message === 'string' ? `: ${error.message}` : '';
  return `OpenAI Admin API 返回 HTTP ${status}${detail}`;
}

async function fetchJson(url, key, timeoutMs = 12_000) {
  const response = await fetch(url, {
    method: 'GET',
    redirect: 'error',
    signal: AbortSignal.timeout(timeoutMs),
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(openAiError(payload, response.status));
  }
  return response.json();
}

function monthStartUnix(now) {
  return Math.floor(new Date(now.getFullYear(), now.getMonth(), 1).getTime() / 1000);
}

function numeric(value) {
  return Number.isFinite(value) ? value : 0;
}

/** Parse Costs API day buckets into one cost row per local day. */
function parseCostDays(payload) {
  const days = [];
  for (const bucket of Array.isArray(payload?.data) ? payload.data : []) {
    let total = 0;
    for (const result of Array.isArray(bucket?.results) ? bucket.results : []) total += numeric(result?.amount?.value);
    const start = Number(bucket?.start_time);
    if (!Number.isFinite(start)) continue;
    days.push({ date: localDayKey(new Date(start * 1000)), costUsd: Math.round(total * 1e6) / 1e6 });
  }
  return days.sort((left, right) => left.date.localeCompare(right.date));
}

/** Parse usage/completions day buckets into daily rows and per-model totals. */
function parseUsageSeries(payload) {
  const days = new Map();
  const models = new Map();
  for (const bucket of Array.isArray(payload?.data) ? payload.data : []) {
    const start = Number(bucket?.start_time);
    const day = Number.isFinite(start) ? localDayKey(new Date(start * 1000)) : null;
    for (const result of Array.isArray(bucket?.results) ? bucket.results : []) {
      const input = numeric(result?.input_tokens);
      const output = numeric(result?.output_tokens);
      const cached = numeric(result?.input_cached_tokens);
      const requests = numeric(result?.num_model_requests);
      if (day !== null) {
        if (!days.has(day)) days.set(day, { date: day, inputTokens: 0, outputTokens: 0, cachedTokens: 0, requests: 0 });
        const row = days.get(day);
        row.inputTokens += input; row.outputTokens += output; row.cachedTokens += cached; row.requests += requests;
      }
      const model = typeof result?.model === 'string' && result.model !== '' ? result.model : null;
      if (model !== null) {
        if (!models.has(model)) models.set(model, { model, inputTokens: 0, outputTokens: 0, cachedTokens: 0, requests: 0 });
        const row = models.get(model);
        row.inputTokens += input; row.outputTokens += output; row.cachedTokens += cached; row.requests += requests;
      }
    }
  }
  return {
    days: [...days.values()].sort((left, right) => left.date.localeCompare(right.date)),
    models: [...models.values()]
      .sort((left, right) => (right.inputTokens + right.outputTokens) - (left.inputTokens + left.outputTokens))
      .slice(0, 20),
  };
}

export function apply(ctx) {
  const home = process.env.DSH_HOME || join(process.env.USERPROFILE || homedir(), '.dsh');
  const dataFile = join(home, 'openai-usage', 'usage.json');
  let doc = emptyDocument();
  let loaded = null;
  let saveTimer = null;
  let saveQueue = Promise.resolve();
  let adminOperation = null;
  let balanceOperation = null;
  let balanceLastAttempt = 0;

  const load = async () => {
    await mkdir(dirname(dataFile), { recursive: true });
    try {
      const raw = await readFile(dataFile, 'utf8');
      doc = normalizeDocument(JSON.parse(raw));
    } catch (error) {
      if (error?.code !== 'ENOENT') ctx.logger?.('openai-usage')?.warn?.(`读取用量数据失败，将以空数据启动：${error.message}`);
      doc = emptyDocument();
    }
    return doc;
  };
  loaded ??= load();

  const saveNow = () => {
    if (saveTimer !== null) { clearTimeout(saveTimer); saveTimer = null; }
    const operation = saveQueue.then(async () => {
      const text = JSON.stringify({ ...doc, updatedAt: doc.updatedAt ?? new Date().toISOString() }, null, 2);
      const temp = `${dataFile}.tmp`;
      await writeFile(temp, text + '\n', 'utf8');
      await rename(temp, dataFile);
    });
    saveQueue = operation.catch(() => undefined);
    return operation;
  };
  const scheduleSave = () => {
    if (saveTimer !== null) return;
    saveTimer = setTimeout(() => {
      saveTimer = null;
      saveNow().catch(error => ctx.logger?.('openai-usage')?.warn?.(`保存用量数据失败：${error.message}`));
    }, SAVE_DEBOUNCE_MS);
    saveTimer.unref?.();
  };

  const record = async (model, sample, provider = 'openai') => {
    await loaded;
    addUsage(doc, provider, model, sample, new Date(), OFFPEAK_WINDOW);
    pruneDays(doc);
    scheduleSave();
  };

  // Other host plugins (the local OpenAI access plugin) report usage through
  // this service; it stays optional for every caller.
  ctx.provide('openAiUsage', { record });

  ctx.on('llm/stream', (request, next) => {
    if (!request?.provider) return next();
    const provider = request.provider;
    const model = request.model;
    return (async function* observe() {
      for await (const chunk of next()) {
        if (chunk?.type === 'usage' && chunk.usage) {
          record(model, chunk.usage, provider).catch(() => undefined);
        }
        yield chunk;
      }
    })();
  });

  const adminKey = async () => {
    try {
      const resolved = await ctx.get('credentials')?.resolve?.(ADMIN_KEY_NAME);
      if (typeof resolved?.value === 'string' && resolved.value !== '') return resolved.value;
    } catch { /* fall back to the environment */ }
    const fromEnv = process.env[ADMIN_KEY_NAME];
    return typeof fromEnv === 'string' && fromEnv !== '' ? fromEnv : null;
  };

  // UI-safe facts about the reference; the value itself never leaves the host.
  const adminKeyInfo = async () => {
    try {
      const described = await ctx.get('credentials')?.describe?.(ADMIN_KEY_NAME);
      if (described && typeof described === 'object') {
        return {
          configured: Boolean(described.configured),
          source: typeof described.source === 'string' ? described.source : null,
          writable: Boolean(described.writable),
          masked: typeof described.masked === 'string' ? described.masked : null,
        };
      }
    } catch { /* ignore and fall back */ }
    const fromEnv = process.env[ADMIN_KEY_NAME];
    const configured = typeof fromEnv === 'string' && fromEnv !== '';
    return { configured, source: configured ? 'environment' : null, writable: false, masked: null };
  };

  const refreshAdmin = async (force) => {
    const key = await adminKey();
    if (key === null) {
      doc.admin = null;
      return;
    }
    const lastSync = doc.admin?.lastSync ? Date.parse(doc.admin.lastSync) : 0;
    if (!force && Number.isFinite(lastSync) && Date.now() - lastSync < ADMIN_REFRESH_MS) return;
    if (adminOperation !== null) { await adminOperation; return; }
    adminOperation = (async () => {
      try {
        await loaded;
        const now = new Date();
        const start = monthStartUnix(now);
        const [costs, completions] = await Promise.all([
          fetchJson(`https://api.openai.com/v1/organization/costs?start_time=${start}&bucket_width=1d&limit=31`, key),
          fetchJson(`https://api.openai.com/v1/organization/usage/completions?start_time=${start}&bucket_width=1d&group_by=model&limit=31`, key),
        ]);
        const costDays = parseCostDays(costs);
        const series = parseUsageSeries(completions);
        const totals = { input: 0, output: 0, requests: 0 };
        for (const row of series.days) {
          totals.input += row.inputTokens;
          totals.output += row.outputTokens;
          totals.requests += row.requests;
        }
        doc.admin = {
          lastSync: new Date().toISOString(),
          error: null,
          monthCostUsd: Math.round(costDays.reduce((sum, day) => sum + day.costUsd, 0) * 1e6) / 1e6,
          monthInputTokens: totals.input,
          monthOutputTokens: totals.output,
          monthRequests: totals.requests,
          costDays,
          usageDays: series.days,
          models: series.models,
        };
        scheduleSave();
      } catch (error) {
        doc.admin = {
          lastSync: doc.admin?.lastSync ?? null,
          error: error instanceof Error ? error.message : String(error),
          monthCostUsd: doc.admin?.monthCostUsd ?? null,
          monthInputTokens: doc.admin?.monthInputTokens ?? 0,
          monthOutputTokens: doc.admin?.monthOutputTokens ?? 0,
          monthRequests: doc.admin?.monthRequests ?? 0,
          costDays: doc.admin?.costDays ?? [],
          usageDays: doc.admin?.usageDays ?? [],
          models: doc.admin?.models ?? [],
        };
        scheduleSave();
      }
    })().finally(() => { adminOperation = null; });
    await adminOperation;
  };

  // Estimate against the same UTC-day range used when the balance was captured.
  const refreshBalance = async (force = false) => {
    const balance = doc.balance;
    if (!balance || !Number.isFinite(balance.baselineCostUsd)) return;
    if (balanceOperation) { await balanceOperation; return; }
    if (!force && Date.now() - Math.max(balanceLastAttempt, Date.parse(balance.costSyncedAt) || 0) < ADMIN_REFRESH_MS) return;
    balanceLastAttempt = Date.now();
    balanceOperation = (async () => {
      try {
        const key = await adminKey();
        if (!key) throw new Error('未配置 OpenAI Admin key');
        const total = await fetchCostTotal(fetchJson, key, costStartUnix(balance.capturedAt));
        if (doc.balance !== balance) return;
        balance.latestCostUsd = total;
        balance.costSyncedAt = new Date().toISOString();
        balance.costError = null;
      } catch (error) {
        if (doc.balance !== balance) return;
        balance.costError = error instanceof Error ? error.message : String(error);
      }
      scheduleSave();
    })().finally(() => { balanceOperation = null; });
    await balanceOperation;
  };

  // Retain the existing OpenAI-only daily usage field for API compatibility.
  // Its first day includes the whole calendar day, not the exact snapshot time.
  const usageSinceBalance = () => {
    const capturedAt = doc.balance?.capturedAt ? Date.parse(doc.balance.capturedAt) : NaN;
    if (!Number.isFinite(capturedAt)) return null;
    const sinceDay = localDayKey(new Date(capturedAt));
    const counters = { input: 0, output: 0, cached: 0, cacheWrite: 0, reasoning: 0, requests: 0 };
    for (const [day, value] of Object.entries(doc.days)) {
      if (day < sinceDay) continue;
      for (const [provider, providerCounters] of Object.entries(value.providers)) {
        if (providerFamily(provider) !== 'openai') continue;
        for (const bucket of Object.keys(counters)) counters[bucket] += providerCounters[bucket] ?? 0;
      }
    }
    return counters;
  };

  const summary = async () => ({
    ...summarize(doc),
    adminConfigured: Boolean(doc.admin),
    adminKeyInfo: await adminKeyInfo(),
    usageSinceBalance: usageSinceBalance(),
    balanceEstimate: balanceEstimate(doc.balance),
    dataFile,
    adminKeyName: ADMIN_KEY_NAME,
    offpeakWindow: OFFPEAK_WINDOW.start + '-' + OFFPEAK_WINDOW.end,
  });

  const route = (path, methods, handler) => ctx.connection.fetch.register({
    path: `/api/openai-usage/${path}`,
    methods,
    requestBody: 'buffered',
    fetch: async (request) => {
      try {
        const body = await handler(request);
        return Response.json(body, { headers: { 'cache-control': 'no-store' } });
      } catch (error) {
        return Response.json({ error: error instanceof Error ? error.message : String(error) }, {
          status: 400,
          headers: { 'cache-control': 'no-store' },
        });
      }
    },
  });

  const readBody = async (request) => {
    const text = await request.text();
    if (Buffer.byteLength(text) > MAX_BODY_BYTES) throw new Error('请求体过大');
    return JSON.parse(text || '{}');
  };

  const volc = createVolcOverview(async key => {
    const resolved = await ctx.get('credentials')?.resolve?.(key);
    return resolved?.value || process.env[key];
  });
  route('volcengine', ['GET'], () => volc.refresh());
  route('volcengine-refresh', ['POST'], () => volc.refresh(true));
  route('volcengine-iam', ['POST'], async request => {
    const body = await readBody(request);
    const credentials = ctx.get('credentials');
    if (typeof credentials?.set !== 'function' || typeof credentials?.unset !== 'function') {
      throw new Error('当前环境没有可写的 DSH 凭据库');
    }
    if (body.clear === true) {
      await credentials.unset(VOLC_IAM_CREDENTIAL);
    } else {
      const iam = parseIam(body.accessKey, body.secretKey);
      if (!iam) throw new Error('请填写完整的火山 IAM Access Key ID 和 Secret Access Key');
      await credentials.set(VOLC_IAM_CREDENTIAL, JSON.stringify(iam));
    }
    return volc.reset();
  });

  route('summary', ['GET'], async () => {
    await loaded;
    await refreshAdmin(false).catch(() => undefined);
    await refreshBalance();
    return summary();
  });
  route('balance', ['POST'], async (request) => {
    await loaded;
    const body = await readBody(request);
    const amount = body.amountUsd;
    if (amount !== null && (!Number.isFinite(amount) || amount < 0)) throw new Error('请填写不小于 0 的余额数字');
    let nextBalance = null;
    if (amount !== null) {
      const key = await adminKey();
      if (!key) throw new Error('请先在 OpenAI 标签配置 Admin key，才能根据官方花费估算余额');
      const capturedAt = new Date().toISOString();
      const baselineCostUsd = await fetchCostTotal(fetchJson, key, costStartUnix(capturedAt));
      nextBalance = { amountUsd: amount, capturedAt, baselineCostUsd, latestCostUsd: baselineCostUsd, costSyncedAt: new Date().toISOString(), costError: null };
    }
    const previousBalance = doc.balance;
    doc.balance = nextBalance;
    try { await saveNow(); }
    catch (error) { if (doc.balance === nextBalance) doc.balance = previousBalance; throw error; }
    balanceLastAttempt = Date.now();
    return summary();
  });

  route('refresh-admin', ['POST'], async () => {
    await loaded;
    await refreshAdmin(true);
    await refreshBalance(true);
    return summary();
  });

  // Saves the Admin key into the DSH credential store; the value is never
  // echoed back, logged, or written to this plugin's data file.
  route('admin-key', ['POST'], async (request) => {
    const body = await readBody(request);
    const credentials = ctx.get('credentials');
    if (typeof credentials?.set !== 'function' || typeof credentials?.unset !== 'function') {
      throw new Error('当前 profile 没有可写的凭据服务，无法保存 Admin key');
    }
    await loaded;
    if (body.clear === true) {
      await credentials.unset(ADMIN_KEY_NAME);
      doc.admin = null;
      if (doc.balance) { doc.balance.baselineCostUsd = null; doc.balance.latestCostUsd = null; }
      await saveNow();
      return summary();
    }
    const apiKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : '';
    if (apiKey.length < 8 || apiKey.length > 500 || /[\r\n\t ]/.test(apiKey)) throw new Error('Admin key 格式不正确');
    await credentials.set(ADMIN_KEY_NAME, apiKey);
    if (doc.balance) { doc.balance.baselineCostUsd = null; doc.balance.latestCostUsd = null; }
    await saveNow();
    await refreshAdmin(true);
    return summary();
  });

  ctx.effect(() => () => {
    if (saveTimer !== null) { clearTimeout(saveTimer); saveTimer = null; }
    saveNow().catch(() => undefined);
  });

  // Warm the cache once so the first panel open already has data.
  loaded.then(() => summarize(doc)).catch(() => undefined);
}
