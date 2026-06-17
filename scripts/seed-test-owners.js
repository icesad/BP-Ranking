// 测试用：创建几个测试账户，把 DEMO 榜上"无主"的公开项目绑给它们，便于用你的真实账户测打赏/购买。
// 这些是测试账户（provider='seed'，无法真实登录），只用来当"作者"接收打赏/售卖。只读你的真实数据，不动它。
//
// 用法（在 D:\BP-Ranking 下）：
//   node scripts/seed-test-owners.js          创建测试账户 + 绑定若干无主公开 demo + 在其一挂个付费提示词包
//   node scripts/seed-test-owners.js list       列出已绑定的项目、哪个有付费提示词包，以及打开链接
//   node scripts/seed-test-owners.js clear      删除这些测试账户、解绑其项目、清掉其提示词包/购买记录
(function loadEnv() {
  try { const fs = require('fs'); const path = require('path'); const txt = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8'); for (const line of txt.split('\n')) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ''); } } catch {}
})();
const { getDb } = require('../lib/db');

const TEST_USERS = [
  { uid: 'seed-alice', handle: 'vibe_alice', name: 'Alice（测试作者）' },
  { uid: 'seed-bob', handle: 'vibe_bob', name: 'Bob（测试作者）' },
  { uid: 'seed-carol', handle: 'vibe_carol', name: 'Carol（测试作者）' },
];

function main() {
  const db = getDb();
  const mode = process.argv[2];
  const BASE = `http://localhost:${process.env.PORT || 3100}`;

  if (mode === 'list') {
    const rows = db.prepare(`
      SELECT b.id, b.title, u.handle,
        (SELECT price FROM prompt_packs p WHERE p.bp_id = b.id) AS pack_price
      FROM bps b JOIN users u ON u.id = b.owner_user_id
      WHERE u.provider = 'seed' ORDER BY b.id DESC
    `).all();
    if (!rows.length) { console.log('还没有绑定到测试账户的项目。先跑：node scripts/seed-test-owners.js'); return; }
    console.log('\n已绑定测试账户的项目：');
    for (const r of rows) {
      console.log(`  bp#${r.id} 「${(r.title || '').slice(0, 26)}」 by @${r.handle}` + (r.pack_price > 0 ? `  🧩 付费提示词包 ${r.pack_price} 积分` : ''));
      console.log(`     ${BASE}/bp/${r.id}`);
    }
    const withPack = rows.find((r) => r.pack_price > 0);
    if (withPack) console.log(`\n👉 测"解锁购买"去这个：${BASE}/bp/${withPack.id}（用 icesad 登录，点 🧩 作者的提示词工程 → ${withPack.pack_price} 积分解锁）\n`);
    return;
  }

  if (mode === 'clear') {
    const ids = db.prepare("SELECT id FROM users WHERE provider = 'seed'").all().map((r) => r.id);
    if (!ids.length) { console.log('没有测试账户可清除。'); return; }
    const tx = db.transaction(() => {
      for (const id of ids) {
        db.prepare('UPDATE bps SET owner_user_id = NULL WHERE owner_user_id = ?').run(id);
        db.prepare('DELETE FROM prompt_packs WHERE owner_user_id = ?').run(id);
        db.prepare('DELETE FROM tips WHERE to_user_id = ? OR from_user_id = ?').run(id, id);
        db.prepare('DELETE FROM ledger WHERE user_id = ?').run(id);
        db.prepare('DELETE FROM users WHERE id = ?').run(id);
      }
      db.prepare("DELETE FROM pack_purchases WHERE bp_id NOT IN (SELECT bp_id FROM prompt_packs)").run();
    });
    tx();
    console.log(`已清除 ${ids.length} 个测试账户及其绑定/包/记录。`);
    return;
  }

  // 1) 建测试账户（幂等）
  const userIds = [];
  for (const u of TEST_USERS) {
    let row = db.prepare("SELECT id FROM users WHERE provider='seed' AND provider_uid=?").get(u.uid);
    if (!row) {
      const info = db.prepare("INSERT INTO users (provider, provider_uid, handle, name, avatar, bio, github_login, points) VALUES ('seed',?,?,?,?,?, '', 1000)")
        .run(u.uid, u.handle, u.name, '', '测试账户，用于演示打赏/售卖');
      row = { id: info.lastInsertRowid };
    }
    userIds.push(row.id);
  }

  // 2) 绑定"无主"的公开 demo（最多 6 个），轮流分给测试账户
  const orphans = db.prepare("SELECT id, title FROM bps WHERE visibility='public' AND owner_user_id IS NULL AND kind='demo' ORDER BY id DESC LIMIT 6").all();
  if (!orphans.length) { console.log('没有可绑定的无主公开 demo（可能都已绑定）。'); }
  let i = 0;
  const bound = [];
  for (const o of orphans) {
    const uid = userIds[i % userIds.length];
    db.prepare('UPDATE bps SET owner_user_id = ? WHERE id = ?').run(uid, o.id);
    const h = TEST_USERS[i % TEST_USERS.length].handle;
    bound.push(`  bp#${o.id} 「${(o.title || '').slice(0, 24)}」 → @${h}`);
    i++;
  }

  // 3) 在一个测试账户名下的项目上挂/刷新示例付费提示词包（即使本次没有新绑定，也刷新已存在的包为新结构）
  let packBp = db.prepare("SELECT bp_id FROM prompt_packs WHERE owner_user_id IN (SELECT id FROM users WHERE provider='seed') ORDER BY bp_id DESC LIMIT 1").get()?.bp_id;
  if (!packBp) packBp = db.prepare("SELECT id FROM bps WHERE owner_user_id IN (SELECT id FROM users WHERE provider='seed') ORDER BY id DESC LIMIT 1").get()?.id;
  if (packBp) {
    const ownerId = db.prepare('SELECT owner_user_id FROM bps WHERE id = ?').get(packBp).owner_user_id;
    const assets = JSON.stringify([
      { kind: 'claude_md', title: 'CLAUDE.md（项目记忆）', content: '# 项目说明（示例）\n- 默认中文回复\n- 技术栈：Next.js + SQLite\n- 约定：估值不奖励堆词……（测试内容）' },
      { kind: 'prompt', title: '需求拆解 prompt', content: '你是资深产品+架构师，请把下面需求拆成可独立实现的模块……（测试内容）' },
      { kind: 'skill', title: '自测修复 skill', content: '当生成代码后：1) 跑最小用例 2) 收集报错 3) 定位最可能文件 4) 给最小修复 diff……（测试内容）' },
      { kind: 'config', title: 'MCP / 插件配置', content: '{ "mcpServers": { "tavily": { ... } } }（测试内容）' },
    ]);
    db.prepare(`INSERT INTO prompt_packs (bp_id, owner_user_id, title, preview, body, llm, stack, assets, price, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?, datetime('now'))
      ON CONFLICT(bp_id) DO UPDATE SET title=excluded.title, preview=excluded.preview, body=excluded.body, llm=excluded.llm, stack=excluded.stack, assets=excluded.assets, price=excluded.price`)
      .run(packBp, ownerId,
        '我是怎么用 AI 把它做出来的（示例付费包）',
        '免费预览：整体用了「需求拆解→分模块生成→自测修 bug」三步。完整 CLAUDE.md、提示词、skill、MCP 配置见付费内容。',
        '【总览·示例】先用 CLAUDE.md 固化项目约定，再分模块让模型生成，最后用自测 skill 收敛 bug。（测试内容，可在详情页以作者身份编辑/删除。）',
        'Claude Opus 4.8',
        JSON.stringify(['Claude Code', 'Cursor', 'Tavily MCP', 'Next.js']),
        assets,
        200);
  }

  console.log('✅ 已创建测试账户并绑定项目：');
  console.log(bound.join('\n') || '  （无）');
  console.log('\n现在你可以：');
  console.log('  · 用 icesad 登录，到上面任一项目详情页「打赏作者」用积分打赏（积分会转给测试账户）。');
  if (packBp) console.log(`  · bp#${packBp} 挂了 200 积分的提示词包（已刷新为新结构：LLM/技术栈/CLAUDE.md/skill/config），${BASE}/bp/${packBp}`);
  console.log('  · 测试账户主页：/u/vibe_alice 等。清除：node scripts/seed-test-owners.js clear\n');
}

try { main(); } catch (e) { console.error(e); process.exit(1); }
