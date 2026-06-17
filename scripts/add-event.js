// 活动录入（阶段 5）：CLI 录入/删除 vibecoding 圈活动到 events 表。活动信息建议人工核对（日期/报名链接要准）。
//
// 用法（在 D:\BP-Ranking 下）：
//   node scripts/add-event.js sample
//     插入 2 条【示例】活动，便于先看页面（之后可 del 删掉）
//   node scripts/add-event.js add "标题" "地区" "YYYY-MM-DD" "报名URL" "主办" "地点" "描述"
//     录入一条（地区/日期/报名URL/主办/地点/描述 均可留空字符串 ""）
//   node scripts/add-event.js list
//     列出现有活动及 id
//   node scripts/add-event.js del <id>
//     删除指定活动
(function loadEnv() {
  try { const fs = require('fs'); const path = require('path'); const txt = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8'); for (const line of txt.split('\n')) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ''); } } catch {}
})();
const { getDb } = require('../lib/db');

function futureDate(days) { const d = new Date(Date.now() + days * 86400000); return d.toISOString().slice(0, 10); }

function insert(db, e) {
  return db.prepare(`INSERT INTO events (title, host, region, venue, start_at, end_at, signup_url, source_url, description, tags)
    VALUES (?,?,?,?,?,?,?,?,?,?)`).run(
    e.title, e.host || '', e.region || '', e.venue || '', e.start_at || '', e.end_at || '',
    e.signup_url || '', e.source_url || '', e.description || '', JSON.stringify(e.tags || [])
  );
}

function main() {
  const db = getDb();
  const cmd = process.argv[2];

  if (cmd === 'list') {
    const rows = db.prepare('SELECT id, title, region, start_at, signup_url FROM events ORDER BY start_at').all();
    if (!rows.length) { console.log('（暂无活动）'); return; }
    for (const r of rows) console.log(`  #${r.id}  ${r.start_at || '待定'}  ${r.region ? '['+r.region+'] ' : ''}${r.title}${r.signup_url ? '  ↗有报名' : ''}`);
    return;
  }
  if (cmd === 'del') {
    const id = Number(process.argv[3]);
    if (!id) { console.log('用法：node scripts/add-event.js del <id>'); return; }
    const r = db.prepare('SELECT title FROM events WHERE id = ?').get(id);
    if (!r) { console.log(`没有 id=${id} 的活动。`); return; }
    db.prepare('DELETE FROM events WHERE id = ?').run(id);
    console.log(`✅ 已删除活动 #${id}「${r.title}」。`);
    return;
  }
  if (cmd === 'sample') {
    insert(db, { title: '[示例] 上海 Vibe Coder 周末聚会', host: 'OPC 社区', region: '上海', venue: '徐汇 · 某共享空间', start_at: futureDate(10), signup_url: 'https://example.com/signup', description: '示例活动，可删除。AI 编程作品互评 + 自由交流。', tags: ['聚会', '上海'] });
    insert(db, { title: '[示例] AI 产品 48 小时黑客松', host: 'Indie 社群', region: '线上', venue: 'Online', start_at: futureDate(24), signup_url: 'https://example.com/hackathon', description: '示例活动，可删除。组队用 AI 快速做产品并路演。', tags: ['黑客松'] });
    console.log('✅ 已插入 2 条【示例】活动。打开 /events 查看；用 node scripts/add-event.js list 看 id，del 删除。');
    return;
  }
  if (cmd === 'add') {
    const [, , , title, region, start_at, signup_url, host, venue, description] = process.argv;
    if (!title) { console.log('用法：node scripts/add-event.js add "标题" "地区" "YYYY-MM-DD" "报名URL" "主办" "地点" "描述"'); return; }
    insert(db, { title, region, start_at, signup_url, host, venue, description, tags: [] });
    console.log(`✅ 已录入活动「${title}」。打开 /events 查看。`);
    return;
  }
  console.log('用法：node scripts/add-event.js [sample|add|list|del]\n  sample=插入示例  add=录入  list=列出  del <id>=删除');
}

try { main(); } catch (e) { console.error(e); process.exit(1); }
