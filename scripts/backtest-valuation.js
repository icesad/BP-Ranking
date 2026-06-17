// 估值回测：用"已发生的真实货币结果(outcomes)"当标尺，衡量估值算法准不准。
// 输出：命中率(真实金额是否落在预测区间内)、中位比(真实/预测中位)，并按【算法版本】与【原型archetype】分组对比。
// 这是迭代估值算法的客观裁判——科学性来自命中率，不来自公式好看。
//
// 用法（在 D:\BP-Ranking 下）：
//   node scripts/backtest-valuation.js            只读、零花费：用库里已存的估值结果回测
//   node scripts/backtest-valuation.js --all      也纳入"未核实/无来源"的自报结果（默认只用可核实的）
//   node scripts/backtest-valuation.js rerun       ⚠️ 会对每个有结果的项目重跑一次估值(force)，有 LLM 花费(约¥0.07/个)，
//                                                  用于衡量"当前算法版本(v2)"对真实结果的命中率
//
// 需要 .env.local（仅 rerun 模式需要 DEEPSEEK_API_KEY / TAVILY_API_KEY）。
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

const args = process.argv.slice(2);
const RERUN = args.includes('rerun');
const ALL = args.includes('--all');

function median(nums) {
  const a = nums.filter((n) => n > 0).sort((x, y) => x - y);
  if (!a.length) return 0;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

function summarize(items) {
  const n = items.length;
  if (!n) return { n: 0, hitRate: 0, medianRatio: 0 };
  const hit = items.filter((x) => x.inRange).length;
  const medRatio = median(items.map((x) => x.ratio));
  return { n, hitRate: Math.round((hit / n) * 100), medianRatio: Math.round(medRatio * 100) / 100 };
}

function table(title, groups) {
  console.log(`\n${title}`);
  console.log('  ' + '组'.padEnd(14) + '样本'.padStart(6) + '命中率'.padStart(8) + '中位比'.padStart(8));
  const keys = Object.keys(groups).sort();
  for (const k of keys) {
    const s = summarize(groups[k]);
    console.log('  ' + String(k).padEnd(14) + String(s.n).padStart(6) + (s.hitRate + '%').padStart(8) + String(s.medianRatio).padStart(8));
  }
}

async function main() {
  const db = getDb();

  // 取每个项目最早一条"货币结果"作为标尺；默认只采信可核实的(verified=1 或带来源链接)
  const gate = ALL ? '' : "AND (o.verified = 1 OR (o.source_url IS NOT NULL AND o.source_url != ''))";
  const rows = db.prepare(`
    SELECT o.bp_id, o.type, o.amount, o.occurred_at, o.source_url, o.verified,
           b.title, b.kind, b.archetype, b.val_summary
    FROM outcomes o JOIN bps b ON b.id = o.bp_id
    WHERE o.type IN ('raised','acquired','revenue') AND o.amount > 0 ${gate}
    ORDER BY o.occurred_at ASC, o.id ASC
  `).all();

  // 去重：每个项目取最早一条
  const seen = new Set();
  const targets = [];
  for (const r of rows) { if (!seen.has(r.bp_id)) { seen.add(r.bp_id); targets.push(r); } }

  if (!targets.length) {
    console.log(`没有可回测的样本（${ALL ? '含未核实自报' : '仅可核实结果'}）。`);
    console.log('提示：需要项目既有估值、又有"已发生的真金白银结果(outcomes)"。可先在详情页用 OutcomeReporter 录入带来源的真实结果。');
    return;
  }

  if (RERUN) {
    console.log(`⚠️ rerun 模式：将对 ${targets.length} 个项目各重跑一次估值(force)，预计花费约 ¥${(targets.length * 0.07).toFixed(2)}。`);
    const { valuateBp } = require('../lib/valuation');
    let i = 0;
    for (const t of targets) {
      i++;
      const bp = db.prepare('SELECT * FROM bps WHERE id = ?').get(t.bp_id);
      if (!bp) continue;
      process.stdout.write(`  [${i}/${targets.length}] 重估 bp#${bp.id} ${bp.title?.slice(0, 20) || ''} ... `);
      try { const r = await valuateBp(db, bp, { force: true }); console.log(`¥${r.low}–¥${r.high}`); }
      catch (e) { console.log('失败', e?.message || e); }
    }
    // 重读最新 val_summary
    for (const t of targets) { t.val_summary = db.prepare('SELECT val_summary FROM bps WHERE id = ?').get(t.bp_id)?.val_summary || ''; }
  }

  // 计算每条（带 outcome 类型，后面分开算）
  const items = [];
  let skipped = 0;
  for (const t of targets) {
    let s = null; try { s = JSON.parse(t.val_summary || 'null'); } catch {}
    if (!s || !(s.n > 0) || !(s.low > 0)) { skipped++; continue; }
    const mid = (s.low + s.high) / 2;
    items.push({
      bp_id: t.bp_id, title: t.title, type: t.type,
      archetype: t.archetype || s.archetype || 'other',
      algo_version: s.algo_version || 'v1', realized: t.amount,
      low: s.low, high: s.high, mid,
      inRange: t.amount >= s.low && t.amount <= s.high,
      ratio: mid > 0 ? t.amount / mid : 0,         // 真实/预测中位（价值类用）
      mult: t.amount > 0 ? mid / t.amount : 0,     // 预测中位/真实（营收类看隐含倍数）
    });
  }

  // 按"结果语义"分两类：收购/融资额≈价值（直接比）；营收(ARR)≠价值（看隐含估值倍数）
  const valueItems = items.filter((x) => x.type === 'acquired' || x.type === 'raised');
  const revItems = items.filter((x) => x.type === 'revenue');
  const MULT_LO = 2, MULT_HI = 20; // 合理的"估值/ARR"倍数带（盈利/成长型 SaaS 常见区间）

  console.log('\n========== 估值回测 ==========');
  console.log(`样本来源：${ALL ? '全部货币结果(含未核实自报)' : '仅可核实结果(verified 或带来源)'}${RERUN ? ' · rerun(已用当前算法重估)' : ' · 读库(历史估值)'}`);
  console.log(`可回测项目：${items.length}（价值类 ${valueItems.length} · 营收类 ${revItems.length}，跳过无估值 ${skipped}）`);

  // —— 价值类：收购价/融资估值 ≈ 真实价值，直接比预测区间 ——
  if (valueItems.length) {
    const o = summarize(valueItems);
    console.log(`\n【价值类（收购/融资估值，可直接比）】 ${valueItems.length} 个`);
    console.log(`  命中率(真实落在预测区间)：${o.hitRate}%   中位比(真实/预测中位)：${o.medianRatio}  ${o.medianRatio > 1 ? '(整体偏低估)' : o.medianRatio < 1 ? '(整体偏高估)' : ''}`);
    const byVer = {};
    for (const it of valueItems) (byVer[it.algo_version] = byVer[it.algo_version] || []).push(it);
    table('  按算法版本：', byVer);
    for (const it of valueItems.sort((a, b) => b.ratio - a.ratio))
      console.log(`  ${it.inRange ? '✓' : '✗'} bp#${it.bp_id} [${it.archetype}/${it.algo_version}/${it.type}] 真实 ¥${Math.round(it.realized).toLocaleString()}  预测 ¥${it.low.toLocaleString()}–¥${it.high.toLocaleString()}  比 ${it.ratio.toFixed(2)}  ${(it.title || '').slice(0, 22)}`);
  }

  // —— 营收类：ARR 不是估值，看"预测估值/ARR"的隐含倍数是否落在合理带 ——
  if (revItems.length) {
    const mults = revItems.map((x) => x.mult).filter((x) => x > 0).sort((a, b) => a - b);
    const medMult = median(mults);
    const inBand = revItems.filter((x) => x.mult >= MULT_LO && x.mult <= MULT_HI).length;
    console.log(`\n【营收类（真实数字是 ARR，非估值；改看隐含倍数 预测/ARR）】 ${revItems.length} 个`);
    console.log(`  隐含倍数中位：${medMult.toFixed(1)}×   落在合理带[${MULT_LO}–${MULT_HI}×]：${inBand}/${revItems.length}`);
    console.log(`  解读：倍数 < ${MULT_LO} = 相对营收偏保守；> ${MULT_HI} = 偏激进；在带内 = 估值倍数合理。`);
    for (const it of revItems.sort((a, b) => b.mult - a.mult)) {
      const tag = it.mult < MULT_LO ? '低' : it.mult > MULT_HI ? '激进' : '合理';
      console.log(`  [${tag}] bp#${it.bp_id} [${it.archetype}/${it.algo_version}] ARR ¥${Math.round(it.realized).toLocaleString()}  预测 ¥${it.low.toLocaleString()}–¥${it.high.toLocaleString()}  隐含 ${it.mult.toFixed(1)}×  ${(it.title || '').slice(0, 22)}`);
    }
  }

  console.log('\n说明：');
  console.log('  · 价值类用"真实金额是否落进预测区间"；中位比>1 偏低估、<1 偏高估。');
  console.log('  · 营收类不能直接比（估值通常是 ARR 的数倍），改看隐含倍数是否落在合理带。');
  console.log('  · 知名标的联网可搜到数字 → 命中偏高属"读数"非"预测"；真正校准靠前瞻式积累。');
  console.log('迭代：调权重/prompt 后 rerun 重跑，比较新旧版本——价值类看命中率/中位比趋近 1，营收类看隐含倍数落带率。\n');
}

main().catch((e) => { console.error(e); process.exit(1); });
