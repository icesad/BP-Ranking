// 回测样本播种：录入一批"公开融资/收购额可查、带来源"的真实 AI 项目，用于跑 backtest 基线。
//
// ⚠️ 诚实前提（务必知道）：本站估值器是"联网搜索 + 推理"。对知名已融资公司，模型联网就能搜到真实数字、
//    倾向于"照抄"——所以这种回测主要测"会不会上网读数"，而非"会不会预测"。真正的校准是前瞻式的
//    （现在估值、将来出结果再对照，由 outcomes/calibration 随时间积累）。本脚本仅作"管线冒烟测试 + 方向性基线"。
//
// 做法：对每个样本——①插入为 URL 类 demo（先不加 outcome）②盲估一次 valuateBp（此时无 outcome→floor 不泄漏答案）
//       ③估值完成后再写入"已核实(verified=1)"的货币结果。最后用 `node scripts/backtest-valuation.js` 看命中率。
//
// 用法（在 D:\BP-Ranking 下；需 .env.local 的 DEEPSEEK_API_KEY / TAVILY_API_KEY；6 次估值，¥0.5 上下、约 8-15 分钟）：
//   node scripts/seed-backtest.js          播种 + 盲估 + 写结果
//   node scripts/seed-backtest.js clear     删除本脚本造的样本（founder='[回测样本]'）及其结果
//
// 数字为公开报道值（见每条 source）；金额按 USD→CNY 固定汇率 7.2 折算，原始美元额写在 note 里。
(function loadEnv() {
  try {
    const fs = require('fs'); const path = require('path');
    const txt = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8');
    for (const line of txt.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch {}
})();

const { getDb } = require('../lib/db');
const RATE = 7.2; // USD→CNY 折算（固定，便于复现）
const FOUNDER = '[回测样本]';

// 选样原则：贴近"独立开发者/vibe coder 能做出来"的量级，公开数字可查、带来源；覆盖不同分类；
//   另保留 1 个"上限测试"样本（Manus 被 Meta 收购）看模型对巨额标的的表现。
// type：acquired=收购价(≈价值) | revenue=年化营收 ARR（注意：ARR 是价值的保守下限，非估值本身，命中以方向参考）
const SAMPLES = [
  // —— 独立开发者 / 小团队，量级更具参考意义 ——
  { title: 'Photo AI（AI 写真生成器 · Pieter Levels 个人开发）', sector: 'ai', url: 'https://photoai.com', usd: 1.58e6, type: 'revenue',
    note: '单人开发，约 $132K/月 → 年化 ARR ≈ $1.58M（公开 Stripe）', source: 'https://www.indiehackers.com/post/photo-ai-by-pieter-levels-complete-deep-dive-case-study-0-to-132k-mrr-in-18-months-3a9a2b1579', at: '2024-09' },
  { title: 'Interior AI（AI 室内设计 · Pieter Levels 个人开发）', sector: 'ai', url: 'https://interiorai.com', usd: 4.8e5, type: 'revenue',
    note: '单人开发，约 $40K/月 → 年化 ARR ≈ $0.48M（公开）', source: 'https://ppc.land/how-one-photo-ai-app-generates-132k-monthly-after-70-failed-startups/', at: '2024' },
  { title: 'Carrd（单页建站工具 · 单人 SaaS）', sector: 'saas', url: 'https://carrd.co', usd: 1.5e6, type: 'revenue',
    note: '基本单人，2024 年 ARR ≈ $1.5M（公开访谈）', source: 'https://medium.com/@rohidasgowda/carrd-case-study-5f48a7131e0c', at: '2024' },
  { title: 'Plausible Analytics（隐私优先网站统计 · 开源 SaaS）', sector: 'saas', url: 'https://plausible.io', usd: 3.1e6, type: 'revenue',
    note: '小团队、$0 融资、开源，2024 年 ARR ≈ $3.1M（公开）', source: 'https://getlatka.com/companies/plausible-analytics', at: '2024' },
  { title: 'Balatro（独立 Roguelike 卡牌游戏 · 单人开发 LocalThunk）', sector: 'content', url: 'https://www.playbalatro.com', usd: 9.3e6, type: 'revenue',
    note: '单人开发（Playstack 发行）；仅手机版净收入 ≈ $9.3M（保守，全平台更高）', source: 'https://gameworldobserver.com/2025/01/21/balatro-another-1-5-million-copies-total-5m-units', at: '2025-01' },
  // —— 上限测试（巨额并购，超出 vibe coder 量级，仅看模型上限表现） ——
  { title: 'Manus（AI Agent · 被 Meta 约 $2B 收购）', sector: 'ai', url: 'https://manus.im', usd: 2.0e9, type: 'acquired',
    note: '上限样本：Meta 约 20 亿美元收购（收购对价）', source: 'https://www.cbc.ca/news/business/meta-manus-acquisition-two-billion-explained-9.7030180', at: '2025' },
];

async function main() {
  const db = getDb();
  const mode = process.argv[2];

  if (mode === 'clear') {
    const ids = db.prepare('SELECT id FROM bps WHERE founder = ?').all(FOUNDER).map((r) => r.id);
    if (!ids.length) { console.log('没有回测样本可清除。'); return; }
    const tx = db.transaction(() => {
      for (const id of ids) {
        db.prepare('DELETE FROM outcomes WHERE bp_id = ?').run(id);
        db.prepare('DELETE FROM valuations WHERE bp_id = ?').run(id);
        db.prepare('DELETE FROM valuation_history WHERE bp_id = ?').run(id);
        db.prepare('DELETE FROM suggestions WHERE bp_id = ?').run(id);
        db.prepare('DELETE FROM bps WHERE id = ?').run(id);
      }
    });
    tx();
    console.log(`已清除 ${ids.length} 个回测样本及其估值/结果。`);
    return;
  }

  const { valuateBp } = require('../lib/valuation');
  if (!process.env.DEEPSEEK_API_KEY) { console.warn('⚠️ 未检测到 DEEPSEEK_API_KEY，估值会降级/失败。请先在 .env.local 配置。'); }

  console.log(`将播种 ${SAMPLES.length} 个回测样本（先盲估、再写已核实结果）。预计约 ¥${(SAMPLES.length * 0.07).toFixed(2)}、10-20 分钟。\n`);
  let done = 0;
  for (const s of SAMPLES) {
    // 1) 去重 / 插入 bp（先不带 outcome）
    let row = db.prepare('SELECT * FROM bps WHERE founder = ? AND title = ?').get(FOUNDER, s.title);
    if (!row) {
      const summary = `${s.title}。真实 AI 项目，公开${s.type === 'acquired' ? '收购' : '融资'}事件用于估值回测。`;
      const info = db.prepare(`INSERT INTO bps (title, founder, summary, content, sector, visibility, kind, demo_type, demo_url, stage)
        VALUES (?,?,?,?,?,?,?,?,?,?)`).run(s.title, FOUNDER, summary, summary, s.sector, 'public', 'demo', 'url', s.url, 'revenue');
      row = db.prepare('SELECT * FROM bps WHERE id = ?').get(info.lastInsertRowid);
    }

    // 2) 盲估（此时该项目无 outcome，floor 不会泄漏答案）
    process.stdout.write(`  [${done + 1}/${SAMPLES.length}] 盲估 ${s.title} … `);
    try {
      const r = await valuateBp(db, row, { force: true });
      console.log(`¥${r.low} – ¥${r.high}`);
    } catch (e) { console.log('估值失败：', e?.message || e); }

    // 3) 估值完成后写入"已核实"货币结果
    const cny = Math.round(s.usd * RATE);
    const exists = db.prepare("SELECT 1 FROM outcomes WHERE bp_id = ? AND source_url = ?").get(row.id, s.source);
    if (!exists) {
      db.prepare(`INSERT INTO outcomes (bp_id, type, amount, note, source_url, occurred_at, verified)
        VALUES (?,?,?,?,?,?,1)`).run(row.id, s.type, cny, `${s.note}（$${(s.usd / 1e8).toFixed(2)}亿 ×汇率${RATE}）`, s.source, s.at);
    }
    done++;
  }
  console.log(`\n✅ 完成 ${done} 个。现在跑：node scripts/backtest-valuation.js`);
  console.log('   注意：知名公司联网可搜到真实数字，命中率偏高属"读数"而非"预测"；真正校准看前瞻式积累。');
  console.log('   想清掉这些样本：node scripts/seed-backtest.js clear\n');
}

main().catch((e) => { console.error(e); process.exit(1); });
