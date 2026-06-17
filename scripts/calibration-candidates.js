// 前瞻式校准：列出"已估值、但还没回填真实结果(outcome)"的项目——这些就是你该定期去查证真实进展的对象。
// 只读、零花费。每隔一段时间跑一次，对清单里"估值已久"的项目去查有没有真融资/营收/收购/停运，
// 有的话在站内详情页「报告真实进展」带来源录入 → /calibration 看板就会多一条"预测 vs 现实"。
//
// 关键原则（务必遵守，否则校准就作弊了）：
//   估值必须"盲"——在结果发生/公开之前做出。所以：记录 outcome 后【不要】再对它"强制重算"，
//   否则 floor 会把答案泄漏进估值，那条就不再是真预测。回测读的是历史 val_summary（盲估那次），保持原样即可。
//
// 用法（在 D:\BP-Ranking 下）：
//   node scripts/calibration-candidates.js          列出全部"已估值缺结果"的项目（按估值额从高到低）
//   node scripts/calibration-candidates.js 30        只看估值时间已超过 30 天的（更可能已有真实进展）
(function loadEnv() {
  try {
    const fs = require('fs'); const path = require('path');
    const txt = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8');
    for (const line of txt.split('\n')) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ''); }
  } catch {}
})();
const { getDb } = require('../lib/db');

function money(n) { n = Number(n) || 0; const a = Math.abs(n); if (a >= 1e8) return '¥' + (n / 1e8).toFixed(2) + '亿'; if (a >= 1e4) return '¥' + (n / 1e4).toFixed(1) + '万'; return '¥' + Math.round(n).toLocaleString(); }
function daysSince(dateStr) { const t = Date.parse((dateStr || '') + 'T00:00:00'); return isNaN(t) ? null : Math.floor((Date.now() - t) / 86400000); }

function main() {
  const db = getDb();
  const minDays = Number(process.argv[2]) || 0;

  const rows = db.prepare(`
    SELECT b.id, b.title, b.kind, b.archetype, b.val_summary,
      (SELECT COUNT(*) FROM outcomes o WHERE o.bp_id = b.id AND o.type IN ('raised','acquired','revenue') AND o.amount > 0) AS n_outcome
    FROM bps b
    WHERE b.visibility = 'public' AND b.val_summary != ''
  `).all();

  const cands = [];
  for (const r of rows) {
    if (r.n_outcome > 0) continue; // 已有结果，不用回填
    let s = null; try { s = JSON.parse(r.val_summary || 'null'); } catch {}
    if (!s || !(s.n > 0) || !(s.low > 0)) continue;
    const age = daysSince(s.at);
    if (minDays && (age == null || age < minDays)) continue;
    cands.push({ id: r.id, title: r.title, kind: r.kind, archetype: r.archetype || s.archetype || '?', low: s.low, high: s.high, at: s.at || '?', age, ver: s.algo_version || 'v1' });
  }
  cands.sort((a, b) => (b.high || 0) - (a.high || 0));

  console.log('\n========== 待回填真实结果的项目（前瞻式校准候选） ==========');
  console.log(`已估值、暂无货币结果的项目：${cands.length} 个${minDays ? `（仅看估值已超 ${minDays} 天的）` : ''}\n`);
  if (!cands.length) { console.log('（暂无候选——要么都已回填，要么还没有项目估过值。）\n'); return; }

  for (const c of cands) {
    console.log(`  bp#${c.id} 「${(c.title || '?').slice(0, 26)}」 [${c.archetype}/${c.ver}]  估值 ${money(c.low)}–${money(c.high)}  于 ${c.at}${c.age != null ? `（${c.age} 天前）` : ''}`);
  }
  console.log('\n下一步：对这些项目去查有没有真实进展（融资/营收/被收购/停运）。');
  console.log('  · 有 → 站内详情页「报告真实进展」带【来源链接】录入（务必勾选/标注可核实），它会进 /calibration 看板。');
  console.log('  · 记录结果后【不要】再"强制重算"该项目，否则会把答案泄漏进估值、破坏"盲预测"。');
  console.log('  · 定期(如每月)跑一次本脚本，把校准看板越积越厚——这才是不受"联网读数"污染的真信号。\n');
}

try { main(); } catch (e) { console.error(e); process.exit(1); }
