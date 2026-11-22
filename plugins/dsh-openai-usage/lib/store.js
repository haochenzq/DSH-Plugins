// Pure usage-accounting helpers for the ai-usage plugin.
// The host keeps one JSON document in $DSH_HOME/openai-usage/usage.json.
// Token buckets follow the DSH TokenUsage contract: inputTokens is uncached
// input only; cache reads/writes are reported separately; reasoning tokens are
// already part of outputTokens and are kept for display only.
//
// Schema 2 adds a provider dimension. Schema 1 (OpenAI only) is migrated in
// memory: its whole-day counters belong to the `openai` provider.

export const SCHEMA_VERSION = 2;
export const KEEP_DAYS = 400;

/** DeepSeek off-peak discount window in the host's local time (default 00:30–08:30). */
export const DEFAULT_OFFPEAK = { start: '00:30', end: '08:30' };

function minutesOfClock(text) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(text ?? ''));
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/** Parse an "HH:MM-HH:MM" window; invalid input falls back to the default. */
export function parseOffpeakWindow(text) {
  const match = /^(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/.exec(String(text ?? '').trim());
  if (!match) return DEFAULT_OFFPEAK;
  const start = minutesOfClock(match[1]);
  const end = minutesOfClock(match[2]);
  if (start === null || end === null) return DEFAULT_OFFPEAK;
  return { start: match[1], end: match[2] };
}

export function isOffPeak(date, window = DEFAULT_OFFPEAK) {
  const start = minutesOfClock(window.start);
  const end = minutesOfClock(window.end);
  if (start === null || end === null) return false;
  const minute = date.getHours() * 60 + date.getMinutes();
  if (start === end) return false;
  return start < end ? minute >= start && minute < end : minute >= start || minute < end;
}

const BUCKETS = ['input', 'output', 'cached', 'cacheWrite', 'reasoning', 'requests'];
const MODEL_SEPARATOR = '|';
const FAMILIES = ['deepseek', 'openai', 'other'];

export function localDayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function emptyCounters() {
  return { input: 0, output: 0, cached: 0, cacheWrite: 0, reasoning: 0, requests: 0 };
}

function nonNegative(value) {
  return Number.isFinite(value) && value >= 0 ? Math.round(value) : 0;
}

/** Provider family used for grouping in the panel. */
export function providerFamily(provider) {
  const name = typeof provider === 'string' ? provider : '';
  if (name.startsWith('deepseek')) return 'deepseek';
  if (name === 'openai') return 'openai';
  return 'other';
}

/**
 * Normalize either a DSH TokenUsage or an OpenAI-native usage object.
 * Returns null when the sample carries no countable tokens.
 */
export function normalizeUsage(sample) {
  if (sample === null || typeof sample !== 'object') return null;
  const nativeInput = sample.input_tokens ?? sample.prompt_tokens;
  const cached = sample.input_tokens_details?.cached_tokens ?? sample.prompt_tokens_details?.cached_tokens;
  let input;
  let cacheRead;
  if (sample.inputTokens !== undefined) {
    input = nonNegative(sample.inputTokens);
    cacheRead = nonNegative(sample.cacheReadTokens);
  } else {
    const totalInput = nonNegative(nativeInput);
    cacheRead = nonNegative(cached);
    input = Math.max(0, totalInput - cacheRead);
  }
  const output = nonNegative(sample.outputTokens ?? sample.output_tokens ?? sample.completion_tokens);
  const cacheWrite = nonNegative(sample.cacheWriteTokens);
  const reasoning = nonNegative(
    sample.reasoningTokens ?? sample.reasoning_tokens ??
    sample.output_tokens_details?.reasoning_tokens ?? sample.completion_tokens_details?.reasoning_tokens,
  );
  const usage = { input, output, cached: cacheRead, cacheWrite, reasoning, requests: 1 };
  const total = usage.input + usage.output + usage.cached + usage.cacheWrite;
  return total > 0 ? usage : null;
}

export function emptyDocument() {
  return { schemaVersion: SCHEMA_VERSION, updatedAt: null, days: {}, balance: null, admin: null };
}

function readCounters(raw) {
  const counters = emptyCounters();
  if (raw === null || typeof raw !== 'object') return counters;
  for (const bucket of BUCKETS) counters[bucket] = nonNegative(raw[bucket]);
  return counters;
}

function readModels(raw) {
  const models = {};
  if (raw === null || typeof raw !== 'object') return models;
  for (const [key, sample] of Object.entries(raw)) {
    if (typeof key !== 'string' || key === '' || sample === null || typeof sample !== 'object') continue;
    models[key] = readCounters(sample);
  }
  return models;
}

function normalizeDay(raw) {
  const day = { ...readCounters(raw), providers: {}, models: {}, bands: null };
  if (raw.providers && typeof raw.providers === 'object') {
    for (const [provider, sample] of Object.entries(raw.providers)) {
      if (typeof provider !== 'string' || provider === '') continue;
      day.providers[provider] = readCounters(sample);
    }
  }
  day.models = readModels(raw.models);
  if (raw.bands && typeof raw.bands === 'object') {
    day.bands = { peak: readCounters(raw.bands.peak), offpeak: readCounters(raw.bands.offpeak) };
  }
  return day;
}

function readBalance(raw) {
  if (!raw || typeof raw !== 'object' || !Number.isFinite(raw.amountUsd)) return null;
  return {
    amountUsd: Math.max(0, raw.amountUsd),
    capturedAt: typeof raw.capturedAt === 'string' ? raw.capturedAt : null,
    baselineCostUsd: Number.isFinite(raw.baselineCostUsd) ? raw.baselineCostUsd : null,
    latestCostUsd: Number.isFinite(raw.latestCostUsd) ? raw.latestCostUsd : null,
    costSyncedAt: typeof raw.costSyncedAt === 'string' ? raw.costSyncedAt : null,
    costError: typeof raw.costError === 'string' ? raw.costError : null,
  };
}

function readAdmin(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const costDays = Array.isArray(raw.costDays)
    ? raw.costDays
      .filter((day) => day && typeof day.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day.date) && Number.isFinite(day.costUsd))
      .map((day) => ({ date: day.date, costUsd: Math.max(0, day.costUsd) }))
      .slice(-40)
    : [];
  const usageDays = Array.isArray(raw.usageDays)
    ? raw.usageDays
      .filter((day) => day && typeof day.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day.date))
      .map((day) => ({
        date: day.date,
        inputTokens: nonNegative(day.inputTokens),
        outputTokens: nonNegative(day.outputTokens),
        cachedTokens: nonNegative(day.cachedTokens),
        requests: nonNegative(day.requests),
      }))
      .slice(-40)
    : [];
  const models = Array.isArray(raw.models)
    ? raw.models
      .filter((row) => row && typeof row.model === 'string' && row.model !== '')
      .map((row) => ({
        model: row.model,
        inputTokens: nonNegative(row.inputTokens),
        outputTokens: nonNegative(row.outputTokens),
        cachedTokens: nonNegative(row.cachedTokens),
        requests: nonNegative(row.requests),
      }))
      .slice(0, 20)
    : [];
  return {
    lastSync: typeof raw.lastSync === 'string' ? raw.lastSync : null,
    error: typeof raw.error === 'string' ? raw.error : null,
    monthCostUsd: Number.isFinite(raw.monthCostUsd) ? raw.monthCostUsd : null,
    monthInputTokens: nonNegative(raw.monthInputTokens),
    monthOutputTokens: nonNegative(raw.monthOutputTokens),
    monthRequests: nonNegative(raw.monthRequests),
    costDays,
    usageDays,
    models,
  };
}

