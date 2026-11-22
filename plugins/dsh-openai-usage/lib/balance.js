// Official Costs is grouped into UTC day buckets, not an instantaneous balance.
// Query from the snapshot's UTC day both at capture and on later refreshes;
// subtracting the two totals preserves the within-day baseline and crosses months.
export function costStartUnix(at) {
  const time = Date.parse(at);
  if (!Number.isFinite(time)) throw new Error('余额快照时间无效，请重新录入余额');
  return Math.floor(time / 86_400_000) * 86_400;
}

export async function fetchCostTotal(fetchJson, key, startUnix) {
  const params = new URLSearchParams({ start_time: String(startUnix), bucket_width: '1d', limit: '31' });
  let total = 0;
  const seen = new Set();
  for (let page = 0; page < 1000; page += 1) {
    const payload = await fetchJson(`https://api.openai.com/v1/organization/costs?${params}`, key);
    if (!payload || !Array.isArray(payload.data)) throw new Error('OpenAI 花费响应格式无效');
    for (const bucket of payload.data) {
      if (!Array.isArray(bucket?.results)) throw new Error('OpenAI 花费响应缺少明细');
      for (const row of bucket.results) {
        const amount = row?.amount;
        if (!Number.isFinite(amount?.value) || (amount.currency && String(amount.currency).toLowerCase() !== 'usd')) {
          throw new Error('OpenAI 花费金额或币种无效');
        }
        total += amount.value;
      }
    }
    if (!payload.has_more) return Math.round(total * 1e6) / 1e6;
    if (typeof payload.next_page !== 'string' || !payload.next_page || seen.has(payload.next_page)) throw new Error('OpenAI 花费分页无效');
    seen.add(payload.next_page);
    params.set('page', payload.next_page);
  }
  throw new Error('OpenAI 花费分页过多，请重新录入余额');
}

export function balanceEstimate(balance) {
  if (!balance || !Number.isFinite(balance.baselineCostUsd) || !Number.isFinite(balance.latestCostUsd)) return null;
  const spentUsd = Math.round((balance.latestCostUsd - balance.baselineCostUsd) * 1e6) / 1e6;
  return { spentUsd, amountUsd: Math.round((balance.amountUsd - spentUsd) * 1e6) / 1e6, lastSync: balance.costSyncedAt ?? null, error: balance.costError ?? null };
}
