// 半自动给可比库标注公开的融资/收购信息：对每个可比项目联网搜索 + LLM 严格抽取（防编造），
// 只有找到确凿来源链接才落库，否则留空并标记为"已核查"。让锚点从 star 热度升级到"真金白银"。
// 用法：node scripts/enrich-comparables.js [数量]
//   node scripts/enrich-comparables.js 30
// 每条约 1 次联网搜索(Tavily) + 1 次便宜 LLM 调用(DeepSeek)，几分钱级。
// 需要 .env.local 里的 DEEPSEEK_API_KEY 与 TAVILY_API_KEY。
// 默认只处理还没查过的；想全部重查可加 all：node scripts/enrich-comparables.js 50 all
// 轻量加载 .env.local（standalone 脚本不会像 Next 那样自动加载，且本项目未装 dotenv）
(function loadEnv() {
  try {
    const fs = require('fs');
    const path = require('path');
    const txt = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8');
    for (const line of txt.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch {}
})();
const { getDb } = require('../lib/db');
const { tavilySearch } = require('../lib/tavily');
const { extractFunding } = require('../lib/deepseek');

const limit = Math.min(300, Math.max(1, parseInt(process.argv[2] || '30', 10)));
const all = process.argv[3] === 'all';

async function main() {
  const db = getDb();
  const where = all ? '1=1' : "(enriched_at IS NULL OR enriched_at='')";
  const rows = db.prepare(`SELECT * FROM comparables WHERE ${where} ORDER BY stars DESC LIMIT ?`).all(limit);
  if (rows.length === 0) {
    console.log('没有待核查的可比项目。先用 import-comparables 导入更多，或加 all 参数重查全部。');
    return;
  }
  console.log(`将对 ${rows.length} 个可比项目联网核查融资/收购信息（star 高者优先）…\n`);
  let found = 0;
  for (const c of rows) {
    const q = `"${c.name}" ${c.description || ''} funding raised acquisition Series investment`.slice(0, 220);
    let ev = [];
    try { ev = await tavilySearch(q, { max: 8 }); } catch {}
    const f = ev.length ? await extractFunding(c.name, c.description, ev) : null;
    const stamp = new Date().toISOString().slice(0, 10);
    if (f) {
      const txt = `${f.type === 'acquired' ? '被收购' : '融资'}${f.round ? ' ' + f.round : ''}${f.amount_usd ? ' $' + f.amount_usd.toLocaleString() : ''}${f.date ? '（' + f.date + '）' : ''}${f.summary ? ' · ' + f.summary : ''}`;
      db.prepare('UPDATE comparables SET funding=?, funding_amount_usd=?, funding_url=?, funding_at=?, enriched_at=? WHERE id=?')
        .run(txt, f.amount_usd || 0, f.url, f.date || stamp, stamp, c.id);
      found++;
      console.log(`💰 ${c.name}: ${txt}\n   ${f.url}`);
    } else {
      db.prepare('UPDATE comparables SET enriched_at=? WHERE id=?').run(stamp, c.id);
      console.log(`—  ${c.name}: 未找到确凿融资/收购信息`);
    }
    await new Promise((r) => setTimeout(r, 600)); // 节流，避免触发搜索/模型限流
  }
  const withFunding = db.prepare("SELECT COUNT(*) c FROM comparables WHERE funding != ''").get().c;
  console.log(`\n完成。本次新查到 ${found} 条真实融资/收购（带来源落库）；可比库现共有 ${withFunding} 条带真金白银锚点。`);
  console.log('这些信息会作为比 star 更硬的锚点，自动喂给同赛道项目的估值。建议照来源链接抽查一下准确性。');
}

main().catch((e) => { console.error('出错：', e.message); process.exit(1); });
