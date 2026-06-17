// 组合管理：新BP/Demo评估注资、整体调仓。BP与Demo两本账独立核算，各1亿。
const { PERSONAS, INITIAL_FUND } = require('./personas');
const { simEvaluation, scoreBp, investReason, withdrawReason, targetAllocation, textSimilarity, classifyFallback, normalizeClassification } = require('./engine');
const { deepseekEvaluate, deepseekClassify } = require('./deepseek');
const { snapshotAndNotify, computeRanks, notifyNewEntry } = require('./ranks');

function cashField(kind) { return kind === 'demo' ? 'demo_cash' : 'cash'; }

function getInvestorRow(db, slug) {
  return db.prepare('SELECT * FROM investors WHERE slug = ?').get(slug);
}

// 仅同赛道持仓（撤资腾挪不跨赛道）
function holdingsOf(db, investorId, kind) {
  return db.prepare(`
    SELECT h.bp_id, h.amount, b.title, b.summary, b.content, b.founder, b.sector, b.kind, b.demo_type, b.authenticity, b.id
    FROM holdings h JOIN bps b ON b.id = h.bp_id
    WHERE h.investor_id = ? AND h.amount > 0 AND b.kind = ?
  `).all(investorId, kind);
}

function applyTx(db, investorId, bpId, type, amount, reason, ts) {
  const t = ts || new Date().toISOString().replace('T', ' ').slice(0, 19);
  const kind = db.prepare('SELECT kind FROM bps WHERE id = ?').get(bpId)?.kind || 'bp';
  db.prepare('INSERT INTO transactions (investor_id, bp_id, type, amount, reason, created_at) VALUES (?,?,?,?,?,?)')
    .run(investorId, bpId, type, amount, reason, t);
  db.prepare(`
    INSERT INTO holdings (investor_id, bp_id, amount) VALUES (?,?,?)
    ON CONFLICT(investor_id, bp_id) DO UPDATE SET amount = amount + excluded.amount
  `).run(investorId, bpId, amount);
  db.prepare(`UPDATE investors SET ${cashField(kind)} = ${cashField(kind)} - ? WHERE id = ?`).run(amount, investorId);
}

function saveEvaluation(db, investorId, bpId, ev, ts) {
  const t = ts || new Date().toISOString().replace('T', ' ').slice(0, 19);
  db.prepare(`
    INSERT INTO evaluations (investor_id, bp_id, score, valuation, strengths, weaknesses, moat, comment, source, question, en, created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(investor_id, bp_id) DO UPDATE SET
      score=excluded.score, valuation=excluded.valuation, strengths=excluded.strengths,
      weaknesses=excluded.weaknesses, moat=excluded.moat, comment=excluded.comment,
      source=excluded.source, question=excluded.question, en=excluded.en, created_at=excluded.created_at
  `).run(investorId, bpId, ev.score, ev.valuation, ev.strengths, ev.weaknesses, ev.moat, ev.comment, ev.source || 'sim', ev.question || '', JSON.stringify(ev.en || null), t);
}

// 分类：LLM 单次打标（无 key 关键词兜底），结果落库到 bps。
async function classifyAndStore(db, bp, cheap = false) {
  const { coverFallback } = require('./engine');
  let c = cheap ? null : await deepseekClassify(bp);
  c = c || classifyFallback(bp);
  if (!c.cover) c.cover = coverFallback(bp);
  c = normalizeClassification(c, bp);
  db.prepare('UPDATE bps SET subsector=?, biz_model=?, customer=?, archetype=?, tags=?, cover=? WHERE id=?')
    .run(c.subsector, c.biz_model, c.customer, c.archetype, JSON.stringify(c.tags), JSON.stringify(c.cover), bp.id);
  return c;
}

// 查重/原创性：与其它公开项目内容比对，雷同（照抄模板）→ 乘子降低，最终评分被压低。
function computeAuthenticity(db, bp) {
  const mine = `${bp.summary || ''} ${bp.content || ''}`;
  if (mine.replace(/\s+/g, '').length < 12) return 1;
  const others = db.prepare("SELECT id, summary, content FROM bps WHERE id != ? AND visibility = 'public'").all(bp.id);
  let maxSim = 0;
  for (const o of others) {
    const sim = textSimilarity(mine, `${o.summary || ''} ${o.content || ''}`);
    if (sim > maxSim) maxSim = sim;
  }
  let mult = 1;
  if (maxSim > 0.5) mult = Math.max(0.4, 1 - (maxSim - 0.5) * 1.2); // 越雷同罚得越狠
  return Math.round(mult * 100) / 100;
}

