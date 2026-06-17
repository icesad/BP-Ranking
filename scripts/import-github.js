// 精选预估：从 GitHub 拉高信号仓库，导入为 Demo（便宜通道：关键词分类+模拟评分，$0）。
// 真实 LLM 评估/估值仍按需在详情页触发，控成本。
// 用法举例：
//   node scripts/import-github.js "topic:ai stars:>500" 20
//   node scripts/import-github.js "vibe coding stars:>200" 15
// 第一个参数是 GitHub 搜索语句，第二个是数量（默认 15，最多 50）。
// 可选环境变量 GITHUB_TOKEN 提高速率限制。
const { getDb } = require('../lib/db');
const { fetchGithubRepo } = require('../lib/demofetch');
const { detectSector } = require('../lib/engine');
const { processNewBp } = require('../lib/portfolio');
const { upsertComparable } = require('../lib/comparables');

const query = process.argv[2] || 'topic:ai stars:>800';
const count = Math.min(50, Math.max(1, parseInt(process.argv[3] || '15', 10)));

async function searchRepos() {
  const headers = { 'User-Agent': 'BP-Ranking-Bot', Accept: 'application/vnd.github+json' };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=${count}`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`GitHub 搜索失败 HTTP ${res.status}（可能触发速率限制，建议设置 GITHUB_TOKEN）`);
  const data = await res.json();
  return data.items || [];
}

async function main() {
  const db = getDb();
  console.log(`搜索：「${query}」，取前 ${count} 个高 star 仓库…`);
  const repos = await searchRepos();
  console.log(`找到 ${repos.length} 个。开始导入（便宜通道，不花钱）…\n`);
  let imported = 0, skipped = 0;
  for (const repo of repos) {
    const exists = db.prepare("SELECT id FROM bps WHERE demo_url = ? AND kind='demo'").get(repo.html_url);
    if (exists) { skipped++; console.log(`跳过（已存在）：${repo.full_name}`); continue; }
    try {
      const { content } = await fetchGithubRepo(repo.html_url);
      const title = `${repo.name}`;
      const founder = repo.owner?.login || 'GitHub';
      const summary = (repo.description || `${repo.name} · ${repo.language || ''}`).slice(0, 300);
      const sector = detectSector(`${title} ${summary} ${content.slice(0, 4000)}`);
      const r = db.prepare(
        "INSERT INTO bps (title, founder, summary, content, sector, visibility, kind, demo_type, demo_url) VALUES (?,?,?,?,?, 'public', 'demo', 'github', ?)"
      ).run(title, founder, summary, content, sector, repo.html_url);
      const bp = db.prepare('SELECT * FROM bps WHERE id = ?').get(r.lastInsertRowid);
      await processNewBp(db, bp, { cheap: true }); // 关键：便宜通道，不调 LLM
      try { upsertComparable(db, repo); } catch {} // 同时进可比项目库（估值锚点）
      imported++;
      console.log(`✅ 导入：${repo.full_name}  ⭐${repo.stargazers_count}  → /bp/${bp.id}`);
      await new Promise((res) => setTimeout(res, 400)); // 轻微节流，避免 GitHub 限流
    } catch (e) {
      console.warn(`⚠️ 失败：${repo.full_name} — ${e.message}`);
    }
  }
  console.log(`\n完成。导入 ${imported} 个，跳过 ${skipped} 个。`);
  console.log('这些项目已用「模拟评分」上榜（$0）。想要真实评估/估值，去对应详情页点按钮按需触发即可。');
}

main().catch((e) => { console.error('出错：', e.message); process.exit(1); });
