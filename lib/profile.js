// 用户画像构建：聚合一个用户的多个作品(可验证) + 自报社媒公开信息(Tavily 搜索，未核实) → LLM 合成八维画像，存库。
const { tavilySearch } = require('./tavily');
const { synthesizeProfile } = require('./deepseek');
const { SECTOR_LABELS, ARCHETYPE_LABELS } = require('./engine');

const PLATFORM_LABEL = { xiaohongshu: '小红书', x: 'X/Twitter', bilibili: 'B站', github: 'GitHub', site: '个人站', other: '社媒' };
const ALGO = 'p1';

// 把用户的作品压成给 LLM 的摘要文本 + 统计基于多少个作品
function worksDigest(db, userId) {
  const rows = db.prepare("SELECT title, kind, sector, archetype, stage, tags, val_summary FROM bps WHERE owner_user_id = ? AND visibility='public' ORDER BY id DESC LIMIT 12").all(userId);
  const lines = [];
  for (const r of rows) {
    let tags = []; try { tags = JSON.parse(r.tags || '[]'); } catch {}
    let dimsTxt = '';
    try {
      const s = JSON.parse(r.val_summary || 'null');
      if (s?.rubric) dimsTxt = ' · 评分卡:' + Object.entries(s.rubric).map(([k, v]) => `${k}=${v.score}`).join(',');
    } catch {}
    lines.push(`- 《${r.title}》[${ARCHETYPE_LABELS[r.archetype] || r.archetype || '?'}/${SECTOR_LABELS[r.sector] || r.sector || '?'}/${r.stage || ''}] 标签:${tags.join('、') || '无'}${dimsTxt}`);
  }
  return { text: lines.join('\n'), n: rows.length };
}

// 用 Tavily 搜每个社媒链接/handle 的公开信息（拿不到正文也至少有公开摘要）
async function socialDigest(socials) {
  const parts = [];
  for (const s of (socials || []).slice(0, 5)) {
    const label = PLATFORM_LABEL[s.platform] || s.platform;
    const results = await tavilySearch(`${s.url} ${label} 主页 简介 内容`, { max: 3 });
    const snip = results.map((r) => `${r.title} — ${r.snippet}`).join(' / ').slice(0, 400);
    parts.push(`【${label}】${s.url}\n${snip || '(未搜到公开信息)'}`);
  }
  return parts.join('\n\n');
}

async function buildProfile(db, userId) {
  const works = worksDigest(db, userId);
  const socials = db.prepare('SELECT platform, url FROM user_socials WHERE user_id = ?').all(userId);
  let socialText = '';
  try { if (socials.length) socialText = await socialDigest(socials); } catch {}

  const r = await synthesizeProfile(works.text, socialText, works.n);
  if (!r) return { ok: false, error: '生成失败（缺 DEEPSEEK_API_KEY 或模型繁忙）' };

  db.prepare(`INSERT INTO user_profiles (user_id, dims, themes, summary, social_summary, based_on, algo_version, updated_at)
    VALUES (?,?,?,?,?,?,?, datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET dims=excluded.dims, themes=excluded.themes, summary=excluded.summary, social_summary=excluded.social_summary, based_on=excluded.based_on, algo_version=excluded.algo_version, updated_at=excluded.updated_at`)
    .run(userId, JSON.stringify(r.dims), JSON.stringify(r.themes), r.summary, r.social_summary, works.n, ALGO);
  return { ok: true, basedOn: works.n };
}

module.exports = { buildProfile, PLATFORM_LABEL };
