// 批量导入活动：读取一个 JSON 数组文件，写入 events 表（按标题去重）。
// 配合"用 Claude-in-Chrome 从 OnePilot 抽全部活动"使用：把抽到的 JSON 存到 data/onepilot-events.json 再跑本脚本。
//
// 用法（在 D:\BP-Ranking 下）：
//   node scripts/import-events-json.js                 读 data/onepilot-events.json
//   node scripts/import-events-json.js 路径.json        指定文件
//
// JSON 期望：数组，每项字段（缺的留空字符串）：
//   { "title":"", "start_at":"2026-06-17", "time_text":"14:00-15:15",
//     "region":"上海", "category":"线下公开课", "price":"免费",
//     "host":"", "venue":"", "description":"", "signup_url":"" }
const fs = require('fs');
const path = require('path');
const { getDb } = require('../lib/db');

function main() {
  const file = process.argv[2] || path.join(process.cwd(), 'data', 'onepilot-events.json');
  if (!fs.existsSync(file)) { console.log(`找不到文件：${file}\n请把 Chrome 抽到的活动 JSON 存到这里再跑。`); return; }
  let arr;
  try { arr = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { console.log('JSON 解析失败：', e.message); return; }
  if (!Array.isArray(arr)) { console.log('JSON 顶层必须是数组 []。'); return; }

  const db = getDb();
  const has = db.prepare('SELECT 1 FROM events WHERE title = ?');
  const ins = db.prepare(`INSERT INTO events (title, host, region, venue, start_at, end_at, signup_url, source_url, description, tags, category, price, time_text)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  let added = 0, skip = 0;
  const tx = db.transaction(() => {
    for (const e of arr) {
      const title = String(e?.title || '').trim();
      if (!title) { skip++; continue; }
      if (has.get(title)) { skip++; continue; }
      ins.run(title, String(e.host || ''), String(e.region || ''), String(e.venue || ''),
        String(e.start_at || ''), String(e.end_at || ''), String(e.signup_url || ''),
        String(e.source_url || ''), String(e.description || ''), '[]',
        String(e.category || ''), String(e.price || ''), String(e.time_text || ''));
      added++;
    }
  });
  tx();
  const total = db.prepare('SELECT COUNT(*) c FROM events').get().c;
  console.log(`✅ 导入完成：新增 ${added}，去重/跳过 ${skip}；events 现有 ${total} 条。打开 /events 查看。`);
}

try { main(); } catch (e) { console.error(e); process.exit(1); }
