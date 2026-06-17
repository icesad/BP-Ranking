// 轻量内存滑动窗口限流（单进程，适合本机/单实例演示；多实例部署需换 Redis 等）。
const buckets = new Map(); // key -> [timestamps]

function checkRate(key, limit, windowMs) {
  const now = Date.now();
  const arr = (buckets.get(key) || []).filter((t) => now - t < windowMs);
  if (arr.length >= limit) {
    buckets.set(key, arr);
    const retryAfter = Math.ceil((windowMs - (now - arr[0])) / 1000);
    return { ok: false, retryAfter };
  }
  arr.push(now);
  buckets.set(key, arr);
  return { ok: true };
}

function clientIp(req) {
  const xff = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim();
  return xff || req.headers.get('x-real-ip') || 'local';
}

// 防止 Map 无限增长：偶发清理过期空桶
function sweep() {
  const now = Date.now();
  for (const [k, arr] of buckets) {
    const live = arr.filter((t) => now - t < 24 * 3600 * 1000);
    if (live.length === 0) buckets.delete(k); else buckets.set(k, live);
  }
}
if (typeof setInterval === 'function') {
  const h = setInterval(sweep, 3600 * 1000);
  if (h.unref) h.unref();
}

module.exports = { checkRate, clientIp };
