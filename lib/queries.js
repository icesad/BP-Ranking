const { getDb } = require('./db');
const { usdCnyRateSync } = require('./fx');

// 金额展示：英文按当前汇率折成美元($)，中文用人民币(亿/万)。所有金额底层以人民币(元)存储。
function fmtMoney(n, locale) {
  if (locale === 'en') {
    const rate = usdCnyRateSync() || 7.2;
    const usd = n / rate;
    const v = Math.abs(usd);
    if (v >= 1e9) return '$' + (usd / 1e9).toFixed(2) + 'B';
    if (v >= 1e6) return '$' + (usd / 1e6).toFixed(2) + 'M';
    if (v >= 1e3) return '$' + (usd / 1e3).toFixed(1) + 'K';
    return '$' + Math.round(usd);
  }
  const v = Math.abs(n);
  if (v >= 100000000) return (n / 100000000).toFixed(2) + '亿';
  if (v >= 10000) return (n / 10000).toFixed(0) + '万';
  return String(Math.round(n));
}

// 估值区间的简洁表达：共用一个单位、去掉多余小数。如 190–1025（亿） / $190–1025B
function fmtRange(low, high, locale) {
  const trim = (x) => { let s = x.toFixed(2); s = s.replace(/\.?0+$/, ''); return s; };
  if (locale === 'en') {
    const rate = usdCnyRateSync() || 7.2;
    const lo = low / rate, hi = high / rate, ref = Math.abs(hi);
    let div = 1, suf = '';
    if (ref >= 1e9) { div = 1e9; suf = 'B'; } else if (ref >= 1e6) { div = 1e6; suf = 'M'; } else if (ref >= 1e3) { div = 1e3; suf = 'K'; }
    return `$${trim(lo / div)}–${trim(hi / div)}${suf}`;
  }
  const ref = Math.abs(high);
  let div = 1, unit = '';
  if (ref >= 1e8) { div = 1e8; unit = '亿'; } else if (ref >= 1e4) { div = 1e4; unit = '万'; }
  return unit ? `${trim(low / div)}–${trim(high / div)}（${unit}）` : `${trim(low / div)}–${trim(high / div)}`;
}

function leaderboard(kind = 'bp') {
  const db = getDb();
  return db.prepare(`
    SELECT b.*,
      COALESCE(SUM(CASE WHEN h.amount > 0 THEN h.amount END), 0) AS total_invested,
      COUNT(DISTINCT CASE WHEN h.amount > 0 THEN h.investor_id END) AS investor_count,
      (SELECT ROUND(AVG(score),1) FROM evaluations e WHERE e.bp_id = b.id) AS avg_score,
      (SELECT COUNT(*) FROM outcomes o WHERE o.bp_id = b.id AND o.type IN ('raised','acquired') AND o.amount > 0) AS money_outcomes
    FROM bps b
    LEFT JOIN holdings h ON h.bp_id = b.id
    WHERE b.kind = ?
    GROUP BY b.id
    ORDER BY total_invested DESC
  `).all(kind);
}

function bpDetail(id) {
  const db = getDb();
  const bp = db.prepare('SELECT * FROM bps WHERE id = ?').get(id);
  if (!bp) return null;
  const evals = db.prepare(`
    SELECT e.*, i.name, i.emoji, i.type, i.style, i.real_llm, i.slug,
      COALESCE((SELECT amount FROM holdings h WHERE h.investor_id = e.investor_id AND h.bp_id = e.bp_id), 0) AS holding
    FROM evaluations e JOIN investors i ON i.id = e.investor_id
    WHERE e.bp_id = ?
    ORDER BY e.score DESC
  `).all(id);
  const total = db.prepare('SELECT COALESCE(SUM(amount),0) t FROM holdings WHERE bp_id = ? AND amount > 0').get(id).t;
  let owner = null;
  if (bp.owner_user_id) owner = db.prepare('SELECT handle, name, avatar FROM users WHERE id = ?').get(bp.owner_user_id) || null;
  return { bp, evals, total, owner };
}

function investorsList() {
  const db = getDb();
  return db.prepare(`
    SELECT i.*,
      COALESCE((SELECT SUM(h.amount) FROM holdings h JOIN bps b ON b.id = h.bp_id WHERE h.investor_id = i.id AND h.amount > 0 AND b.kind = 'bp'), 0) AS invested,
      (SELECT COUNT(*) FROM holdings h JOIN bps b ON b.id = h.bp_id WHERE h.investor_id = i.id AND h.amount > 0 AND b.kind = 'bp') AS positions,
      COALESCE((SELECT SUM(h.amount) FROM holdings h JOIN bps b ON b.id = h.bp_id WHERE h.investor_id = i.id AND h.amount > 0 AND b.kind = 'demo'), 0) AS demo_invested,
      (SELECT COUNT(*) FROM holdings h JOIN bps b ON b.id = h.bp_id WHERE h.investor_id = i.id AND h.amount > 0 AND b.kind = 'demo') AS demo_positions
    FROM investors i
    ORDER BY i.id
  `).all();
}

