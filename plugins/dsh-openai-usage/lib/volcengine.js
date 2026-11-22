import { createHash, createHmac } from 'node:crypto';

export const VOLC_IAM_CREDENTIAL = 'VOLCENGINE_USAGE_IAM';
const REFRESH_MS = 10 * 60_000;
const PROJECT = process.env.DSH_VOLCENGINE_ARK_PROJECT?.trim() || 'default';
const BILLING_HOST = 'billing.volcengineapi.com';

const sha256 = content => createHash('sha256').update(content).digest('hex');
const hmac = (key, content) => createHmac('sha256', key).update(content).digest();

export function signVolcRequest({ host, service, action, version, payload }, iam, now = new Date()) {
  const method = payload === undefined ? 'GET' : 'POST';
  const body = payload === undefined ? undefined : JSON.stringify(payload);
  const query = `Action=${action}&Version=${version}`;
  const stamp = now.toISOString().replace(/[-:]|\.\d{3}/g, '');
  const hash = sha256(body ?? '');
  const headers = { host, 'x-date': stamp };
  if (body !== undefined) {
    headers['content-type'] = 'application/json';
    headers['x-content-sha256'] = hash;
  }
  const names = Object.keys(headers).sort();
  const signed = names.join(';');
  const canonicalHeaders = names.map(name => `${name}:${headers[name]}\n`).join('');
  const canonical = [method, '/', query, canonicalHeaders, signed, hash].join('\n');
  const day = stamp.slice(0, 8);
  const region = 'cn-beijing';
  const scope = `${day}/${region}/${service}/request`;
  const key = [day, region, service, 'request'].reduce(hmac, iam.secretKey);
  const signature = hmac(key, ['HMAC-SHA256', stamp, scope, sha256(canonical)].join('\n')).toString('hex');
  headers.authorization = `HMAC-SHA256 Credential=${iam.accessKey}/${scope}, SignedHeaders=${signed}, Signature=${signature}`;
  return {
    url: `https://${host}/?${query}`,
    options: { method, headers, body, redirect: 'error', signal: AbortSignal.timeout(12_000) },
  };
}

async function requestVolc(operation, iam) {
  const { url, options } = signVolcRequest(operation, iam);
  const response = await fetch(url, options);
  const data = await response.json().catch(() => null);
  const code = data?.ResponseMetadata?.Error?.Code;
  if (code || !response.ok || !data?.Result) {
    const safeCode = typeof code === 'string' && /^[\w.-]{1,80}$/.test(code) ? ` ${code}` : '';
    throw new Error(`火山接口 HTTP ${response.status}${safeCode}`);
  }
  return data.Result;
}

function number(value) {
  if (typeof value !== 'number' && (typeof value !== 'string' || !value.trim())) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseArkUsage(result) {
  const days = new Map();
  const models = new Map();
  const totals = { input: 0, output: 0, requests: 0 };
  const rows = result.Data ?? (result.DataCount === 0 ? [] : null);
  if (!Array.isArray(rows)) throw new Error('方舟用量响应缺少记录');
  const fields = (result.Fields ?? []).map(field => field.Name);
  const [dayIndex, modelIndex, inputIndex, outputIndex, requestIndex] =
    ['Day', 'ModelName', 'InputTokens', 'OutputTokens', 'ReqCnt'].map(name => fields.indexOf(name));
  for (const row of rows) {
    const date = row[dayIndex];
    const model = row[modelIndex] || '未标注模型';
    const counters = { input: number(row[inputIndex]), output: number(row[outputIndex]), requests: number(row[requestIndex]) };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Object.values(counters).some(value => !Number.isSafeInteger(value) || value < 0)) {
      throw new Error('方舟用量响应格式异常');
    }
    if (!days.has(date)) days.set(date, { date, input: 0, output: 0, requests: 0 });
    if (!models.has(model)) models.set(model, { model, input: 0, output: 0, requests: 0 });
    for (const key of Object.keys(totals)) {
      totals[key] += counters[key];
      days.get(date)[key] += counters[key];
      models.get(model)[key] += counters[key];
    }
  }
  return {
    ...totals,
    days: [...days.values()].sort((a, b) => a.date.localeCompare(b.date)),
    models: [...models.values()].sort((a, b) => b.input + b.output - a.input - a.output),
  };
}

