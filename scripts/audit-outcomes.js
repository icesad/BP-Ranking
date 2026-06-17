// 数据卫生：审计 outcomes（真实结果）表，列出"金额与项目量级明显不符/来源缺失"的可疑记录，供人工确认删改。
// 只读；另带一个安全删除模式（按 outcome id 删单条），不用手写 SQL。
//
// 用法（在 D:\BP-Ranking 下）：
//   node scripts/audit-outcomes.js          列出全部货币结果，可疑项排前面并标原因
//   node scripts/audit-outcomes.js del 12    删除 id=12 的那条 outcome（删前会打印它的内容）
(function loadEnv() {
  try {
    const fs = require('fs'); const path = require('path');
    const txt = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8');
    for (const line of txt.split('\n')) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ''); }
  } catch {}
})();
const { getDb } = require('../lib/db');

function money(n) {
  n = Number(n) || 0; const a = Math.abs(n);
  if (a >= 1e8) return '¥' + (n / 1e8).toFixed(2) + '亿';
  if (a >= 1e4) return '¥' + (n / 1e4).toFixed(1) + '万';
  return '¥' + Math.round(n).toLocaleString();
}

const MONEY_TYPES = ['raised', 'acquired', 'revenue'];
const SMALL_DEAL = 1e6; // 融资/收购通常 ≥ ¥100万，低于此存疑

function main() {
  const db = getDb();
  const mode = process.argv[2];

  // 删除模式
  if (mode === 'del') {
    const id = Number(process.argv[3]);
    if (!id) { console.log('用法：node scripts/audit-outcomes.js del <outcomeId>'); return; }
    const row = db.prepare('SELECT o.*, b.title FROM outcomes o LEFT JOIN bps b ON b.id=o.bp_id WHERE o.id = ?').get(id);
    if (!row) { console.log(`没有 id=${id} 的 outcome。`); return; }
    console.log('将删除：', { id: row.id, bp: `#${row.bp_id} ${row.title || ''}`, type: row.type, amount: money(row.amount), source: row.source_url || '(无)', verified: row.verified });
    db.prepare('DELETE FROM outcomes WHERE id = ?').run(id);
    console.log(`✅ 已删除 outcome id=${id}。`);
    return;
  }

  // 审计模式（只读）
  const rows = db.prepare(`
    SELECT o.id, o.bp_id, o.type, o.amount, o.note, o.source_url, o.occurred_at, o.verified, b.title, b.val_summary
    FROM outcomes o LEFT JOIN bps b ON b.id = o.bp_id
    WHERE o.type IN ('raised','acquired','revenue') AND o.amount > 0
    ORDER BY o.bp_id, o.id
  `).all();

  // 统计每个项目的货币结果条数（查重复）
  const perBp = {};
  for (const r of rows) perBp[r.bp_id] = (perBp[r.bp_id] || 0) + 1;

  const flagged = [];
  for (const r of rows) {
    let valLow = 0, valHigh = 0;
    try { const s = JSON.parse(r.val_summary || 'null'); if (s) { valLow = s.low || 0; valHigh = s.high || 0; } } catch {}
    const flags = [];
    if ((r.type === 'raised' || r.type === 'acquired') && r.amount < SMALL_DEAL) flags.push('金额过小(融资/收购通常≥¥100万，疑似填错/测试值)');
    if (!r.verified && !(r.source_url && r.source_url.trim())) flags.push('无来源且未核实(不应计入 floor/回测)');
    if (valLow > 0 && r.amount > 0 && r.amount < valLow / 50) flags.push(`远低于模型估值下限(${money(valLow)})，差 >50×，需核对`);
    if (perBp[r.bp_id] > 1) flags.push('同项目有多条货币结果(回测只取最早一条，注意去重)');
    r._flags = flags; r._valLow = valLow; r._valHigh = valHigh;
    if (flags.length) flagged.push(r);
  }

  const line = (r) => `  outcome#${r.id}  bp#${r.bp_id} 「${(r.title || '?').slice(0, 22)}」  ${r.type}  ${money(r.amount)}` +
    `${r._valLow ? `  估值${money(r._valLow)}–${money(r._valHigh)}` : ''}  ${r.verified ? '已核实' : '未核实'}  来源:${r.source_url ? '有' : '无'}`;

  console.log('\n========== Outcomes 审计 ==========');
  console.log(`货币结果共 ${rows.length} 条；可疑 ${flagged.length} 条。\n`);

  if (flagged.length) {
    console.log('⚠️ 可疑（建议核对，必要时删除）：');
    for (const r of flagged) { console.log(line(r)); for (const f of r._flags) console.log(`       ↳ ${f}`); }
    console.log('\n删除某条：node scripts/audit-outcomes.js del <outcome#后面的数字>');
    console.log('改金额/来源：建议在站内详情页「报告真实进展」重填，或告诉我用脚本批量改。\n');
  } else {
    console.log('✅ 没有发现明显可疑的货币结果。\n');
  }

  const clean = rows.filter((r) => !r._flags.length);
  if (clean.length) {
    console.log('其余看起来正常的：');
    for (const r of clean) console.log(line(r));
    console.log('');
  }
}

try { main(); } catch (e) { console.error('审计出错：', e); process.exit(1); }