function investorDetail(slug) {
  const db = getDb();
  const inv = db.prepare('SELECT * FROM investors WHERE slug = ?').get(slug);
  if (!inv) return null;
  const holdings = db.prepare(`
    SELECT h.amount, b.id, b.title, b.founder, b.visibility, b.kind,
      (SELECT score FROM evaluations e WHERE e.investor_id = h.investor_id AND e.bp_id = b.id) AS score
    FROM holdings h JOIN bps b ON b.id = h.bp_id
    WHERE h.investor_id = ? AND h.amount > 0
    ORDER BY h.amount DESC
  `).all(inv.id);
  const txs = db.prepare(`
    SELECT t.*, b.title, b.visibility, b.kind FROM transactions t JOIN bps b ON b.id = t.bp_id
    WHERE t.investor_id = ? ORDER BY t.created_at ASC, t.id ASC
  `).all(inv.id);
  // 双赛道持仓轨迹：按交易分别累计
  let cumBp = 0, cumDemo = 0;
  const trajectory = txs.map((t) => {
    if (t.kind === 'demo') cumDemo += t.amount; else cumBp += t.amount;
    return { date: t.created_at.slice(0, 10), bp: Math.round(cumBp), demo: Math.round(cumDemo) };
  });
  return { inv, holdings, txs: txs.slice().reverse(), trajectory };
}

// 路演问答：最关键(评分最低)的若干位投资人的提问 + 创始人答复(仅当答复对应当前问题时显示)
function bpQuestions(id, limit = 3) {
  const db = getDb();
  return db.prepare(`
    SELECT e.investor_id, i.name, i.emoji, i.type, i.slug, e.score, e.question, e.en,
      (SELECT a FROM qa WHERE qa.bp_id = e.bp_id AND qa.investor_id = e.investor_id AND qa.q = e.question) AS answer
    FROM evaluations e JOIN investors i ON i.id = e.investor_id
    WHERE e.bp_id = ? AND e.question != ''
    ORDER BY e.score ASC LIMIT ?
  `).all(id, limit);
}

// 已作答的问答记录（不论是否仍对应当前问题，留作路演记录）
function bpAnsweredQA(id) {
  const db = getDb();
  return db.prepare(`
    SELECT q.q, q.a, q.created_at, i.name, i.emoji
    FROM qa q JOIN investors i ON i.id = q.investor_id
    WHERE q.bp_id = ? AND q.a != '' ORDER BY q.created_at DESC
  `).all(id);
}

// Deal flow：给真投资人筛选高分公开项目（按均分倒序），支持 赛道/阶段/模式/最低均分 过滤
function dealflowProjects(f = {}) {
  const db = getDb();
  let rows = db.prepare(`
    SELECT b.id, b.title, b.founder, b.sector, b.subsector, b.stage, b.biz_model, b.customer, b.summary, b.content,
      COALESCE(SUM(CASE WHEN h.amount > 0 THEN h.amount END), 0) AS total_invested,
      COUNT(DISTINCT CASE WHEN h.amount > 0 THEN h.investor_id END) AS investor_count,
      (SELECT ROUND(AVG(score),1) FROM evaluations e WHERE e.bp_id = b.id) AS avg_score,
      (SELECT MAX(score) - MIN(score) FROM evaluations e WHERE e.bp_id = b.id) AS spread
    FROM bps b LEFT JOIN holdings h ON h.bp_id = b.id
    WHERE b.kind = 'bp' AND b.visibility = 'public'
    GROUP BY b.id
  `).all();
  if (f.sector) rows = rows.filter((r) => r.sector === f.sector);
  if (f.stage) rows = rows.filter((r) => (r.stage || 'idea') === f.stage);
  if (f.model) rows = rows.filter((r) => r.biz_model === f.model);
  const min = Number(f.minScore) || 0;
  if (min) rows = rows.filter((r) => (r.avg_score || 0) >= min);
  rows.sort((a, b) => (b.avg_score || 0) - (a.avg_score || 0) || b.total_invested - a.total_invested);
  return rows;
}

// 站内搜索：按名称/简介/创始人/赛道/子赛道/标签匹配（仅公开项目）
function searchProjects(q) {
  const db = getDb();
  if (!q || !q.trim()) return [];
  const like = '%' + q.trim().replace(/[%_]/g, '') + '%';
  return db.prepare(`
    SELECT b.id, b.title, b.founder, b.kind, b.summary, b.sector, b.subsector,
      COALESCE(SUM(CASE WHEN h.amount > 0 THEN h.amount END), 0) AS total_invested
    FROM bps b LEFT JOIN holdings h ON h.bp_id = b.id
    WHERE b.visibility = 'public' AND (
      b.title LIKE ? OR b.summary LIKE ? OR b.founder LIKE ? OR b.sector LIKE ? OR b.subsector LIKE ? OR b.tags LIKE ?
    )
    GROUP BY b.id ORDER BY total_invested DESC LIMIT 50
  `).all(like, like, like, like, like, like);
}

