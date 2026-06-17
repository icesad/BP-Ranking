// 重置并重新播种数据库：npm run seed
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(process.cwd(), 'data');
for (const f of ['bp-ranking.db', 'bp-ranking.db-wal', 'bp-ranking.db-shm']) {
  const p = path.join(DATA_DIR, f);
  if (fs.existsSync(p)) fs.unlinkSync(p);
}
const { getDb } = require('../lib/db');
getDb();
console.log('✅ 数据库已重置并重新播种（12位投资人 + 8份示例BP + 历史持仓记录）');