/** Validate and coerce a loaded document; schema 1 is migrated, corrupt shapes start empty. */
export function normalizeDocument(raw) {
  if (raw === null || typeof raw !== 'object') return emptyDocument();
  if (raw.schemaVersion === 1) return migrateV1(raw);
  if (raw.schemaVersion !== SCHEMA_VERSION) return emptyDocument();
  const doc = emptyDocument();
  doc.updatedAt = typeof raw.updatedAt === 'string' ? raw.updatedAt : null;
  if (raw.days && typeof raw.days === 'object') {
    for (const [day, value] of Object.entries(raw.days)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || value === null || typeof value !== 'object') continue;
      doc.days[day] = normalizeDay(value);
    }
  }
  doc.balance = readBalance(raw.balance);
  doc.admin = readAdmin(raw.admin);
  return doc;
}

function migrateV1(raw) {
  const doc = emptyDocument();
  doc.updatedAt = typeof raw.updatedAt === 'string' ? raw.updatedAt : null;
  if (raw.days && typeof raw.days === 'object') {
    for (const [day, value] of Object.entries(raw.days)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || value === null || typeof value !== 'object') continue;
      const counters = readCounters(value);
      const migrated = { ...counters, providers: { openai: { ...counters } }, models: {} };
      if (value.models && typeof value.models === 'object') {
        for (const [model, sample] of Object.entries(value.models)) {
          if (typeof model !== 'string' || model === '') continue;
          migrated.models[`openai${MODEL_SEPARATOR}${model}`] = readCounters(sample);
        }
      }
      doc.days[day] = migrated;
    }
  }
  doc.balance = readBalance(raw.balance);
  doc.admin = readAdmin(raw.admin);
  return doc;
}

function addInto(target, usage) {
  for (const bucket of BUCKETS) target[bucket] += usage[bucket];
}

function ensureDay(doc, day) {
  if (!doc.days[day]) doc.days[day] = { ...emptyCounters(), providers: {}, models: {}, bands: null };
  return doc.days[day];
}

/**
 * Fold one usage sample into the document.
 * @returns the updated document (mutated in place for the host's single writer).
 */