// 投资人业绩：持仓质量分（资金加权的所投项目均分）+ 命中率（资金落在BP榜前30%的占比）
function investorPerformance() {
  const db = getDb();
  const invs = db.prepare('SELECT id, slug, name, emoji, type, real_llm FROM investors').all();
  const board = leaderboard('bp');
  const rankMap = {};
  board.forEach((r, i) => { rankMap[r.id] = { rank: i + 1, avg: r.avg_score || 0 }; });
  const topCut = Math.max(1, Math.ceil(board.length * 0.3));
  const out = [];
  for (const inv of invs) {
    const holds = db.prepare(`
      SELECT h.bp_id, h.amount FROM holdings h JOIN bps b ON b.id = h.bp_id
      WHERE h.investor_id = ? AND h.amount > 0 AND b.kind = 'bp'
    `).all(inv.id);
    let cap = 0, qual = 0, hitCap = 0;
    for (const h of holds) {
      const m = rankMap[h.bp_id];
      if (!m) continue;
      cap += h.amount; qual += h.amount * m.avg;
      if (m.rank <= topCut) hitCap += h.amount;
    }
    out.push({
      ...inv,
      positions: holds.length,
      deployed: cap,
      quality: cap ? Math.round((qual / cap) * 10) / 10 : 0,
      hitRate: cap ? Math.round((hitCap / cap) * 100) : 0,
    });
  }
  out.sort((a, b) => b.quality - a.quality || b.hitRate - a.hitRate);
  return out;
}

// 本周赛道风云：近7天的涨/跌/登场/重新参战 + 最热赛道
function weeklyDigest() {
  const db = getDb();
  const win = "n.created_at >= datetime('now','-7 days')";
  const risers = db.prepare(`
    SELECT n.bp_id, b.title, b.visibility, MAX(n.rank_from - n.rank_to) AS up
    FROM notifications n JOIN bps b ON b.id = n.bp_id
    WHERE n.type='rank_up' AND ${win} GROUP BY n.bp_id ORDER BY up DESC LIMIT 5
  `).all();
  const fallers = db.prepare(`
    SELECT n.bp_id, b.title, b.visibility, MAX(n.rank_to - n.rank_from) AS down
    FROM notifications n JOIN bps b ON b.id = n.bp_id
    WHERE n.type='rank_down' AND ${win} GROUP BY n.bp_id ORDER BY down DESC LIMIT 5
  `).all();
  const newcomers = db.prepare(`
    SELECT n.bp_id, b.title, b.visibility FROM notifications n JOIN bps b ON b.id = n.bp_id
    WHERE n.type='new_entry' AND ${win} ORDER BY n.id DESC LIMIT 8
  `).all();
  const reentries = db.prepare(`
    SELECT n.bp_id, b.title, b.visibility, n.body FROM notifications n JOIN bps b ON b.id = n.bp_id
    WHERE n.type='re_entry' AND ${win} ORDER BY n.id DESC LIMIT 8
  `).all();
  const hotSector = sectorsOverview()[0] || null;
  const counts = {
    up: db.prepare(`SELECT COUNT(*) c FROM notifications n WHERE n.type='rank_up' AND ${win}`).get().c,
    down: db.prepare(`SELECT COUNT(*) c FROM notifications n WHERE n.type='rank_down' AND ${win}`).get().c,
    nw: db.prepare(`SELECT COUNT(*) c FROM notifications n WHERE n.type='new_entry' AND ${win}`).get().c,
  };
  return { risers, fallers, newcomers, reentries, hotSector, counts };
}

// 估值历史：综合估值区间随时间（按天取每天最后一次）
function bpValuationHistory(id) {
  const db = getDb();
  const rows = db.prepare('SELECT low, high, created_at FROM valuation_history WHERE bp_id = ? ORDER BY id ASC').all(id);
  const byDay = {};
  for (const r of rows) byDay[(r.created_at || '').slice(0, 10)] = { low: Math.round(r.low), high: Math.round(r.high) };
  return Object.entries(byDay).map(([date, v]) => ({ date, low: v.low, high: v.high }));
}

// 项目估值：每位投资人的结构化估值（按估值中点倒序）
function bpValuations(id) {
  const db = getDb();
  return db.prepare(`
    SELECT v.*, i.name, i.emoji, i.type, i.slug
    FROM valuations v JOIN investors i ON i.id = v.investor_id
    WHERE v.bp_id = ?
    ORDER BY (v.low + v.high) DESC
  `).all(id);
}

// 赛道对标：同赛道百分位 + 冠军对比
function sectorBenchmark(id) {
  const bp = getDb().prepare('SELECT id, sector, kind FROM bps WHERE id = ?').get(id);
  if (!bp) return null;
  const kind = bp.kind || 'bp';
  const peers = sectorProjects(bp.sector).filter((p) => (p.kind || 'bp') === kind);
  const me = peers.find((p) => p.id === id);
  if (!me) return null;
  const myAvg = me.avg_score || 0;
  const beat = peers.filter((p) => (p.avg_score || 0) < myAvg).length;
  const percentile = peers.length > 1 ? Math.round((beat / (peers.length - 1)) * 100) : 100;
  const champ = peers.find((p) => p.visibility === 'public' && p.id !== id) || null;
  return { n: peers.length, percentile, me, champion: champ };
}

