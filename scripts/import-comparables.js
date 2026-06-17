// 构建"可比项目库"：从 GitHub 拉高信号仓库，抽取客观信号存入 comparables（不进排行榜，纯作估值锚点）。
// 用法举例：
//   node scripts/import-comparables.js "topic:ai stars:>500" 30
//   node scripts/import-comparables.js "ai agent stars:>1000" 50
// 第一个参数是 GitHub 搜索语句，第二个是数量（默认 30，最多 100）。
// 可选环境变量 GITHUB_TOKEN 提高速率限制（匿名只有约 10 次/分钟）。
const { getDb } = require('../lib/db');
const { upsertComparable } = require('../lib/comparables');

const query = process.argv[2] || 'topic:ai stars:>500';
const count = Math.min(100, Math.max(1, parseInt(process.argv[3] || '30', 10)));

async function search() {
  const headers = { 'User-Agent': 'BP-Ranking-Bot', Accept: 'application/vnd.github+json' };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=${count}`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`GitHub 搜索失败 HTTP ${res.status}（可设置 GITHUB_TOKEN 提高额度）`);
  return (await res.json()).items || [];
}

async function main() {
  const db = getDb();
  console.log(`搜索可比项目：「${query}」，取前 ${count} 个高 star 仓库…`);
  const repos = await search();
  let n = 0;
  for (const r of repos) {
    try { if (upsertComparable(db, r)) { n++; console.log(`＋ ${r.full_name}  ⭐${r.stargazers_count}  ${r.language || ''}`); } }
    catch (e) { console.warn(`跳过 ${r.full_name}：${e.message}`); }
  }
  const total = db.prepare('SELECT COUNT(*) c FROM comparables').get().c;
  const bySector = db.prepare('SELECT sector, COUNT(*) c FROM comparables GROUP BY sector ORDER BY c DESC').all();
  console.log(`\n完成。本次写入/更新 ${n} 条；可比项目库现有 ${total} 条。`);
  console.log('赛道分布：' + bySector.map((s) => `${s.sector || '未分类'}=${s.c}`).join(' · '));
  console.log('这些只作为估值锚点，不进排行榜。估值时会自动取同赛道的可比项目喂给模型。');
}

main().catch((e) => { console.error('出错：', e.message); process.exit(1); });
