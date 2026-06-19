// 批量导入 OPC 资源中心数据：资源导航(nav_links) 或 社区(communities)。配合 Claude-in-Chrome 抽 OnePilot 用。
//
// 用法（在 D:\BP-Ranking 下）：
//   node scripts/import-opc-json.js nav data/onepilot-nav.json
//   node scripts/import-opc-json.js community data/onepilot-communities.json
//
// nav JSON：数组，每项 { "category":"register", "title":"", "url":"", "description":"", "region":"", "official":0 }
//   category 可用预设(register/accounting/policy/office/legal/finance/marketing/tools/community)，
//   也可直接用 OnePilot 的中文分类名(页面会原样显示)。
// community JSON：数组，每项 { "name":"", "region":"", "type":"", "description":"", "link":"" }
const fs = require('fs');
const path = require('path');
const { getDb } = require('../lib/db');

function readArr(file) {
  if (!fs.existsSync(file)) { console.log(`找不到文件：${file}`); return null; }
  try { const a = JSON.parse(fs.readFileSync(file, 'utf8')); return Array.isArray(a) ? a : (console.log('JSON 顶层须是数组'), null); }
  catch (e) { console.log('JSON 解析失败：', e.message); return null; }
}

function main() {
  const kind = process.argv[2];
  const file = process.argv[3] || (kind === 'nav' ? 'data/onepilot-nav.json' : 'data/onepilot-communities.json');
  if (kind !== 'nav' && kind !== 'community') { console.log('用法：node scripts/import-opc-json.js [nav|community] <文件>'); return; }
  const arr = readArr(path.isAbsolute(file) ? file : path.join(process.cwd(), file));
  if (!arr) return;
  const db = getDb();
  let added = 0, skip = 0;

  if (kind === 'nav') {
    const has = db.prepare('SELECT 1 FROM nav_links WHERE title = ? AND category = ?');
    const ins = db.prepare('INSERT INTO nav_links (category, title, url, description, region, official, sort) VALUES (?,?,?,?,?,?,?)');
    const tx = db.transaction(() => {
      arr.forEach((e, i) => {
        const title = String(e?.title || '').trim(); const category = String(e?.category || 'other').trim();
        if (!title) { skip++; return; }
        if (has.get(title, category)) { skip++; return; }
        ins.run(category, title, String(e.url || ''), String(e.description || ''), String(e.region || ''), e.official ? 1 : 0, i);
        added++;
      });
    });
    tx();
  } else {
    const has = db.prepare('SELECT 1 FROM communities WHERE name = ?');
    const ins = db.prepare('INSERT INTO communities (name, region, type, description, link) VALUES (?,?,?,?,?)');
    const tx = db.transaction(() => {
      for (const e of arr) {
        const name = String(e?.name || '').trim();
        if (!name) { skip++; continue; }
        if (has.get(name)) { skip++; continue; }
        ins.run(name, String(e.region || ''), String(e.type || ''), String(e.description || ''), String(e.link || ''));
        added++;
      }
    });
    tx();
  }
  console.log(`✅ ${kind} 导入完成：新增 ${added}，去重/跳过 ${skip}。打开 /opc 查看。`);
}

try { main(); } catch (e) { console.error(e); process.exit(1); }