// 项目累计注资走势（按天取当日最终累计值）
function bpTrajectory(id) {
  const db = getDb();
  const txs = db.prepare('SELECT amount, created_at FROM transactions WHERE bp_id = ? ORDER BY created_at ASC, id ASC').all(id);
  let cum = 0;
  const byDay = {};
  for (const t of txs) { cum += t.amount; byDay[(t.created_at || '').slice(0, 10)] = Math.round(cum); }
  return Object.entries(byDay).map(([date, total]) => ({ date, total }));
}

// 争议榜：按投资人评分分歧（区间 = 最高分 - 最低分）排序
function controversialBoard(limit = 30) {
  const db = getDb();
  return db.prepare(`
    SELECT b.id, b.title, b.founder, b.visibility, b.kind,
      MIN(e.score) AS lo, MAX(e.score) AS hi, ROUND(AVG(e.score),1) AS avg,
      (MAX(e.score) - MIN(e.score)) AS spread
    FROM bps b JOIN evaluations e ON e.bp_id = b.id
    WHERE b.kind = 'bp'
    GROUP BY b.id HAVING COUNT(e.id) >= 3
    ORDER BY spread DESC LIMIT ?
  `).all(limit);
}

// 共识度等级（评分区间越小越一致）
function consensusLevel(spread) {
  if (spread <= 15) return { label: '共识度高', labelEn: 'High consensus', cls: 'cons-high' };
  if (spread <= 30) return { label: '有一定分歧', labelEn: 'Some disagreement', cls: 'cons-mid' };
  return { label: '分歧很大', labelEn: 'Highly divided', cls: 'cons-low' };
}

// 赛道总览：各行业的项目数、累计注资、冠军项目（deal flow 视角）
function sectorsOverview() {
  const board = leaderboard('bp'); // 已按注资倒序
  const map = {};
  for (const r of board) {
    const s = r.sector || 'other';
    if (!map[s]) map[s] = { sector: s, cnt: 0, total: 0, champion: null };
    map[s].cnt++;
    map[s].total += r.total_invested;
    if (!map[s].champion && r.visibility === 'public') map[s].champion = { id: r.id, title: r.title };
  }
  return Object.values(map).sort((a, b) => b.total - a.total);
}

// 同赛道项目：用于横向对比（按累计注资倒序）
function sectorProjects(sector) {
  const db = getDb();
  return db.prepare(`
    SELECT b.id, b.title, b.founder, b.kind, b.visibility, b.summary, b.content,
      COALESCE(SUM(CASE WHEN h.amount > 0 THEN h.amount END), 0) AS total_invested,
      COUNT(DISTINCT CASE WHEN h.amount > 0 THEN h.investor_id END) AS investor_count,
      (SELECT ROUND(AVG(score),1) FROM evaluations e WHERE e.bp_id = b.id) AS avg_score
    FROM bps b LEFT JOIN holdings h ON h.bp_id = b.id
    WHERE b.sector = ?
    GROUP BY b.id ORDER BY total_invested DESC
  `).all(sector);
}

// "我的关注"汇总：给定一组项目id，返回当前名次/注资/最近一次涨跌
function followingSummary(ids) {
  const db = getDb();
  if (!Array.isArray(ids) || ids.length === 0) return [];
  const boards = { bp: leaderboard('bp'), demo: leaderboard('demo') };
  const out = [];
  for (const id of ids) {
    const bp = db.prepare('SELECT id, title, kind, visibility, founder FROM bps WHERE id = ?').get(id);
    if (!bp || bp.visibility !== 'public') continue;
    const kind = bp.kind || 'bp';
    const board = boards[kind] || [];
    const idx = board.findIndex((r) => r.id === id);
    const row = idx >= 0 ? board[idx] : null;
    const lastChange = db.prepare(
      "SELECT type, rank_from, rank_to, created_at FROM notifications WHERE bp_id = ? AND type IN ('rank_up','rank_down') ORDER BY id DESC LIMIT 1"
    ).get(id);
    out.push({
      id, title: bp.title, founder: bp.founder, kind,
      rank: idx >= 0 ? idx + 1 : null,
      total: row ? row.total_invested : 0,
      totalText: fmtMoney(row ? row.total_invested : 0),
      lastChange: lastChange ? { delta: lastChange.rank_from - lastChange.rank_to, from: lastChange.rank_from, to: lastChange.rank_to } : null,
    });
  }
  return out;
}

// 成绩分享卡数据：名次 / 注资 / 均分 / 最大注资投资人及其点评
function shareCardData(id) {
  const db = getDb();
  const bp = db.prepare('SELECT * FROM bps WHERE id = ?').get(id);
  if (!bp || bp.visibility !== 'public') return null;
  const kind = bp.kind || 'bp';
  const board = leaderboard(kind);
  const idx = board.findIndex((r) => r.id === id);
  const row = idx >= 0 ? board[idx] : null;
  const top = db.prepare(`
    SELECT i.name, i.emoji, i.type, i.slug, h.amount,
      (SELECT comment FROM evaluations e WHERE e.investor_id = i.id AND e.bp_id = ?) AS comment,
      (SELECT en FROM evaluations e WHERE e.investor_id = i.id AND e.bp_id = ?) AS en,
      (SELECT score FROM evaluations e WHERE e.investor_id = i.id AND e.bp_id = ?) AS score
    FROM holdings h JOIN investors i ON i.id = h.investor_id
    WHERE h.bp_id = ? AND h.amount > 0 ORDER BY h.amount DESC LIMIT 1
  `).get(id, id, id, id);
  return {
    bp, kind,
    rank: idx >= 0 ? idx + 1 : null,
    boardSize: board.length,
    total: row ? row.total_invested : 0,
    avg: row ? row.avg_score : null,
    investorCount: row ? row.investor_count : 0,
    top,
  };
}

