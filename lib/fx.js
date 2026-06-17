// 美元→人民币汇率：实时取 + 内存缓存(6h)，失败回退。可用环境变量 USD_CNY_RATE 兜底（国内网络拿不到实时汇率时）。
let cache = { rate: 0, at: 0 };
const FALLBACK = 7.2;

async function fetchRate() {
  // 两个免费、无需 key 的接口，任一成功即可
  for (const url of ['https://open.er-api.com/v6/latest/USD', 'https://api.frankfurter.app/latest?from=USD&to=CNY']) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) continue;
      const j = await res.json();
      const r = j?.rates?.CNY;
      if (r && r > 0) return r;
    } catch {}
  }
  return 0;
}

async function usdCnyRate() {
  const now = Date.now();
  if (cache.rate && now - cache.at < 6 * 3600 * 1000) return cache.rate;
  const live = await fetchRate();
  if (live > 0) { cache = { rate: live, at: now }; return live; }
  const envR = parseFloat(process.env.USD_CNY_RATE);
  return cache.rate || (envR > 0 ? envR : FALLBACK);
}

// 同步取当前汇率（供 fmtMoney 等同步场景用）：返回缓存值，没有则用环境变量或回退常数。
function usdCnyRateSync() {
  const envR = parseFloat(process.env.USD_CNY_RATE);
  return cache.rate || (envR > 0 ? envR : FALLBACK);
}

// 模块加载时后台预热一次缓存（不阻塞），让后续同步取值尽量拿到实时汇率。
usdCnyRate().catch(() => {});

module.exports = { usdCnyRate, usdCnyRateSync };
