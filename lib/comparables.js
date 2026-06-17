// 站内"可比项目库"：导入的真实项目（GitHub 客观信号）作为估值锚点（不进排行榜）。
const { detectSector } = require('./engine');

function tierOf(stars) {
  if (stars >= 5000) return 'star';
  if (stars >= 1000) return 'popular';
  if (stars >= 100) return 'traction';
  return 'toy';
}

// stars / 自创建以来的月份数，粗略反映热度增速
function starVelocity(stars, createdAt) {
  if (!createdAt) return 0;
  const months = Math.max(1, (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24 * 30));
  return Math.round((stars / months) * 10) / 10;
}

// 由 GitHub 仓库对象（search item 或 repo API 返回）构造一条可比记录并 upsert。
function upsertComparable(db, repo) {
  const fullName = repo.full_name || repo.fullName;
  if (!fullName) return false;
  const name = repo.name || fullName.split('/').pop();
  const desc = repo.description || '';
  const topics = Array.isArray(repo.topics) ? repo.topics : [];
  const stars = repo.stargazers_count ?? repo.stars ?? 0;
  const sector = detectSector(`${name} ${desc} ${topics.join(' ')}`);
  db.prepare(`
    INSERT INTO comparables (source, ref_id, name, description, url, homepage, sector, language, topics,
      stars, forks, watchers, issues, license, created_at_src, pushed_at, archived, star_velocity, tier, fetched_at)
    VALUES ('github', @ref_id, @name, @description, @url, @homepage, @sector, @language, @topics,
      @stars, @forks, @watchers, @issues, @license, @created_at_src, @pushed_at, @archived, @star_velocity, @tier, datetime('now'))
    ON CONFLICT(source, ref_id) DO UPDATE SET
      name=excluded.name, description=excluded.description, sector=excluded.sector, language=excluded.language,
      topics=excluded.topics, stars=excluded.stars, forks=excluded.forks, watchers=excluded.watchers,
      issues=excluded.issues, license=excluded.license, pushed_at=excluded.pushed_at, archived=excluded.archived,
      star_velocity=excluded.star_velocity, tier=excluded.tier, homepage=excluded.homepage, fetched_at=datetime('now')
  `).run({
    ref_id: fullName,
    name: String(name).slice(0, 80),
    description: String(desc).slice(0, 300),
    url: repo.html_url || `https://github.com/${fullName}`,
    homepage: repo.homepage || '',
    sector,
    language: repo.language || '',
    topics: JSON.stringify(topics.slice(0, 8)),
    stars,
    forks: repo.forks_count ?? repo.forks ?? 0,
    watchers: repo.subscribers_count ?? repo.watchers ?? 0,
    issues: repo.open_issues_count ?? repo.issues ?? 0,
    license: repo.license?.spdx_id || (typeof repo.license === 'string' ? repo.license : '') || '',
    created_at_src: (repo.created_at || '').slice(0, 10),
    pushed_at: (repo.pushed_at || '').slice(0, 10),
    archived: repo.archived ? 1 : 0,
    star_velocity: starVelocity(stars, repo.created_at),
    tier: tierOf(stars),
  });
  return true;
}

// 取与某项目同赛道的可比项目（按 stars 降序），喂给估值模型作相对锚点。
function comparablesFor(db, bp, n = 5) {
  const sector = bp.sector || '';
  if (!sector) return [];
  const rows = db.prepare('SELECT * FROM comparables WHERE sector = ? ORDER BY stars DESC LIMIT ?').all(sector, n);
  return rows.map((r) => ({
    name: r.name, url: r.url, homepage: r.homepage, sector: r.sector, language: r.language,
    stars: r.stars, forks: r.forks, license: r.license, pushed_at: r.pushed_at,
    archived: !!r.archived, velocity: r.star_velocity, tier: r.tier,
    funding: r.funding || '', funding_url: r.funding_url || '', funding_at: r.funding_at || '',
    description: r.description,
    topics: (() => { try { return JSON.parse(r.topics || '[]'); } catch { return []; } })(),
  }));
}

// 找到与某项目对应的可比库记录（用于把已核查的公开融资自动带到详情页）。
// 优先按 GitHub 仓库地址精确匹配（导入的 Demo 与可比库共用同一 url/ref_id）。
function comparableForBp(db, bp) {
  if (!bp) return null;
  const url = bp.demo_url || '';
  if (url && /github\.com/i.test(url)) {
    let row = db.prepare('SELECT * FROM comparables WHERE url = ?').get(url);
    if (!row) {
      const m = url.match(/github\.com\/([\w.-]+\/[\w.-]+)/i);
      const refId = m ? m[1].replace(/\.git$/, '') : null;
      if (refId) row = db.prepare('SELECT * FROM comparables WHERE ref_id = ?').get(refId);
    }
    if (row) return row;
  }
  return null;
}

module.exports = { upsertComparable, comparablesFor, comparableForBp, tierOf, starVelocity };
