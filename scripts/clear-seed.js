// 清理"无文件的旧种子BP"。默认预览(DRY RUN)，加 --yes 才真正删除。
// 删除时会退还对应投资人的虚拟资金，维持“持仓+现金=1亿”不变量。
const path = require('path');
const Database = require('better-sqlite3');

const db = new Database(path.join(process.cwd(), 'data', 'bp-ranking.db'));
const apply = process.argv.includes('--yes');

const seeds = db.prepare(
  "SELECT id, title FROM bps WHERE kind='bp' AND (filename IS NULL OR filename='') ORDER BY id"
).all();

if (seeds.length === 0) {
  console.log('没有发现【无文件的旧种子BP】，无需清理。');
  process.exit(0);
}

console.log(`发现 ${seeds.length} 个待清理的旧种子BP：`);
for (const s of seeds) console.log(`  #${s.id}  ${s.title}`);

if (!apply) {
  console.log('\n以上是预览（DRY RUN），未做任何改动。');
  console.log('确认无误后运行：  node scripts/clear-seed.js --yes');
  process.exit(0);
}

const ids = seeds.map((s) => s.id);
const ph = ids.map(() => '?').join(',');

const tx = db.transaction(() => {
  const holds = db.prepare(`SELECT investor_id, amount FROM holdings WHERE bp_id IN (${ph}) AND amount > 0`).all(...ids);
  for (const h of holds) {
    db.prepare('UPDATE investors SET cash = cash + ? WHERE id = ?').run(h.amount, h.investor_id); // 旧种子均为BP赛道，退回 cash 池
  }
  for (const tbl of ['holdings', 'transactions', 'evaluations', 'rank_snapshots', 'notifications']) {
    db.prepare(`DELETE FROM ${tbl} WHERE bp_id IN (${ph})`).run(...ids);
  }
  db.prepare(`DELETE FROM bps WHERE id IN (${ph})`).run(...ids);
});
tx();

console.log(`\n✅ 已清理 ${ids.length} 个旧种子BP，并退还对应虚拟资金。刷新浏览器即可看到更新后的榜单。`);
