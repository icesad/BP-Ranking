// 测试用：给测试账户(provider='seed')灌入各有侧重的画像，便于单账户在 /match 看到匹配差异。
// 直接写 user_profiles（不调 LLM、即时、免费）。先跑过 seed-test-owners.js 建出测试账户。
//
// 用法（在 D:\BP-Ranking 下）：
//   node scripts/seed-test-profiles.js          给测试账户写画像
//   node scripts/seed-test-profiles.js clear      删除测试账户的画像
(function loadEnv() {
  try { const fs = require('fs'); const path = require('path'); const txt = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8'); for (const line of txt.split('\n')) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ''); } } catch {}
})();
const { getDb } = require('../lib/db');

// 三个各有侧重的画像（dims 0-100；八维：tech/product/business/aesthetic/vision/originality/execution/influence）
const PROFILES = {
  vibe_alice: {
    dims: { tech: 55, product: 85, business: 60, aesthetic: 90, vision: 65, originality: 80, execution: 70, influence: 75 },
    themes: ['AI工具', '效率', '设计', 'vibe coding'],
    summary: '（测试画像）偏产品与审美：擅长把想法做成好看好用的小工具，视觉与交互敏感，商业与硬核技术中等。',
  },
  vibe_bob: {
    dims: { tech: 92, product: 55, business: 40, aesthetic: 45, vision: 60, originality: 70, execution: 88, influence: 35 },
    themes: ['AI Agent', '开发工具', '后端', 'vibe coding'],
    summary: '（测试画像）硬核技术与落地强：能啃复杂实现、把东西真正跑起来；商业表达与审美偏弱，适合做技术搭档。',
  },
  vibe_carol: {
    dims: { tech: 40, product: 70, business: 90, aesthetic: 65, vision: 88, originality: 65, execution: 60, influence: 85 },
    themes: ['增长', '商业化', 'AI估值', '内容'],
    summary: '（测试画像）商业洞见与影响力强：擅长定位、增长与讲故事，技术偏弱，适合与工程型选手互补组队。',
  },
};

function main() {
  const db = getDb();
  const mode = process.argv[2];
  const seedUsers = db.prepare("SELECT id, handle FROM users WHERE provider = 'seed'").all();
  if (!seedUsers.length) { console.log('没有测试账户。先跑：node scripts/seed-test-owners.js'); return; }

  if (mode === 'clear') {
    const ids = seedUsers.map((u) => u.id);
    const del = db.prepare(`DELETE FROM user_profiles WHERE user_id IN (${ids.map(() => '?').join(',')})`);
    del.run(...ids);
    console.log(`已删除 ${ids.length} 个测试账户的画像。`);
    return;
  }

  const up = db.prepare(`INSERT INTO user_profiles (user_id, dims, themes, summary, social_summary, based_on, algo_version, updated_at)
    VALUES (?,?,?,?,?,?,?, datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET dims=excluded.dims, themes=excluded.themes, summary=excluded.summary, based_on=excluded.based_on, updated_at=excluded.updated_at`);
  let n = 0;
  for (const u of seedUsers) {
    const p = PROFILES[u.handle];
    if (!p) continue;
    up.run(u.id, JSON.stringify(p.dims), JSON.stringify(p.themes), p.summary, '', 3, 'p1-seed');
    console.log(`  ✅ @${u.handle} 画像已写入`);
    n++;
  }
  console.log(`\n完成 ${n} 个。现在用 icesad 登录打开 /match，应能看到 vibe_alice/bob/carol 的"志同道合/能力互补"匹配。`);
  console.log('清除：node scripts/seed-test-profiles.js clear\n');
}

try { main(); } catch (e) { console.error(e); process.exit(1); }
