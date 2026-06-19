// 演示用：给测试搭子(provider='seed' 的 vibe_alice/bob/carol)生成独特头像，并把他们报名到若干"未过期"活动上，
// 这样活动页就能直观看到"搭子去了哪些活动"。幂等、可重复跑。
// 用法（D:\BP-Ranking 下）：
//   node scripts/seed-buddy-attendance.js          写头像 + 报名若干活动
//   node scripts/seed-buddy-attendance.js clear     仅清除这些测试搭子的报名记录（不动头像）
(function loadEnv() {
  try { const fs = require('fs'); const path = require('path'); const txt = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8'); for (const line of txt.split('\n')) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ''); } } catch {}
})();
const { getDb } = require('../lib/db');
const { avatarDataUri } = require('../lib/avatar');

function main() {
  const db = getDb();
  const buddies = db.prepare("SELECT id, handle FROM users WHERE provider='seed' ORDER BY id").all();
  if (!buddies.length) { console.log('没有测试搭子。先跑：node scripts/seed-test-owners.js'); return; }

  if (process.argv[2] === 'clear') {
    const ids = buddies.map((b) => b.id);
    const ph = ids.map(() => '?').join(',');
    const info = db.prepare(`DELETE FROM event_attendees WHERE user_id IN (${ph})`).run(...ids);
    console.log(`已清除测试搭子报名 ${info.changes} 条。`);
    return;
  }

  // 1) 给每个测试搭子写独特头像（identicon），match/活动/主页全站一致
  const setAva = db.prepare('UPDATE users SET avatar = ? WHERE id = ?');
  for (const b of buddies) setAva.run(avatarDataUri(b.handle), b.id);

  // 2) 报名：每个城市取未过期活动（含待定），让搭子错落分布到不同活动，制造"有的活动多人去、有的1人去"的演示效果
  const cities = db.prepare("SELECT DISTINCT city FROM events WHERE city != ''").all().map((r) => r.city);
  const ins = db.prepare('INSERT OR IGNORE INTO event_attendees (event_id, user_id, city) VALUES (?,?,?)');
  let n = 0;
  for (const city of cities.length ? cities : ['上海']) {
    const evs = db.prepare(`SELECT id FROM events WHERE city = ? AND (start_at = '' OR start_at >= date('now')) ORDER BY (start_at='') ASC, start_at ASC LIMIT 8`).all(city);
    evs.forEach((e, i) => {
      // 分布：活动0→全员；1→A,B；2→C；3→A,C；4→B；以此类推，保证演示里头像有疏有密
      const pattern = [[0, 1, 2], [0, 1], [2], [0, 2], [1], [0], [1, 2], [0, 1, 2]][i % 8];
      for (const bi of pattern) { const b = buddies[bi % buddies.length]; if (b) { const r = ins.run(e.id, b.id, city); n += r.changes; } }
    });
  }
  console.log(`✅ 已为 ${buddies.length} 个测试搭子写头像，并新增报名 ${n} 条（覆盖城市：${(cities.length ? cities : ['上海']).join('、')}）。`);
  console.log('   打开 /events 切到对应城市，即可看到搭子头像落在各活动上。清除报名：node scripts/seed-buddy-attendance.js clear');
}

try { main(); } catch (e) { console.error(e); process.exit(1); }