// 运营看板指标：访客 / 复访 / 七日复访 / 上传量
function siteMetrics() {
  const db = getDb();
  const visitors = db.prepare('SELECT COUNT(DISTINCT visitor) n FROM visits').get().n;
  const returning = db.prepare('SELECT COUNT(*) n FROM (SELECT visitor FROM visits GROUP BY visitor HAVING COUNT(DISTINCT day) >= 2)').get().n;
  const sevenDay = db.prepare(`
    SELECT COUNT(*) n FROM (SELECT visitor, MIN(day) f FROM visits GROUP BY visitor) base
    WHERE EXISTS (
      SELECT 1 FROM visits v
      WHERE v.visitor = base.visitor AND v.day > base.f
        AND julianday(v.day) - julianday(base.f) <= 7
    )
  `).get().n;
  const visits7 = db.prepare("SELECT COUNT(*) n FROM visits WHERE day >= date('now','-7 days')").get().n;
  const uploads7 = db.prepare("SELECT COUNT(*) n FROM bps WHERE created_at >= datetime('now','-7 days')").get().n;
  const bpN = db.prepare("SELECT COUNT(*) n FROM bps WHERE kind='bp'").get().n;
  const demoN = db.prepare("SELECT COUNT(*) n FROM bps WHERE kind='demo'").get().n;
  const daily = db.prepare("SELECT day, COUNT(*) c FROM visits GROUP BY day ORDER BY day DESC LIMIT 14").all();
  return {
    visitors, returning, sevenDay, visits7, uploads7, bpN, demoN, daily,
    retRate: visitors ? Math.round((returning / visitors) * 100) : 0,
    sevenRate: visitors ? Math.round((sevenDay / visitors) * 100) : 0,
  };
}

// 某项目的真实结果记录（最新在前）
function bpOutcomes(id) {
  const db = getDb();
  return db.prepare('SELECT * FROM outcomes WHERE bp_id = ? ORDER BY occurred_at DESC, id DESC').all(id);
}

// 某项目的第一方可观测信号（公开展示用）。防刷 + 不羞辱冷启动：
//  - 计数按访客去重（bp_events 主键已保证每访客每天每类一条）；
//  - 优先给质量/相对指标（复访率、平均停留、近7天趋势），原始大数不突出；
//  - 样本不足(< MIN_SAMPLE 个访客)时返回 enough=false → 前端显示"数据积累中"，不亮难看的小数字。
const MIN_SAMPLE = 5;
function bpSignals(id) {
  const db = getDb();
  try {
  const one = (sql) => db.prepare(sql).get(id)?.n || 0;
  const views = one("SELECT COUNT(DISTINCT visitor) n FROM bp_events WHERE bp_id = ? AND kind = 'view'");
  const plays = one("SELECT COUNT(DISTINCT visitor) n FROM bp_events WHERE bp_id = ? AND kind = 'play'");
  const shares = one("SELECT COUNT(DISTINCT visitor) n FROM bp_events WHERE bp_id = ? AND kind = 'share'");
  const returning = one("SELECT COUNT(*) n FROM (SELECT visitor FROM bp_events WHERE bp_id = ? AND kind IN ('view','play') GROUP BY visitor HAVING COUNT(DISTINCT day) >= 2)");
  const dwellMs = db.prepare("SELECT AVG(dwell_ms) a FROM bp_events WHERE bp_id = ? AND kind = 'view' AND dwell_ms > 0").get(id)?.a || 0;
  const v7 = db.prepare("SELECT COUNT(DISTINCT visitor) n FROM bp_events WHERE bp_id = ? AND kind = 'view' AND day >= date('now','-7 days')").get(id)?.n || 0;
  const vPrev = db.prepare("SELECT COUNT(DISTINCT visitor) n FROM bp_events WHERE bp_id = ? AND kind = 'view' AND day >= date('now','-14 days') AND day < date('now','-7 days')").get(id)?.n || 0;
  const trend = v7 > vPrev * 1.1 ? 'up' : (v7 < vPrev * 0.9 ? 'down' : 'flat');
  return {
    enough: views >= MIN_SAMPLE,
    views, plays, shares, returning,
    returnRate: views ? Math.round((returning / views) * 100) : 0,
    avgDwellS: Math.round(dwellMs / 1000),
    trend, v7,
  };
  } catch { return { enough: false, views: 0, plays: 0, shares: 0, returning: 0, returnRate: 0, avgDwellS: 0, trend: 'flat', v7: 0 }; }
}