export function addUsage(doc, provider, model, usage, at = new Date(), offpeakWindow = DEFAULT_OFFPEAK) {
  const normalized = normalizeUsage(usage);
  if (normalized === null) return doc;
  const name = typeof provider === 'string' && provider !== '' ? provider : 'unknown';
  const day = ensureDay(doc, localDayKey(at));
  addInto(day, normalized);
  if (!day.providers[name]) day.providers[name] = emptyCounters();
  addInto(day.providers[name], normalized);
  if (typeof model === 'string' && model !== '') {
    const key = `${name}${MODEL_SEPARATOR}${model}`;
    if (!day.models[key]) day.models[key] = emptyCounters();
    addInto(day.models[key], normalized);
  }
  // DeepSeek bills peak/off-peak differently; other providers ignore the window.
  if (providerFamily(name) === 'deepseek') {
    if (!day.bands) day.bands = { peak: emptyCounters(), offpeak: emptyCounters() };
    addInto(isOffPeak(at, offpeakWindow) ? day.bands.offpeak : day.bands.peak, normalized);
  }
  doc.updatedAt = at.toISOString();
  return doc;
}

/** Drop days older than `keep` entries (keys sort lexicographically for ISO dates). */
export function pruneDays(doc, keep = KEEP_DAYS) {
  const days = Object.keys(doc.days).sort();
  while (days.length > keep) delete doc.days[days.shift()];
  return doc;
}

function recentKeys(count, now) {
  const keys = [];
  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  for (let index = 0; index < count; index += 1) {
    keys.push(localDayKey(cursor));
    cursor.setDate(cursor.getDate() - 1);
  }
  return keys;
}

function emptySeries(now) {
  return recentKeys(30, now).reverse().map((date) => ({ date, ...emptyCounters() }));
}

function emptyCompare(now) {
  return { today: { date: localDayKey(now), ...emptyCounters() }, last7: emptyCounters(), last30: emptyCounters() };
}

function splitModelKey(key) {
  const separator = key.indexOf(MODEL_SEPARATOR);
  if (separator < 0) return { provider: 'unknown', model: key };
  return { provider: key.slice(0, separator), model: key.slice(separator + 1) };
}

/**
 * Build the payload the browser panel reads: per-family (deepseek / openai /
 * other) totals, 30-day series and model rows, plus overall totals.
 */
export function summarize(doc, now = new Date()) {
  const keys30 = recentKeys(30, now);
  const last7 = new Set(keys30.slice(0, 7));
  const last30 = new Set(keys30);
  // Series rows are ascending (oldest first); positions must use the same order.
  const positions = new Map(keys30.slice().reverse().map((date, index) => [date, index]));
  const todayKey = localDayKey(now);

  const families = {};
  for (const family of FAMILIES) {
    families[family] = {
      ...emptyCompare(now),
      allTime: emptyCounters(),
      days: emptySeries(now),
      models: [],
    };
  }
  const overall = { ...emptyCompare(now), allTime: emptyCounters() };
  const modelTotals = new Map();
  const deepseekBands = {
    last30: { peak: emptyCounters(), offpeak: emptyCounters() },
    allTime: { peak: emptyCounters(), offpeak: emptyCounters() },
  };

  for (const [day, value] of Object.entries(doc.days)) {
    const in30 = last30.has(day);
    const in7 = last7.has(day);
    const isToday = day === todayKey;
    for (const [provider, counters] of Object.entries(value.providers)) {
      const family = families[providerFamily(provider)] ?? families.other;
      addInto(family.allTime, counters);
      addInto(overall.allTime, counters);
      if (in30) {
        addInto(family.last30, counters);
        addInto(overall.last30, counters);
        const position = positions.get(day);
        if (position !== undefined) addInto(family.days[position], counters);
      }
      if (in7) {
        addInto(family.last7, counters);
        addInto(overall.last7, counters);
      }
      if (isToday) {
        addInto(family.today, counters);
        addInto(overall.today, counters);
      }
    }
    if (value.bands) {
      for (const band of ['peak', 'offpeak']) {
        addInto(deepseekBands.allTime[band], value.bands[band]);
        if (in30) addInto(deepseekBands.last30[band], value.bands[band]);
      }
      if (in30) {
        const position = positions.get(day);
        if (position !== undefined) {
          const row = families.deepseek.days[position];
          if (!row.bands) row.bands = { peak: emptyCounters(), offpeak: emptyCounters() };
          for (const band of ['peak', 'offpeak']) addInto(row.bands[band], value.bands[band]);
        }
      }
    }
    if (!in30) continue;
    for (const [key, counters] of Object.entries(value.models)) {
      const { provider, model } = splitModelKey(key);
      const id = `${providerFamily(provider)}${MODEL_SEPARATOR}${model}`;
      if (!modelTotals.has(id)) modelTotals.set(id, { family: providerFamily(provider), model, ...emptyCounters() });
      addInto(modelTotals.get(id), counters);
    }
  }

  for (const entry of modelTotals.values()) {
    const family = families[entry.family] ?? families.other;
    const row = { model: entry.model };
    for (const bucket of BUCKETS) row[bucket] = entry[bucket];
    family.models.push(row);
  }
  families.deepseek.bands = deepseekBands;
  for (const family of Object.values(families)) {
    family.models.sort((left, right) => (right.input + right.output) - (left.input + left.output));
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    ...overall,
    families,
    balance: doc.balance,
    admin: doc.admin,
    updatedAt: doc.updatedAt,
  };
}
