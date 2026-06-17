// 资讯抓取（阶段 5 lite）：用 Tavily 抓 vibecoding / 独立开发圈的最新动态，按来源 URL 去重写入 news 表（带来源）。
// 只用 Tavily（无额外 LLM 花费）。需要 .env.local 的 TAVILY_API_KEY。
//
// 用法（在 D:\BP-Ranking 下）：
//   node scripts/import-news.js                      抓取内置的一组主题
//   node scripts/import-news.js "自定义查询" [地区]     抓单个自定义查询（地区可空，如 上海）
(function loadEnv() {
  try {
    const fs = require('fs'); const path = require('path');
    const txt = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8');
    for (const line of txt.split('\n')) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ''); }
  } catch {}
})();
const { getDb } = require('../lib/db');
const { tavilySearch } = require('../lib/tavily');

// 内置主题：{ q 查询, region 地区(可空), tags 标签 }
const DEFAULT_TOPICS = [
  { q: 'vibe coding AI app builder latest news 2026', region: 'global', tags: ['vibecoding', 'AI'] },
  { q: 'indie hacker solo founder revenue milestone 2026', region: 'global', tags: ['indie', '营收'] },
  { q: 'AI startup funding round announced this month 2026', region: 'global', tags: ['融资', 'AI'] },
  { q: 'AI coding agent new release Cursor Lovable Bolt update', region: 'global', tags: ['工具', 'AI编程'] },
  { q: '上海 AI 创业 独立开发者 社区 活动 2026', region: '上海', tags: ['社区', '上海'] },
];

function hostOf(url) { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } }

async function importTopic(db, topic, ins) {
  const results = await tavilySearch(topic.q, { max: 6 });
  let added = 0, skipped = 0;
  for (const r of results) {
    if (!r.url || !r.title) { skipped++; continue; }
    try {
      const info = ins.run(r.title, (r.snippet || '').slice(0, 280), r.url, hostOf(r.url), JSON.stringify(topic.tags || []), topic.region || '');
      if (info.changes > 0) added++; else skipped++;
    } catch { skipped++; }
  }
  return { added, skipped, total: results.length };
}

async function main() {
  if (!process.env.TAVILY_API_KEY) { console.warn('⚠️ 未检测到 TAVILY_API_KEY，无法联网抓取。请先在 .env.local 配置。'); return; }
  const db = getDb();
  const ins = db.prepare(`INSERT OR IGNORE INTO news (title, summary, source_url, source_name, tags, region) VALUES (?,?,?,?,?,?)`);

  const argQ = process.argv[2];
  const topics = argQ ? [{ q: argQ, region: (process.argv[3] || '').toString(), tags: ['自定义'] }] : DEFAULT_TOPICS;

  console.log(`抓取 ${topics.length} 个主题…\n`);
  let totalAdded = 0;
  for (const t of topics) {
    process.stdout.write(`  「${t.q.slice(0, 40)}」${t.region ? ' ['+t.region+']' : ''} … `);
    const { added, skipped, total } = await importTopic(db, t, ins);
    console.log(`命中 ${total}，新增 ${added}，去重/跳过 ${skipped}`);
    totalAdded += added;
  }
  const totalNews = db.prepare('SELECT COUNT(*) c FROM news').get().c;
  console.log(`\n✅ 本次新增 ${totalAdded} 条；news 表现有 ${totalNews} 条。打开 /news 查看。`);
  console.log('   提示：可加自定义查询，如 node scripts/import-news.js "AI 音乐 生成 工具 新品" global\n');
}

main().catch((e) => { console.error(e); process.exit(1); });