// 资讯流：最新在前，可按 region 过滤。
function newsList({ region = '', limit = 50 } = {}) {
  const db = getDb();
  const rows = region
    ? db.prepare('SELECT * FROM news WHERE region = ? ORDER BY COALESCE(NULLIF(published_at,\'\'), created_at) DESC, id DESC LIMIT ?').all(region, limit)
    : db.prepare('SELECT * FROM news ORDER BY COALESCE(NULLIF(published_at,\'\'), created_at) DESC, id DESC LIMIT ?').all(limit);
  return rows.map((r) => { let tags = []; try { tags = JSON.parse(r.tags || '[]'); } catch {} return { ...r, tags }; });
}
function newsRegions() {
  const db = getDb();
  return db.prepare("SELECT region, COUNT(*) n FROM news WHERE region != '' GROUP BY region ORDER BY n DESC").all();
}

// 活动：默认未来在前（未定日期排末尾）；past=true 取往期(倒序)。
function eventsList({ region = '', past = false, limit = 100 } = {}) {
  const db = getDb();
  const reg = region ? 'AND region = ?' : '';
  const args = region ? [region, limit] : [limit];
  const sql = past
    ? `SELECT * FROM events WHERE start_at != '' AND start_at < date('now') ${reg} ORDER BY start_at DESC, id DESC LIMIT ?`
    : `SELECT * FROM events WHERE (start_at = '' OR start_at >= date('now')) ${reg} ORDER BY (start_at = '') ASC, start_at ASC, id ASC LIMIT ?`;
  const rows = db.prepare(sql).all(...args);
  return rows.map((r) => { let tags = []; try { tags = JSON.parse(r.tags || '[]'); } catch {} return { ...r, tags }; });
}
function eventRegions() {
  const db = getDb();
  return db.prepare("SELECT region, COUNT(*) n FROM events WHERE region != '' GROUP BY region ORDER BY n DESC").all();
}

// 积分：用户余额；某作品的打赏总额与最近记录；提示词包（按访客是否已购返回正文或预览）。
function userPoints(uid) {
  const db = getDb();
  return db.prepare('SELECT points FROM users WHERE id = ?').get(uid)?.points ?? 0;
}
function bpTips(bpId) {
  const db = getDb();
  const total = db.prepare('SELECT COALESCE(SUM(amount),0) t, COUNT(*) n FROM tips WHERE bp_id = ?').get(bpId);
  const recent = db.prepare(`
    SELECT t.amount, t.message, t.created_at, u.handle, u.avatar
    FROM tips t LEFT JOIN users u ON u.id = t.from_user_id
    WHERE t.bp_id = ? ORDER BY t.id DESC LIMIT 8
  `).all(bpId);
  return { total: total.t, count: total.n, recent };
}
const ASSET_KINDS = ['claude_md', 'skill', 'plugin', 'prompt', 'workflow', 'config', 'other'];
function packForBp(bpId, viewerUid = null) {
  const db = getDb();
  const p = db.prepare('SELECT * FROM prompt_packs WHERE bp_id = ?').get(bpId);
  if (!p) return null;
  const isOwner = viewerUid && viewerUid === p.owner_user_id;
  const purchased = viewerUid ? !!db.prepare('SELECT 1 FROM pack_purchases WHERE buyer_user_id = ? AND bp_id = ?').get(viewerUid, bpId) : false;
  const unlocked = isOwner || purchased || p.price <= 0;
  const buyers = db.prepare('SELECT COUNT(*) n FROM pack_purchases WHERE bp_id = ?').get(bpId).n;
  let stack = []; try { stack = JSON.parse(p.stack || '[]'); } catch {}
  let assetsRaw = []; try { assetsRaw = JSON.parse(p.assets || '[]'); } catch {}
  assetsRaw = Array.isArray(assetsRaw) ? assetsRaw : [];
  // 免费总露"清单"(kind+title)；解锁后才给 content
  const assetList = assetsRaw.map((a) => ({ kind: ASSET_KINDS.includes(a?.kind) ? a.kind : 'other', title: String(a?.title || '') }));
  const assets = unlocked ? assetsRaw.map((a) => ({ kind: ASSET_KINDS.includes(a?.kind) ? a.kind : 'other', title: String(a?.title || ''), content: String(a?.content || '') })) : [];
  return {
    bp_id: p.bp_id, title: p.title, preview: p.preview, price: p.price,
    llm: p.llm || '', stack, assetList, assets,
    body: unlocked ? p.body : '', unlocked, isOwner, purchased, buyers,
  };
}

