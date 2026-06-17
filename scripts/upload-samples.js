// 批量"上传" 2026-06-10-样例BP 里的 8 份 PPT，走与网页上传完全相同的评估流程。
// 用法（在 D:\BP-Ranking 下，dev server 可开着）：node scripts/upload-samples.js
const path = require('path');
const fs = require('fs');
const { getDb, DATA_DIR } = require('../lib/db');
const { extractPptxText } = require('../lib/pptx');
const { detectSector } = require('../lib/engine');
const { processNewBp } = require('../lib/portfolio');

const DIR = path.join(process.cwd(), '2026-06-10-样例BP');

const SAMPLES = [
  { file: '01-灵犀智诊.pptx', title: '灵犀智诊 · AI多模态基层医疗诊断助手', founder: '林一舟', visibility: 'public',
    summary: '面向县域基层医院的AI辅助诊断SaaS，融合影像、问诊语音与电子病历的大模型分析。' },
  { file: '02-StarBridge.pptx', title: 'StarBridge · 低轨卫星物联网星座', founder: '陈曜', visibility: 'public',
    summary: '为远洋渔业、矿业与应急通信提供低成本卫星物联网回传。' },
  { file: '03-味觉实验室.pptx', title: '味觉实验室 · 功能性零食DTC品牌', founder: '苏蔓', visibility: 'public',
    summary: '主打“益生菌+低GI”的功能性零食品牌，全渠道经营。' },
  { file: '04-CodePilotX.pptx', title: 'CodePilot X · 企业级AI研发效能平台', founder: '何北辰', visibility: 'public',
    summary: '面向千人以上研发团队的私有化AI编程与代码评审平台，支持国产化部署。' },
  { file: '05-青藤学径.pptx', title: '青藤学径 · 乡村青少年科学教育', founder: '阿依古丽', visibility: 'public',
    summary: '“公益+商业”双轮：城市付费科学营收入反哺乡村学校科学教室。' },
  { file: '06-Helios.pptx', title: 'Helios · 钙钛矿叠层电池中试线', founder: '赵铭远', visibility: 'public',
    summary: '钙钛矿/晶硅叠层电池研发与中试，瞄准分布式光伏增量市场。' },
  { file: '07-EchoPod.pptx', title: 'EchoPod · AI播客双语内容引擎', founder: '江晚晴', visibility: 'ai_only',
    summary: '一键将深度文章转为双语播客，创作者工具 + 内容分发双边网络。' },
  { file: '08-南海芯链.pptx', title: '南海芯链 · 车规级碳化硅功率模块', founder: '欧阳澈', visibility: 'public',
    summary: '车规级SiC功率模块设计与封测，已进入主机厂供应链。' },
];

async function main() {
  const db = getDb();
  db.pragma('busy_timeout = 8000');
  const uploadsDir = path.join(DATA_DIR, 'uploads');
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
  const ins = db.prepare(
    'INSERT INTO bps (title, founder, summary, content, sector, visibility, filename) VALUES (?,?,?,?,?,?,?)'
  );

  for (const s of SAMPLES) {
    const src = path.join(DIR, s.file);
    if (!fs.existsSync(src)) { console.log(`跳过（找不到文件）：${s.file}`); continue; }
    const buf = fs.readFileSync(src);
    const filename = `${Date.now()}-${s.file.replace(/[^\w.一-龥-]/g, '_')}`;
    fs.writeFileSync(path.join(uploadsDir, filename), buf);
    const content = await extractPptxText(buf);
    const sector = detectSector(`${s.title} ${s.summary} ${content}`);
    const r = ins.run(s.title, s.founder, s.summary, content, sector, s.visibility, filename);
    const bp = db.prepare('SELECT * FROM bps WHERE id = ?').get(r.lastInsertRowid);
    process.stdout.write(`评估中：${s.title} … `);
    await processNewBp(db, bp);
    const avg = db.prepare('SELECT ROUND(AVG(score),1) a FROM evaluations WHERE bp_id=?').get(bp.id).a;
    const total = db.prepare('SELECT COALESCE(SUM(amount),0) t FROM holdings WHERE bp_id=? AND amount>0').get(bp.id).t;
    console.log(`完成（均分 ${avg}，累计注资 ${(total / 1e8).toFixed(2)} 亿）`);
  }
  console.log('\n✅ 全部上传完毕。刷新浏览器查看 BP 榜与 /feed。');
}

main().catch((e) => { console.error('出错：', e.message); process.exit(1); });
