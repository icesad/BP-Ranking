// 进程内定时器：让榜单有"心跳"。每隔 MARKET_TICK_MINUTES 分钟做一次市场情绪波动。
// 设为 0 可关闭。仅适合单进程本机/单实例；多实例部署应改用外部定时任务。
let started = false;

function startScheduler(getDb) {
  if (started) return;
  started = true;
  const min = parseInt(process.env.MARKET_TICK_MINUTES || '180', 10);
  if (!min || min <= 0) return;
  const h = setInterval(() => {
    try {
      const { marketTick } = require('./portfolio');
      marketTick(getDb());
    } catch {}
  }, min * 60 * 1000);
  if (h.unref) h.unref();
}

module.exports = { startScheduler };