// 资源对接（方向9）：需求 ↔ 资源
const NEED_TYPES = {
  icp: 'ICP备案', deploy: '上线/部署', coldstart: '冷启动', seedusers: '种子用户',
  distribution: '发行/推广', funding: '找投资', legal: '法务/合规', design: '设计/UI',
  growth: '运营/增长', other: '其他',
};
function needsList({ type = '', limit = 60 } = {}) {
  const db = getDb();
  const where = type ? "WHERE n.status='open' AND n.type=?" : "WHERE n.status='open'";
  const args = type ? [type, limit] : [limit];
  const rows = db.prepare(`
    SELECT n.id, n.type, n.detail, n.region, n.created_at, n.bp_id,
      u.handle, u.name, u.avatar, b.title AS bp_title,
      (SELECT COUNT(*) FROM resources r WHERE r.type = n.type) AS match_resources
    FROM needs n JOIN users u ON u.id = n.user_id LEFT JOIN bps b ON b.id = n.bp_id
    ${where} ORDER BY n.id DESC LIMIT ?
  `).all(...args);
  return rows;
}
function resourcesList({ type = '', limit = 60 } = {}) {
  const db = getDb();
  const where = type ? 'WHERE r.type=?' : '';
  const args = type ? [type, limit] : [limit];
  const rows = db.prepare(`
    SELECT r.id, r.type, r.title, r.detail, r.region, r.contact, r.verified, r.created_at,
      u.handle, u.name, u.avatar
    FROM resources r LEFT JOIN users u ON u.id = r.user_id
    ${where} ORDER BY r.verified DESC, r.id DESC LIMIT ?
  `).all(...args);
  return rows;
}
function resourceCounts() {
  const db = getDb();
  const o = {};
  for (const r of db.prepare('SELECT type, COUNT(*) n FROM resources GROUP BY type').all()) o[r.type] = r.n;
  return o;
}

// 找搭子：按画像匹配其他用户（mode=similar 志同道合 / complement 能力互补）。需本人已有画像。
const MATCH_AX = ['tech', 'product', 'business', 'aesthetic', 'vision', 'originality', 'execution', 'influence'];
const MATCH_AX_LABEL = { tech: '技术力', product: '产品', business: '商业', aesthetic: '审美', vision: '视野', originality: '创意', execution: '落地', influence: '影响力' };
function matchCandidates(userId, mode = 'similar', limit = 12) {
  const db = getDb();
  const meRow = db.prepare('SELECT dims, themes FROM user_profiles WHERE user_id = ?').get(userId);
  if (!meRow) return { ok: false, reason: 'no_profile' };
  let md = {}, mt = []; try { md = JSON.parse(meRow.dims || '{}'); } catch {} try { mt = JSON.parse(meRow.themes || '[]'); } catch {}
  const mvec = MATCH_AX.map((a) => Number(md[a]) || 0);
  const rows = db.prepare('SELECT p.user_id, p.dims, p.themes, u.handle, u.name, u.avatar FROM user_profiles p JOIN users u ON u.id = p.user_id WHERE p.user_id != ?').all(userId);
  const out = [];
  for (const r of rows) {
    let d = {}, t = []; try { d = JSON.parse(r.dims || '{}'); } catch {} try { t = JSON.parse(r.themes || '[]'); } catch {}
    const vec = MATCH_AX.map((a) => Number(d[a]) || 0);
    let dist = 0; for (let i = 0; i < 8; i++) dist += (mvec[i] - vec[i]) ** 2; dist = Math.sqrt(dist);
    const sim = 1 - Math.min(1, dist / 282.8);
    const shared = mt.filter((x) => t.includes(x));
    const themeNorm = mt.length ? shared.length / Math.max(1, Math.min(mt.length, t.length)) : 0;
    const comp = []; for (let i = 0; i < 8; i++) { if (mvec[i] < 45 && vec[i] >= 65) comp.push(MATCH_AX_LABEL[MATCH_AX[i]]); }
    let score, reason;
    if (mode === 'complement') {
      score = 0.55 * (comp.length / 8) + 0.25 * sim + 0.20 * themeNorm;
      reason = (comp.length ? `TA 强在你较弱的：${comp.join('/')}` : '能力互补一般') + (shared.length ? ` · 题材重合：${shared.join('、')}` : '');
    } else {
      score = 0.6 * sim + 0.4 * themeNorm;
      reason = (shared.length ? `共同题材：${shared.join('、')}` : '题材重合较少') + ` · 画像相似 ${Math.round(sim * 100)}%`;
    }
    out.push({ handle: r.handle, name: r.name, avatar: r.avatar, pct: Math.round(score * 100), reason });
  }
  out.sort((a, b) => b.pct - a.pct);
  return { ok: true, items: out.slice(0, limit) };
}

// 用户画像与社媒链接
function userProfile(userId) {
  const db = getDb();
  const p = db.prepare('SELECT * FROM user_profiles WHERE user_id = ?').get(userId);
  if (!p) return null;
  let dims = {}, themes = []; try { dims = JSON.parse(p.dims || '{}'); } catch {} try { themes = JSON.parse(p.themes || '[]'); } catch {}
  return { dims, themes, summary: p.summary, social_summary: p.social_summary, basedOn: p.based_on, updatedAt: p.updated_at };
}
function userSocials(userId) {
  const db = getDb();
  return db.prepare('SELECT platform, url FROM user_socials WHERE user_id = ?').all(userId);
}

