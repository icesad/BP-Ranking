// 给"杭州"城市灌入与上海同构的模块数据：资源导航 / 社区(园区) / 活动 / 资讯。数据来自联网检索(2026-06)，
// 官方门户标 official；具体活动带来源链接；不确定 URL 留空(不编造)。直接写库、按标题去重、可重复跑。
// 用法（在 D:\BP-Ranking 下）：node scripts/seed-hangzhou.js   （清除：node scripts/seed-hangzhou.js clear）
(function loadEnv() {
  try { const fs = require('fs'); const path = require('path'); const txt = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8'); for (const line of txt.split('\n')) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ''); } } catch {}
})();
const { getDb } = require('../lib/db');
const CITY = '杭州';

// 资源导航 [category,title,url,description,official,region]
const NAV = [
  ['register', '浙江政务服务网', 'https://www.zjzwfw.gov.cn', '企业开办/注册/变更一网通办', 1, '杭州'],
  ['register', '杭州市市场监督管理局', 'https://scjg.hangzhou.gov.cn', '工商注册、年报、经营异常', 1, '杭州'],
  ['policy', '杭州市人民政府（政策文件）', 'https://www.hangzhou.gov.cn', '政策原文检索', 1, '杭州'],
  ['policy', '杭州市建设人工智能产业发展高地实施方案(2025版)', 'https://www.zjintel.com/article-item-4826.html', 'AI 产业政策（征求意见）', 0, '杭州'],
  ['finance', '创客天下·杭向未来（海外高层次人才创新创业大赛）', 'https://rchkt.hrss.hangzhou.gov.cn/page/competition.html', '人才创业大赛/路演/资金支持', 1, '杭州'],
  ['tools', '联谱 Lianpu（活动平台）', 'https://lianpu.com', '发现杭州 AI/创业 活动与路演', 0, '杭州'],
  ['policy', '上城区 OPC 专项扶持政策（浙江省首个区级）', 'https://ori.hangzhou.com.cn/ornews/content/2026-01/24/content_9167599.htm', '亿元专项基金 + 2万㎡创业社区 + 极速审批', 1, '上城区'],
  ['finance', '高新区(滨江) AI 算力补助', 'https://www.hangzhou.gov.cn', '面向 AI 创业者算力补助最高 100万/年 + 办公空间补贴', 0, '滨江区'],
  ['office', '[示例] 共享办公/数字游民空间', '', '替换为你了解的杭州共享办公/数字游民社区', 0, '杭州'],
];
// 社区/园区 [name,region,type,description,link]
const COMMUNITIES = [
  ['人工智能小镇（未来科技城）', '余杭区', 'AI特色小镇', '城西科创大走廊核心，约3.43km²，聚焦机器人、智能硬件、无人机、VR/AR、大数据云计算物联网。', 'https://y.qianzhan.com/yuanqu/item/fe437b929d98edd9.html'],
  ['梦想小镇', '余杭区', '互联网创业', '以互联网+创业与商业模式创新为主，创业者与孵化资源密集。', ''],
  ['云栖小镇', '西湖区', '云计算/AI', '云计算与人工智能产业小镇，约2361亩，云栖大会发源地。', 'https://y.qianzhan.com/yuanqu/item/fe758f11caa3a2fa.html'],
  ['图灵小镇', '萧山区', '数字/AI', '萧山数字经济与人工智能特色小镇。', ''],
  ['智慧网谷小镇', '拱墅区', '数字经济', '拱墅数字经济特色小镇。', ''],
  ['具身智能机器人小镇', '滨江区', '机器人/具身智能', '滨江区面向具身智能与机器人方向的产业小镇。', ''],
  ['中国数谷', '上城区', '数据要素/AI', '杭州东站西广场，数据要素与 AI 创业活动聚集地。', ''],
  ['鸿鹄会 OPC 创业社区', '上城区', 'OPC社区', '推出全国首个"一人公司"操作系统 OPC-OS；上城打造 OPC 创业第一城。', 'https://ori.hangzhou.com.cn/ornews/content/2026-01/24/content_9167599.htm'],
  ['才立方创业中心', '临平区', '创业服务', '专门服务数字游民、自由职业者与小微创业者：注册代办、技术资源对接、法律咨询。', ''],
  ['良渚数栖湾 AI+产业社区', '余杭区', 'AI产业社区', '"一核两翼"孵化体系，覆盖全周期创业支撑链条。', ''],
  ['四季青 OPC 接单社区（AI五小凤）', '上城区', 'OPC社区', '"AI五小凤"落子上城四季青，让"一人公司"有单可接。', 'https://ori.hangzhou.com.cn/ornews/content/2026-05/20/content_9226173.htm'],
];
// 活动 {start_at,time_text,region,category,price,title,host,venue,description,signup_url}
const EVENTS = [
  { start_at: '2026-03-11', time_text: '3.11-3.13', region: '萧山区', category: '峰会', price: '', title: '2026中国通用人工智能大会暨展览会（杭州）', host: '', venue: '杭州国际博览中心', description: '聚焦大模型商业化落地、数据安全与隐私等；500+参展品牌、30000+观众。', signup_url: 'https://expopromo.cn/event/78400/' },
  { start_at: '2026-05-23', time_text: '5.23-5.24', region: '杭州', category: '峰会', price: '', title: 'GAITC 2026 全球人工智能技术大会', host: '中国人工智能学会', venue: '', description: '连续第七年在杭举办，聚焦具身智能、脑机交互、时空智能等前沿。', signup_url: 'https://gaitc.caai.cn/' },
  { start_at: '2026-03-21', time_text: '', region: '上城区', category: '沙龙', price: '', title: 'AI知声 第三期（聚焦OPC/OpenClaw/OVERSEA）', host: '', venue: '杭州东站西广场·中国数谷', description: '聚焦一人公司(OPC)、OpenClaw 与出海新机遇的线下交流。', signup_url: 'https://zhuanlan.zhihu.com/p/2014627561800483418' },
  { start_at: '', time_text: '', region: '杭州', category: '路演', price: '免费', title: '创客天下·杭向未来 海外高层次人才创新创业大赛（AI赛道·决赛路演）', host: '杭州市人社局', venue: '', description: 'AI 赛道项目现场路演决赛，于杭州国际人才交流大会期间举行。', signup_url: 'https://rchkt.hrss.hangzhou.gov.cn/page/competition.html' },
  { start_at: '', time_text: '', region: '杭州', category: '沙龙', price: '', title: '联谱 · AI 产品实战路演与共创互助沙龙', host: '联谱 Lianpu', venue: '', description: 'AI 产品实战路演与共创互助（定期，含 Demo 路演）。', signup_url: 'https://lianpu.com/category/ai' },
];
// 资讯 [title,summary,source_url,source_name,tags,region]
const NEWS = [
  ['杭州"一人公司"孵化社区崛起，超级个体时代来临', 'AI 重塑创业格局，杭州涌现一人公司/OPC 孵化社区。', 'https://blog.csdn.net/RUZHUA/article/details/151624256', 'CSDN', ['OPC', '杭州'], '杭州'],
  ['"杭州之路"：重新定义创业者的应许之地', '杭州以社区生态与低成本创业环境吸引大量创业者与数字游民。', 'https://www.21jingji.com/article/20250214/herald/91f498f0faf0455ff13df57dee5b4d9c.html', '21经济网', ['创业', '杭州'], '杭州'],
  ['揭秘！杭州 AI 竟藏于这座小镇', '杭州 AI 产业与特色小镇深度绑定的观察。', 'https://eu.36kr.com/zh/p/3631530874712841', '36氪', ['AI', '小镇'], '杭州'],
  ['杭州市建设人工智能产业发展高地实施方案(2025版) 征求意见', '杭州 AI 产业发展高地政策公开征求意见。', 'https://www.zjintel.com/article-item-4826.html', '浙江智能', ['政策', 'AI'], '杭州'],
  ['2026年国内 OPC 社区全景地图（含杭州）', '梳理全国 OPC/一人公司社区，含杭州。', 'https://blog.csdn.net/HiWangWenBing/article/details/158318438', 'CSDN', ['OPC'], '杭州'],
  ['杭州"一人公司"养成记：热潮之下，生态兴起', '杭州 OPC 生态从政策、社区到服务的全面兴起。', 'https://www.21jingji.com/article/20260320/herald/cace6b8d46f73edc8f8402d52ba85ac3.html', '21经济网', ['OPC', '生态'], '杭州'],
  ['全国首个 OPC 操作系统上线，杭州上城打造 OPC 创业第一城', '上城区"鸿鹄会"发布 OPC-OS，亿元基金+2万㎡社区。', 'https://ori.hangzhou.com.cn/ornews/content/2026-01/24/content_9167599.htm', '杭州网', ['OPC', '上城'], '上城区'],
  ['三天三场 OPC 盛会席卷杭州：AI 赋能"一人公司"', 'AI 赋能一人公司，超级个体如何重塑创业生态。', 'https://www.hzsc.com.cn/content/content_9872235.html', '上城新闻网', ['OPC', '活动'], '杭州'],
  ['"一人公司"成新爆点，杭州何以抢占风口？', '杭州抢占一人公司风口的政策与生态打法。', 'https://hznews.hangzhou.com.cn/chengshi/content/2026-02/03/content_9172607.htm', '杭州网', ['OPC'], '杭州'],
];

function main() {
  const db = getDb();
  if (process.argv[2] === 'clear') {
    for (const t of ['nav_links', 'communities', 'events', 'news']) { try { db.prepare(`DELETE FROM ${t} WHERE city = ?`).run(CITY); } catch {} }
    console.log('已清除杭州数据。'); return;
  }
  let n = 0;
  const navHas = db.prepare('SELECT 1 FROM nav_links WHERE title=? AND city=?');
  const navIns = db.prepare('INSERT INTO nav_links (category,title,url,description,official,region,city,sort) VALUES (?,?,?,?,?,?,?,?)');
  NAV.forEach((x, i) => { if (!navHas.get(x[1], CITY)) { navIns.run(x[0], x[1], x[2], x[3], x[4], x[5], CITY, i); n++; } });

  const cmHas = db.prepare('SELECT 1 FROM communities WHERE name=? AND city=?');
  const cmIns = db.prepare('INSERT INTO communities (name,region,type,description,link,city) VALUES (?,?,?,?,?,?)');
  COMMUNITIES.forEach((c) => { if (!cmHas.get(c[0], CITY)) { cmIns.run(c[0], c[1], c[2], c[3], c[4], CITY); n++; } });

  const evHas = db.prepare('SELECT 1 FROM events WHERE title=? AND city=?');
  const evIns = db.prepare('INSERT INTO events (title,host,region,venue,start_at,end_at,signup_url,source_url,description,tags,category,price,time_text,city) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
  EVENTS.forEach((e) => { if (!evHas.get(e.title, CITY)) { evIns.run(e.title, e.host || '', e.region || '', e.venue || '', e.start_at || '', '', e.signup_url || '', '', e.description || '', '[]', e.category || '', e.price || '', e.time_text || '', CITY); n++; } });

  const nwHas = db.prepare('SELECT 1 FROM news WHERE title=? AND city=?');
  const nwIns = db.prepare('INSERT INTO news (title,summary,source_url,source_name,tags,region,city) VALUES (?,?,?,?,?,?,?)');
  NEWS.forEach((x) => { if (!nwHas.get(x[0], CITY)) { nwIns.run(x[0], x[1], x[2], x[3], JSON.stringify(x[4]), x[5], CITY); n++; } });

  console.log(`✅ 杭州数据已灌入：${n} 条（导航 ${NAV.length}、社区 ${COMMUNITIES.length}、活动 ${EVENTS.length}、资讯 ${NEWS.length}，按标题去重）。`);
  console.log('   顶部城市切换到「杭州」，/opc /news /events /resources 即显示杭州内容。');
}

try { main(); } catch (e) { console.error(e); process.exit(1); }
