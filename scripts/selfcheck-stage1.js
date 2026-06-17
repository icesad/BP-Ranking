// 阶段 1 自检：一条命令核对"分类评分卡估值 + 改进建议 + 第一方信号"是否就位。
// 只读诊断（getDb 会顺带跑幂等迁移补齐字段），不调用任何 LLM、零花费。
// 用法（在 D:\BP-Ranking 下）：node scripts/selfcheck-stage1.js
const { getDb } = require('../lib/db');

let pass = 0, warn = 0, fail = 0;
const ok = (m) => { pass++; console.log('  ✅ ' + m); };
const wn = (m) => { warn++; console.log('  ⚠️  ' + m); };
const no = (m) => { fail++; console.log('  ❌ ' + m); };

function cols(db, table) {
  try { return db.prepare(`PRAGMA table_info(${table})`).all().map((r) => r.name); } catch { return []; }
}
function hasTable(db, t) {
  return !!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(t);
}

function main() {
  const db = getDb();

  console.log('\n=== 1) 表与字段 ===');
  hasTable(db, 'suggestions') ? ok('表 suggestions 存在') : no('缺表 suggestions');
  hasTable(db, 'bp_events') ? ok('表 bp_events 存在') : no('缺表 bp_events');
  const bpsCols = cols(db, 'bps');
  bpsCols.includes('archetype') ? ok('bps.archetype 已加') : no('bps 缺 archetype 列');
  cols(db, 'valuations').includes('algo_version') ? ok('valuations.algo_version 已加') : no('valuations 缺 algo_version');
  cols(db, 'valuation_history').includes('algo_version') ? ok('valuation_history.algo_version 已加') : no('缺 valuation_history.algo_version');
  cols(db, 'outcomes').includes('verified') ? ok('outcomes.verified 已加') : no('outcomes 缺 verified');
  const sc = cols(db, 'suggestions');
  sc.includes('evidence_needed') ? ok('suggestions.evidence_needed 已加') : no('suggestions 缺 evidence_needed');
  sc.includes('potential') ? ok('suggestions.potential 已加') : no('suggestions 缺 potential');

  console.log('\n=== 2) 代码导出 ===');
  try {
    const e = require('../lib/engine');
    ['compositeScore', 'classifyArchetypeFallback', 'ARCHETYPE_FOCUS', 'ARCHETYPE_WEIGHTS'].forEach((k) =>
      typeof e[k] !== 'undefined' ? ok(`engine.${k} 已导出`) : no(`engine 缺 ${k}`));
  } catch (err) { no('engine 载入失败：' + err.message); }
  try {
    const d = require('../lib/deepseek');
    ['scoreRubric', 'improvementPlan'].forEach((k) =>
      typeof d[k] === 'function' ? ok(`deepseek.${k} 已导出`) : no(`deepseek 缺 ${k}`));
  } catch (err) { no('deepseek 载入失败：' + err.message); }
  try {
    const q = require('../lib/queries');
    ['bpSuggestions', 'bpSignals'].forEach((k) =>
      typeof q[k] === 'function' ? ok(`queries.${k} 已导出`) : no(`queries 缺 ${k}`));
  } catch (err) { no('queries 载入失败：' + err.message); }

  console.log('\n=== 3) 数据状态 ===');
  const bpN = db.prepare('SELECT COUNT(*) c FROM bps').get().c;
  console.log(`  项目数 ${bpN}（demo ${db.prepare("SELECT COUNT(*) c FROM bps WHERE kind='demo'").get().c} / bp ${db.prepare("SELECT COUNT(*) c FROM bps WHERE kind='bp'").get().c}）`);
  const withArche = db.prepare("SELECT COUNT(*) c FROM bps WHERE archetype != ''").get().c;
  withArche > 0 ? ok(`已分类原型的项目 ${withArche}/${bpN}（上传/重估后会补全）`) : wn('还没有项目带 archetype——上传或重估一个看看');

  // 估值里有没有 v2 评分卡
  const valued = db.prepare("SELECT id, title, val_summary FROM bps WHERE val_summary != ''").all();
  let v2 = 0, hasRubric = 0;
  for (const r of valued) {
    let s = null; try { s = JSON.parse(r.val_summary); } catch {}
    if (!s) continue;
    if (s.algo_version === 'v2') v2++;
    if (s.rubric) hasRubric++;
  }
  console.log(`  已估值项目 ${valued.length}，其中 v2 算法 ${v2}、含评分卡 rubric ${hasRubric}`);
  if (valued.length && !hasRubric) wn('已估值的项目都还没有 rubric——对一个点"⚡强制重算"或"生成改进建议"即可补上');
  else if (hasRubric) ok('已有项目带 v2 评分卡 rubric');

  const sugN = db.prepare('SELECT COUNT(*) c FROM suggestions').get().c;
  const evN = db.prepare('SELECT COUNT(*) c FROM bp_events').get().c;
  console.log(`  改进建议条数 ${sugN}；第一方信号事件 ${evN}`);
  if (sugN === 0) wn('还没有改进建议——详情页点"生成改进建议"');
  if (evN === 0) wn('还没有第一方信号——打开一个 demo 详情页、操作几下再看');

  console.log('\n=== 结果 ===');
  console.log(`  PASS ${pass} · 注意 ${warn} · FAIL ${fail}`);
  if (fail === 0) console.log('  ✅ 阶段 1 结构就位。剩下的"注意项"多是还没产生数据，按提示在页面上操作即可。\n');
  else console.log('  ❌ 有 FAIL 项：通常重启 dev server 让迁移生效即可；仍失败请把上面输出发给我。\n');
}

try { main(); } catch (e) { console.error('自检出错：', e); process.exit(1); }
