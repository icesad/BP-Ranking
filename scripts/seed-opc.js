// 方向7：给 OPC 资源中心(/opc)灌入上海一人公司起始资源与社区。官方门户用确定域名(official=1)；
// 其余标「[示例]」请替换为你信任的链接（避免编造）。直接写库、不调 LLM。
//
// 用法（在 D:\BP-Ranking 下）：
//   node scripts/seed-opc.js          表为空时灌入起始内容
//   node scripts/seed-opc.js --force   清空后重灌（会覆盖现有 nav_links/communities）
//   node scripts/seed-opc.js clear     清空
(function loadEnv() {
  try { const fs = require('fs'); const path = require('path'); const txt = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8'); for (const line of txt.split('\n')) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ''); } } catch {}
})();
const { getDb } = require('../lib/db');

// [cat, title, url, desc, official, region]
const LINKS = [
  ['register', '上海一网通办（企业开办一站式）', 'https://zwdt.sh.gov.cn', '注册、变更、注销全流程线上办', 1, '上海'],
  ['register', '国家企业信用信息公示系统', 'https://www.gsxt.gov.cn', '查企业、年报公示', 1, ''],
  ['accounting', '国家税务总局上海市税务局', 'https://shanghai.chinatax.gov.cn', '电子税务局、申报、发票', 1, '上海'],
  ['accounting', '[示例] 代账服务', '', '替换成你信任的代账机构/SaaS（如好会计、慧算账等）', 0, ''],
  ['policy', '上海市人民政府（政策文件库）', 'https://www.shanghai.gov.cn', '政策原文检索', 1, '上海'],
  ['policy', '[示例] 小微/一人公司补贴汇总', '', '自行整理或对接资源库的政策梳理', 0, '上海'],
  ['office', '[示例] 共享办公/园区', '', '替换为你了解的共享办公或注册地址园区', 0, '上海'],
  ['legal', '[示例] 合同/法务模板', '', '替换为可信的合同模板源或法务对接', 0, ''],
  ['finance', '[示例] 对公开户绿色通道', '', '各银行小微企业开户指引', 0, ''],
  ['marketing', '[示例] 设计/营销外包', '', '可对接站内「资源对接」里的服务方', 0, ''],
  ['tools', '飞书', 'https://www.feishu.cn', '文档/多维表格/审批，一人公司常用', 0, ''],
  ['tools', 'Notion', 'https://www.notion.so', '知识库/任务', 0, ''],
  ['community', '[示例] 上海 OPC 社群', '', '替换为真实社群入口（微信群/Discord 等）', 0, '上海'],
];
// [name, region, type, desc, link]
const COMMUNITIES = [
  ['[示例] 上海一人公司交流群', '上海', 'OPC社群', '一人公司/独立开发者经验交流（替换为真实入口）', ''],
  ['[示例] 独立开发者线下聚会', '上海', '俱乐部', '不定期线下 meetup（替换为真实入口）', ''],
];

function main() {
  const db = getDb();
  const mode = process.argv[2];
  if (mode === 'clear' || mode === '--force') {
    db.prepare('DELETE FROM nav_links').run();
    db.prepare('DELETE FROM communities').run();
    console.log('已清空 nav_links / communities。');
    if (mode === 'clear') return;
  }
  const have = db.prepare('SELECT COUNT(*) c FROM nav_links').get().c;
  if (have > 0) { console.log(`nav_links 已有 ${have} 条。加 --force 可清空重灌。`); return; }

  const ln = db.prepare('INSERT INTO nav_links (category, title, url, description, official, region, sort) VALUES (?,?,?,?,?,?,?)');
  LINKS.forEach((x, i) => ln.run(x[0], x[1], x[2], x[3], x[4], x[5], i));
  const cm = db.prepare('INSERT INTO communities (name, region, type, description, link) VALUES (?,?,?,?,?)');
  COMMUNITIES.forEach((c) => cm.run(c[0], c[1], c[2], c[3], c[4]));
  console.log(`✅ 已灌入 ${LINKS.length} 条资源、${COMMUNITIES.length} 个社区。打开 /opc 查看。`);
  console.log('   标「[示例]」的请在数据库或后续编辑里替换为真实链接；官方门户已用确定域名。\n');
}

try { main(); } catch (e) { console.error(e); process.exit(1); }
