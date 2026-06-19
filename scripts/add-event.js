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
  if (db.prepare('SELECT 1 FROM events WHERE title = ?').get(e.title)) return; // 按标题去重
  return db.prepare(`INSERT INTO events (title, host, region, venue, start_at, end_at, signup_url, source_url, description, tags, category, price, time_text)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    e.title, e.host || '', e.region || '', e.venue || '', e.start_at || '', e.end_at || '',
    e.signup_url || '', e.source_url || '', e.description || '', JSON.stringify(e.tags || []),
    e.category || '', e.price || '', e.time_text || ''
  );
}
// OnePilot 活动日历 2026 年 6 月真实样本（来源含小红书，需点开扫码）
const ONEPILOT = [
  { start_at: '2026-06-03', time_text: '09:00-12:00', region: '上海', category: '峰会', price: '', title: '2026上海超级个体（OPC）经济大会', host: '', description: '聚焦一人公司/超级个体的经济大会。' },
  { start_at: '2026-06-04', time_text: '19:00-21:30', region: '上海', category: '沙龙', price: '', title: 'Open Drink-Founder Mixer创业小酒馆3.0第26期', host: '', description: '创业者社交小酒馆。' },
  { start_at: '2026-06-04', time_text: '20:30-22:00', region: '上海', category: 'Meetup', price: '', title: '上海线下 | AI创意 OPEN DECK活动', host: '', description: 'AI 创意分享与展示。' },
  { start_at: '2026-06-05', time_text: '下午2:00', region: '上海', category: '沙龙', price: '', title: 'AI时代下数据知识产权保护和价值评估——走进国家知识产权运营（上海）国际服务平台', host: '国家知识产权运营（上海）国际服务平台', description: '走进平台，探讨 AI 时代数据知识产权保护与价值评估。' },
  { start_at: '2026-06-06', time_text: '17:00-19:00', region: '上海', category: '路演', price: '', title: 'AI Nova 点火之夜', host: '', description: 'AI 项目路演之夜。' },
  { start_at: '2026-06-06', time_text: '13:00-17:00', region: '上海', category: '工作坊', price: '', title: '智能体精细化管理与算力-Token 规模化运营实践', host: '', description: '智能体精细化管理与算力/Token 规模化运营实践。' },
  { start_at: '2026-06-07', time_text: '14:30-18:00', region: '上海', category: 'Meetup', price: '', title: '真格 00 后 Vibe Meeting', host: '真格基金', description: '面向 00 后创业者的聚会。' },
  { start_at: '2026-06-07', time_text: '14:00-17:00', region: '上海', category: '沙龙', price: '', title: 'AI创业秘聊局05期 | AI OPC从0到1全链路落地，单人成军 AI破局', host: '', description: 'AI OPC 从 0 到 1 全链路落地、单人成军。' },
  { start_at: '2026-06-09', time_text: '19:00-21:30', region: '上海', category: 'GEEK NIGHT TALK', price: '50元参会押金', title: '当AI开始拥有记忆', host: '上海模速空间、Think AI星科社区', venue: '上海模速空间B区三楼多功能厅', description: '极客夜话：AI 记忆从便利到边界，含两场记忆实验。' },
  { start_at: '2026-06-17', time_text: '14:00-15:15', region: '上海', category: '线下公开课', price: '69.90元', title: '柚米Club「AIGC线下公开课」', host: '柚米club-社交组局', venue: '西康路WeWork 3楼公区', description: 'AIGC 新手避坑、免费工具推荐、大佬资源对接，到场可领 WeWork 福利包。' },
  { start_at: '2026-06-17', time_text: '15:30-17:30', region: '上海', category: '挑战赛', price: '免费', title: 'WAIC Future Tech OPC独立先锋挑战赛总决赛', host: 'WAIC Future Tech OPC', venue: '世博滨江酒店四季厅', description: 'WAIC OPC 独立先锋挑战赛总决赛，多团队展示 AI 创业项目。' },
];

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
    let n = 0; for (const e of ONEPILOT) { if (insert(db, e) !== undefined || true) n++; }
    console.log(`✅ 已灌入 OnePilot 2026年6月真实活动样本(按标题去重)。打开 /events 看列表+月历(深色版)。list 看 id，del 删除。`);
    return;
  }
  if (cmd === 'add') {
    const [, , , title, region, start_at, signup_url, host, venue, description, category, price, time_text] = process.argv;
    if (!title) { console.log('用法：node scripts/add-event.js add "标题" "地区" "YYYY-MM-DD" "报名URL" "主办" "地点" "描述" "类型" "价格" "时间段"'); return; }
    insert(db, { title, region, start_at, signup_url, host, venue, description, category, price, time_text, tags: [] });
    console.log(`✅ 已录入活动「${title}」。打开 /events 查看。`);
    return;
  }
  console.log('用法：node scripts/add-event.js [sample|add|list|del]\n  sample=插入示例  add=录入  list=列出  del <id>=删除');
}

try { main(); } catch (e) { console.error(e); process.exit(1); }