// 账户：按 handle 取用户；取某用户名下的作品（含估值区间与累计注资）。
function userByHandle(handle) {
  const db = getDb();
  return db.prepare('SELECT id, handle, name, avatar, bio, github_login, created_at FROM users WHERE handle = ?').get(String(handle || ''));
}
function userProjects(userId) {
  const db = getDb();
  const rows = db.prepare(`
    SELECT b.id, b.title, b.kind, b.archetype, b.visibility, b.val_summary, b.created_at,
      COALESCE((SELECT SUM(amount) FROM holdings h WHERE h.bp_id = b.id), 0) AS total_invested
    FROM bps b WHERE b.owner_user_id = ? ORDER BY b.created_at DESC
  `).all(userId);
  return rows.map((r) => { let s = null; try { s = JSON.parse(r.val_summary || 'null'); } catch {} return { ...r, valLow: s?.low || 0, valHigh: s?.high || 0, valN: s?.n || 0 }; });
}

// 某项目的改进建议（评分卡弱项 → 可执行建议 + 有界估值影响），供详情页 What-if 模拟器使用。
function bpSuggestions(id) {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM suggestions WHERE bp_id = ? ORDER BY id ASC').all(id);
  return rows.map((r) => { let en = null; try { en = JSON.parse(r.en || 'null'); } catch {} return { ...r, en }; });
}

// 估值校准：取有"货币型真实结果"且有综合估值的项目，对比预测区间 vs 真实金额。
function calibrationData() {
  const db = getDb();
  const rows = db.prepare(`
    SELECT o.bp_id, o.type, o.amount, o.occurred_at, o.source_url, o.note,
           b.title, b.kind, b.val_summary
    FROM outcomes o JOIN bps b ON b.id = o.bp_id
    WHERE o.type IN ('raised','acquired','revenue') AND o.amount > 0 AND b.visibility = 'public'
    ORDER BY o.occurred_at ASC, o.id ASC
  `).all();
  const items = [];
  const seen = new Set();
  for (const r of rows) {
    if (seen.has(r.bp_id)) continue; // 每个项目取最早一条货币结果
    let s = null; try { s = JSON.parse(r.val_summary || 'null'); } catch {}
    if (!s || !(s.n > 0)) continue;
    seen.add(r.bp_id);
    const mid = (s.low + s.high) / 2;
    items.push({
      bp_id: r.bp_id, title: r.title, kind: r.kind, type: r.type,
      archetype: s.archetype || 'other', algo_version: s.algo_version || 'v1',
      realized: r.amount, low: s.low, high: s.high, mid,
      inRange: r.amount >= s.low && r.amount <= s.high,
      ratio: mid > 0 ? r.amount / mid : 0,
      occurred_at: r.occurred_at, source_url: r.source_url, note: r.note,
    });
  }
  const medianOf = (arr) => { const a = arr.filter((x) => x > 0).sort((x, y) => x - y); if (!a.length) return 0; const m = Math.floor(a.length / 2); return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };
  const summarize = (arr) => {
    const nn = arr.length;
    const hh = arr.filter((x) => x.inRange).length;
    return { n: nn, hitRate: nn ? Math.round((hh / nn) * 100) : 0, medianRatio: Math.round(medianOf(arr.map((x) => x.ratio)) * 100) / 100 };
  };
  // 按算法版本 / 原型分组对比（信任看板用）
  const groupBy = (key) => {
    const g = {};
    for (const it of items) { (g[it[key]] = g[it[key]] || []).push(it); }
    return Object.keys(g).sort().map((k) => ({ key: k, ...summarize(g[k]) }));
  };
  const o = summarize(items);
  return { items, n: o.n, hitRate: o.hitRate, medianRatio: o.medianRatio, byVersion: groupBy('algo_version'), byArchetype: groupBy('archetype') };
}

// 可比库概览：按赛道分组（同组内有融资的优先、再按 stars），并统计总数/带融资数/赛道数。
function comparablesOverview(perSector = 30) {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM comparables ORDER BY sector, stars DESC').all();
  const total = rows.length;
  const funded = rows.filter((r) => r.funding).length;
  const map = {};
  for (const r of rows) { const s = r.sector || 'other'; (map[s] = map[s] || []).push(r); }
  const sectors = Object.entries(map).map(([sector, all]) => {
    const sorted = all.slice().sort((a, b) => (b.funding ? 1 : 0) - (a.funding ? 1 : 0) || b.stars - a.stars);
    return { sector, count: all.length, funded: all.filter((i) => i.funding).length, items: sorted.slice(0, perSector), more: Math.max(0, all.length - perSector) };
  }).sort((a, b) => b.count - a.count);
  return { total, funded, sectorCount: sectors.length, sectors };
}

module.exports = { leaderboard, bpDetail, investorsList, investorDetail, fmtMoney, fmtRange, siteMetrics, shareCardData, followingSummary, sectorProjects, bpQuestions, bpAnsweredQA, sectorsOverview, controversialBoard, consensusLevel, bpTrajectory, sectorBenchmark, weeklyDigest, investorPerformance, searchProjects, dealflowProjects, bpValuations, bpValuationHistory, bpOutcomes, bpSuggestions, bpSignals, userByHandle, userProjects, newsList, newsRegions, eventsList, eventRegions, userPoints, bpTips, packForBp, userProfile, userSocials, matchCandidates, NEED_TYPES, needsList, resourcesList, resourceCounts, calibrationData, comparablesOverview };