export function parseMediaBills(rows) {
  const products = new Map();
  for (const row of rows) {
    const names = `${row.ProductZh ?? ''} ${row.Product ?? ''}`;
    const product = /media[ _-]?kit/i.test(names) ? 'AI MediaKit'
      : /豆包语音|语音技术|speech_saas/i.test(names) ? '豆包语音' : null;
    if (!product) continue;
    const meter = row.Element || row.ConfigName || '未标注计费项';
    const unit = row.Unit?.trim();
    const quantity = unit ? number(row.Count) : null;
    const amount = number(row.PayableAmount);
    const currency = row.Currency || 'CNY';
    const key = JSON.stringify([product, meter, unit, currency]);
    if (!products.has(key)) products.set(key, { product, meter, unit, currency, quantity: null, amount: null });
    const entry = products.get(key);
    if (quantity !== null) entry.quantity = (entry.quantity ?? 0) + quantity;
    if (amount !== null) entry.amount = (entry.amount ?? 0) + amount;
  }
  return [...products.values()];
}

async function loadMediaBills(iam, period) {
  const limit = 300;
  const rows = [];
  for (let offset = 0; offset < 6000; offset += limit) {
    const result = await requestVolc({
      host: BILLING_HOST, service: 'billing', action: 'ListBillDetail', version: '2022-01-01',
      payload: { BillPeriod: period, Limit: limit, Offset: offset, NeedRecordNum: 1, GroupTerm: 0, GroupPeriod: 0 },
    }, iam);
    const page = result.List ?? (result.Total === 0 ? [] : null);
    if (result.Warning || !Array.isArray(page)) throw new Error('火山账单明细响应不完整');
    rows.push(...page);
    const total = number(result.Total);
    if (total !== null && total >= 0 ? rows.length >= total : page.length < limit) return parseMediaBills(rows);
    if (!page.length) break;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error('火山账单明细未完整读回，请在费用中心查看');
}

export function parseIam(accessKey, secretKey) {
  if (typeof accessKey !== 'string' || typeof secretKey !== 'string') return null;
  accessKey = accessKey.trim();
  secretKey = secretKey.trim();
  if (!/^[\w+=/-]{8,256}$/.test(accessKey) || !/^[\w+=/-]{8,256}$/.test(secretKey)) return null;
  return { accessKey, secretKey };
}

export function createVolcOverview(resolveCredential) {
  let result = { status: 'unconfigured' };
  let checkedAt = 0;
  let operation = null;
  let revision = 0;

  const getIam = async () => {
    const stored = await resolveCredential(VOLC_IAM_CREDENTIAL);
    if (stored) {
      const parsed = JSON.parse(stored);
      return parseIam(parsed.accessKey, parsed.secretKey);
    }
    const [accessKey, secretKey] = await Promise.all([
      resolveCredential('VOLCENGINE_ACCESS_KEY'),
      resolveCredential('VOLCENGINE_SECRET_KEY'),
    ]);
    return parseIam(accessKey, secretKey);
  };

  const refresh = async (force = false) => {
    if (operation) return operation;
    if (!force && Date.now() - checkedAt < REFRESH_MS) return result;
    const currentRevision = revision;
    operation = (async () => {
      try {
        const iam = await getIam();
        if (!iam) {
          result = { status: 'unconfigured' };
          return result;
        }
        const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date());
        const period = today.slice(0, 7);
        const responses = await Promise.allSettled([
          requestVolc({
            host: BILLING_HOST, service: 'billing', action: 'QueryBalanceAcct', version: '2022-01-01',
          }, iam).then(data => {
            const balance = number(data.AvailableBalance);
            if (balance === null) throw new Error('火山余额响应缺少可用余额');
            return balance;
          }),
          requestVolc({
            host: 'ark.cn-beijing.volcengineapi.com', service: 'ark', action: 'GetInferenceUsage', version: '2024-01-01',
            payload: { StartTime: `${period}-01`, EndTime: today, QueryInterval: 'Day', ProjectName: PROJECT, Filters: [{ Key: 'ModelName', Values: [] }] },
          }, iam).then(parseArkUsage),
          loadMediaBills(iam, period),
        ]);
        if (currentRevision !== revision) return result;
        const now = new Date().toISOString();
        const next = { status: 'configured', period, project: PROJECT };
        for (const [index, key] of ['balance', 'ark', 'media'].entries()) {
          const response = responses[index];
          const previous = key === 'balance' || result.period === period ? result[key] : null;
          next[key] = response.status === 'fulfilled'
            ? { value: response.value, syncedAt: now }
            : { ...previous, error: response.reason?.message || '火山查询失败' };
        }
        result = next;
        return result;
      } catch {
        if (currentRevision === revision) result = { status: 'credential-error' };
        return result;
      } finally {
        if (currentRevision === revision) checkedAt = Date.now();
      }
    })().finally(() => { operation = null; });
    return operation;
  };

  return {
    refresh,
    reset: async () => {
      revision += 1;
      checkedAt = 0;
      result = { status: 'unconfigured' };
      await operation;
      return refresh(true);
    },
  };
}