// 单个投资人对一个项目出评估：全员走 LLM（人格化 prompt），失败/无 key 时降级模拟。
// 原创性乘子：LLM 分在此手动乘；模拟分已在 scoreBp 内乘过，避免重复。
async function evaluateOne(bp, persona, cheap = false) {
  let ev = cheap ? null : await deepseekEvaluate(bp, persona);
  if (ev) {
    const a = bp.authenticity ?? 1;
    ev.score = Math.max(1, Math.round(ev.score * a * 10) / 10);
  } else {
    ev = simEvaluation(persona, bp);
  }
  return ev;
}

// 按评估分配置仓位（必要时同赛道腾挪），资金有先后依赖须串行调用。
function allocateForInvestor(db, persona, bp, ev, ts) {
  const inv = getInvestorRow(db, persona.slug);
  if (!inv) return;
  const kind = bp.kind || 'bp';
  const field = cashField(kind);
  const target = Math.round(targetAllocation(persona, ev.score) * INITIAL_FUND);
  if (target <= 0) return;

  let cash = getInvestorRow(db, persona.slug)[field];
  if (cash < target) {
    const held = holdingsOf(db, inv.id, kind)
      .map((h) => ({ ...h, s: scoreBp(persona, h).score }))
      .sort((a, b) => a.s - b.s);
    for (const h of held) {
      if (cash >= target) break;
      if (h.s >= ev.score) break; // 只撤比新项目差的
      const pull = Math.min(h.amount, target - cash);
      applyTx(db, inv.id, h.bp_id, 'withdraw', -pull, withdrawReason(persona, h), ts);
      cash += pull;
    }
  }
  const amount = Math.min(target, Math.floor(cash));
  if (amount > 1000000) {
    applyTx(db, inv.id, bp.id, 'invest', amount, ev.comment || investReason(persona, bp, ev.score), ts);
  }
}

// 单个投资人完整处理（评估→配置），保留给单点调用。
async function processBpForInvestor(db, persona, bp, { ts } = {}) {
  const inv = getInvestorRow(db, persona.slug);
  if (!inv) return;
  const ev = await evaluateOne(bp, persona);
  saveEvaluation(db, inv.id, bp.id, ev, ts);
  allocateForInvestor(db, persona, bp, ev, ts);
}

// 新BP/Demo上传后：先算原创性，再让 12 位投资人并行评估，串行配置仓位。
// cheap=true：跳过所有 LLM（关键词分类 + 模拟评分），用于批量导入控成本。
async function processNewBp(db, bp, { cheap = false } = {}) {
  const authenticity = computeAuthenticity(db, bp);
  db.prepare('UPDATE bps SET authenticity = ? WHERE id = ?').run(authenticity, bp.id);
  bp.authenticity = authenticity;

  const [, evs] = await Promise.all([
    classifyAndStore(db, bp, cheap),
    Promise.all(PERSONAS.map((p) => evaluateOne(bp, p, cheap))),
  ]);
  PERSONAS.forEach((p, i) => {
    const inv = getInvestorRow(db, p.slug);
    if (!inv) return;
    saveEvaluation(db, inv.id, bp.id, evs[i]);
    allocateForInvestor(db, p, bp, evs[i]);
  });

  snapshotAndNotify(db);
  const kind = bp.kind || 'bp';
  const rank = computeRanks(db, kind).find((r) => r.bp_id === bp.id)?.rank;
  notifyNewEntry(db, bp.id, kind, `新${kind === 'demo' ? 'Demo' : 'BP'}登场，首次上榜第 ${rank} 名`, rank);
}

// 重新参战：重算原创性 + 全员并行重评（只刷新报告分；由调用方随后 rebalanceAll 调整持仓）
async function reEvaluateBp(db, bp) {
  const authenticity = computeAuthenticity(db, bp);
  db.prepare('UPDATE bps SET authenticity = ? WHERE id = ?').run(authenticity, bp.id);
  bp.authenticity = authenticity;

  const [, evs] = await Promise.all([
    classifyAndStore(db, bp),
    Promise.all(PERSONAS.map((p) => evaluateOne(bp, p))),
  ]);
  PERSONAS.forEach((p, i) => {
    const inv = getInvestorRow(db, p.slug);
    if (!inv) return;
    saveEvaluation(db, inv.id, bp.id, evs[i]);
  });
}

