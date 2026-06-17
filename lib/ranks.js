// 排名快照与站内动态：在每次调仓 / 新提交 / 重新参战后记录各项目名次，
// 与上一批快照对比算出涨跌，写入 notifications，供 /feed 与榜单角标使用。
const { getDb } = require('./db');

const KINDS = ['bp', 'demo'];

// 当前实时名次（与 leaderboard 排序一致：按累计注资倒序）
function computeRanks(db, kind) {
  const rows = db.prepare(`
    SELECT b.id AS bp_id, b.title, b.visibility,
      COALESCE(SUM(CASE WHEN h.amount > 0 THEN h.amount END), 0) AS total_invested
    FROM bps b
    LEFT JOIN holdings h ON h.bp_id = b.id
    WHERE b.kind = ?
    GROUP BY b.id
    ORDER BY total_invested DESC, b.id ASC
  `).all(kind);
  return rows.map((r, i) => ({ ...r, rank: i + 1 }));
}

// 记录一次快照，并对名次变化的项目生成通知。首次（无历史）只记基线、不通知。
function snapshotAndNotify(db, opts = {}) {
  db = db || getDb();
  const batch = opts.batch || new Date().toISOString(); // 含毫秒，保证可排序
  const prevRankStmt = db.prepare(
    'SELECT rank FROM rank_snapshots WHERE bp_id = ? AND batch < ? ORDER BY batch DESC LIMIT 1'
  );
  const insSnap = db.prepare(
    'INSERT INTO rank_snapshots (batch, bp_id, kind, rank, total_invested) VALUES (?,?,?,?,?)'
  );
  const insNotif = db.prepare(
    'INSERT INTO notifications (bp_id, kind, type, rank_from, rank_to, body) VALUES (?,?,?,?,?,?)'
  );
  let events = 0;
  for (const kind of KINDS) {
    const ranks = computeRanks(db, kind);
    for (const r of ranks) {
      const prev = prevRankStmt.get(r.bp_id, batch);
      insSnap.run(batch, r.bp_id, kind, r.rank, r.total_invested);
      if (prev && prev.rank !== r.rank) {
        const type = r.rank < prev.rank ? 'rank_up' : 'rank_down';
        insNotif.run(r.bp_id, kind, type, prev.rank, r.rank, '');
        events++;
      }
    }
  }
  return events;
}

// 新项目登场事件（processNewBp 调用）：记录首次上榜名次
function notifyNewEntry(db, bpId, kind, body, rankTo) {
  db.prepare(
    'INSERT INTO notifications (bp_id, kind, type, rank_from, rank_to, body) VALUES (?,?,?,?,?,?)'
  ).run(bpId, kind, 'new_entry', null, rankTo ?? null, body || '');
}

// 重新参战事件（由 resubmit API 调用，跑完调仓+快照后补一条）
function notifyReEntry(db, bpId, kind, body, rankFrom, rankTo) {
  db.prepare(
    'INSERT INTO notifications (bp_id, kind, type, rank_from, rank_to, body) VALUES (?,?,?,?,?,?)'
  ).run(bpId, kind, 're_entry', rankFrom ?? null, rankTo ?? null, body || '');
}

// 站内动态：最近的通知，连同项目标题/可见性
function recentNotifications(db, limit = 50) {
  db = db || getDb();
  return db.prepare(`
    SELECT n.*, b.title, b.visibility, b.founder
    FROM notifications n JOIN bps b ON b.id = n.bp_id
    ORDER BY n.created_at DESC, n.id DESC
    LIMIT ?
  `).all(limit);
}

// 榜单/详情页涨跌角标：取每个项目最近 7 天内最后一次排名变动的幅度（正=上升）
function rankDeltas(db, kind) {
  db = db || getDb();
  const rows = db.prepare(`
    SELECT n.bp_id, n.rank_from, n.rank_to
    FROM notifications n
    JOIN (
      SELECT bp_id, MAX(id) AS mid FROM notifications
      WHERE kind = ? AND type IN ('rank_up','rank_down')
        AND created_at >= datetime('now','-7 days')
      GROUP BY bp_id
    ) last ON last.mid = n.id
  `).all(kind);
  const map = {};
  for (const r of rows) map[r.bp_id] = r.rank_from - r.rank_to; // 正=名次变小=上升
  return map;
}

module.exports = {
  computeRanks,
  snapshotAndNotify,
  notifyNewEntry,
  notifyReEntry,
  recentNotifications,
  rankDeltas,
};
