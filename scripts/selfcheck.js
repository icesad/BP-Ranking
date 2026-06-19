// 总自检：一条命令核对至今所有新模块（估值评分卡 / 改进建议 / 第一方信号 / 账户 / 资讯 / 活动）的
// 表、字段、代码导出、环境变量与数据状态。只读、零花费（getDb 会顺带跑幂等迁移补齐字段）。
// 用法（在 D:\BP-Ranking 下）：node scripts/selfcheck.js
const { getDb } = require('../lib/db');

let pass = 0, warn = 0, fail = 0;
const ok = (m) => { pass++; console.log('  ✅ ' + m); };
const wn = (m) => { warn++; console.log('  ⚠️  ' + m); };
const no = (m) => { fail++; console.log('  ❌ ' + m); };

const cols = (db, t) => { try { return db.prepare(`PRAGMA table_info(${t})`).all().map((r) => r.name); } catch { return []; } };
const hasTable = (db, t) => !!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(t);
const cnt = (db, t) => { try { return db.prepare(`SELECT COUNT(*) c FROM ${t}`).get().c; } catch { return '—'; } };

function main() {
  const db = getDb();

  console.log('\n=== 1) 表 ===');
  for (const t of ['suggestions', 'bp_events', 'users', 'news', 'events', 'follows', 'portfolios', 'ledger', 'tips', 'prompt_packs', 'pack_purchases', 'user_profiles', 'user_socials', 'needs', 'resources', 'nav_links', 'communities']) hasTable(db, t) ? ok(`表 ${t}`) : no(`缺表 ${t}`);

  console.log('\n=== 2) 字段 ===');
  const bpsC = cols(db, 'bps');
  bpsC.includes('archetype') ? ok('bps.archetype') : no('bps.archetype 缺');
  bpsC.includes('owner_user_id') ? ok('bps.owner_user_id') : no('bps.owner_user_id 缺');
  cols(db, 'valuations').includes('algo_version') ? ok('valuations.algo_version') : no('缺 valuations.algo_version');
  cols(db, 'outcomes').includes('verified') ? ok('outcomes.verified') : no('缺 outcomes.verified');
  const sc = cols(db, 'suggestions');
  (sc.includes('evidence_needed') && sc.includes('potential')) ? ok('suggestions.evidence_needed/potential') : no('suggestions 缺 evidence_needed/potential');
  const uc = cols(db, 'users');
  (uc.includes('handle') && uc.includes('provider_uid')) ? ok('users.handle/provider_uid') : no('users 字段缺');

  console.log('\n=== 3) 代码导出 ===');
  const need = (mod, keys) => {
    let m; try { m = require(mod); } catch (e) { no(`${mod} 载入失败：${e.message}`); return; }
    for (const k of keys) (typeof m[k] !== 'undefined') ? ok(`${mod} → ${k}`) : no(`${mod} 缺 ${k}`);
  };
  need('../lib/engine', ['compositeScore', 'classifyArchetypeFallback', 'ARCHETYPE_FOCUS', 'ARCHETYPE_LABELS']);
  need('../lib/deepseek', ['scoreRubric', 'improvementPlan']);
  need('../lib/auth', ['getSessionUser', 'sign', 'verify', 'COOKIE']);
  need('../lib/queries', ['bpSuggestions', 'bpSignals', 'userByHandle', 'userProjects', 'newsList', 'eventsList']);

  console.log('\n=== 4) 环境变量（缺失只警告，不阻塞）===');
  const env = (k, why) => process.env[k] ? ok(`${k} 已配置`) : wn(`${k} 未配置（${why}）`);
  // 轻量读 .env.local
  try { const fs = require('fs'); const path = require('path'); const txt = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8'); for (const line of txt.split('\n')) { const mm = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (mm && !(mm[1] in process.env)) process.env[mm[1]] = mm[2].replace(/^["']|["']$/g, ''); } } catch {}
  env('DEEPSEEK_API_KEY', '估值/建议');
  env('TAVILY_API_KEY', '估值联网 / 资讯抓取');
  env('GITHUB_OAUTH_CLIENT_ID', '登录');
  env('GITHUB_OAUTH_CLIENT_SECRET', '登录');
  env('AUTH_SECRET', '会话 cookie 签名');

  console.log('\n=== 5) 数据状态 ===');
  console.log(`  项目 ${cnt(db, 'bps')}（归属账户的 ${(() => { try { return db.prepare('SELECT COUNT(*) c FROM bps WHERE owner_user_id IS NOT NULL').get().c; } catch { return '—'; } })()}）· 用户 ${cnt(db, 'users')} · 资讯 ${cnt(db, 'news')} · 活动 ${cnt(db, 'events')} · 信号事件 ${cnt(db, 'bp_events')} · 建议 ${cnt(db, 'suggestions')}`);
  if (cnt(db, 'news') === 0) wn('资讯为空 → node scripts/import-news.js');
  if (cnt(db, 'events') === 0) wn('活动为空 → node scripts/add-event.js sample');
  if (cnt(db, 'users') === 0) wn('还没有用户 → 配好 GitHub OAuth 后点导航“登录”');

  console.log('\n=== 结果 ===');
  console.log(`  PASS ${pass} · 注意 ${warn} · FAIL ${fail}`);
  console.log(fail === 0
    ? '  ✅ 结构全部就位。"注意"项多是还没配密钥/还没数据，按提示操作即可。\n'
    : '  ❌ 有 FAIL：通常重启 dev server 让迁移生效即可；仍失败把上面输出发我。\n');
}

try { main(); } catch (e) { console.error('自检出错：', e); process.exit(1); }