// 估值倾斜：让“调仓”响应估值。同一赛道内，把每个项目的“市价占比”（累计注资份额）与
// “估值占比”（综合估值中点份额）比较：市场给得相对偏少（低估）→ 上调目标仓位（加仓）；
// 相对偏多（高估）→ 下调（减仓）。返回 { bpId: 倾斜系数(0.6~1.7) }；同赛道有估值的项目不足 2 个则不倾斜。
function valuationTilts(db) {
  const tilts = {};
  for (const kind of ['bp', 'demo']) {
    const rows = db.prepare('SELECT id, val_summary FROM bps WHERE kind = ?').all(kind)
      .map((r) => { let v = null; try { v = JSON.parse(r.val_summary || 'null'); } catch {} return { id: r.id, mid: v && v.n > 0 ? (v.low + v.high) / 2 : 0 }; })
      .filter((r) => r.mid > 0);
    if (rows.length < 2) continue;
    const inv = {};
    for (const h of db.prepare('SELECT bp_id, SUM(amount) amt FROM holdings GROUP BY bp_id').all()) inv[h.bp_id] = h.amt || 0;
    const sumVal = rows.reduce((s, r) => s + r.mid, 0);
    const sumMkt = rows.reduce((s, r) => s + (inv[r.id] || 0), 0);
    for (const r of rows) {
      const fairShare = r.mid / sumVal;
      const mktShare = sumMkt > 0 ? (inv[r.id] || 0) / sumMkt : 0;
      const ratio = mktShare > 0 ? fairShare / mktShare : 1.7; // 还没人投 → 视为低估，倾向加仓
      tilts[r.id] = Math.max(0.6, Math.min(1.7, Math.sqrt(ratio)));
    }
  }
  return tilts;
}

// 全局调仓（/api/tick）：按每位投资人“实际给出的评估分”向目标仓位靠拢（5%滞回避免抖动），
// 并叠加估值倾斜（低估加仓 / 高估减仓）。评估分即 LLM 实质分，刷词分不驱动调仓。
function rebalanceAll(db, { ts } = {}) {
  const bps = db.prepare('SELECT * FROM bps').all();
  const tilts = valuationTilts(db);
  let moves = 0;
  for (const p of PERSONAS) {
    const inv = getInvestorRow(db, p.slug);
    if (!inv) continue;
    for (const bp of bps) {
      const kind = bp.kind || 'bp';
      const field = cashField(kind);
      const evRow = db.prepare('SELECT score FROM evaluations WHERE investor_id=? AND bp_id=?').get(inv.id, bp.id);
      const score = evRow ? evRow.score : scoreBp(p, bp).score;
      const target = Math.round(targetAllocation(p, score) * INITIAL_FUND * (tilts[bp.id] || 1));
      const cur = db.prepare('SELECT amount FROM holdings WHERE investor_id=? AND bp_id=?').get(inv.id, bp.id)?.amount || 0;
      const diff = target - cur;
      if (Math.abs(diff) < INITIAL_FUND * 0.05) continue;
      if (diff < 0) {
        applyTx(db, inv.id, bp.id, 'withdraw', diff, withdrawReason(p, bp), ts);
        moves++;
      } else {
        const cash = getInvestorRow(db, p.slug)[field];
        const add = Math.min(diff, Math.floor(cash));
        if (add > 1000000) {
          applyTx(db, inv.id, bp.id, 'invest', add, investReason(p, bp, score), ts);
          moves++;
        }
      }
    }
  }
  snapshotAndNotify(db);
  return moves;
}

// 市场情绪波动：让榜单即使无人上传也有"心跳"。每次只小幅、随机地调整一部分持仓，
// 通过 applyTx 路由资金池，保持"持仓+现金=1亿"不变量；随后快照并生成涨跌动态。
function marketTick(db, { intensity = 0.06, prob = 0.5 } = {}) {
  const holdings = db.prepare(`
    SELECT h.investor_id, h.bp_id, h.amount, b.kind
    FROM holdings h JOIN bps b ON b.id = h.bp_id
    WHERE h.amount > 0
  `).all();
  let moves = 0;
  for (const h of holdings) {
    if (Math.random() > prob) continue;
    let delta = Math.round(h.amount * (Math.random() * 2 - 1) * intensity);
    if (delta === 0) continue;
    const field = h.kind === 'demo' ? 'demo_cash' : 'cash';
    if (delta > 0) {
      const cash = db.prepare(`SELECT ${field} c FROM investors WHERE id = ?`).get(h.investor_id).c;
      delta = Math.min(delta, Math.floor(cash));
      if (delta < 100000) continue;
    } else {
      delta = Math.max(delta, -h.amount); // 不撤超过持仓
    }
    applyTx(db, h.investor_id, h.bp_id, 'adjust', delta, '市场情绪波动');
    moves++;
  }
  snapshotAndNotify(db);
  return moves;
}

module.exports = { processNewBp, processBpForInvestor, reEvaluateBp, rebalanceAll, applyTx, saveEvaluation, marketTick };
