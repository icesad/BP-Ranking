// 估值编排：一次联网搜索（全员共享）→ 12 位投资人并行用 deepseek-reasoner 估值 → 存库 + 算综合估值。
const { PERSONAS } = require('./personas');
const { tavilySearch } = require('./tavily');
const { valuateDemo, valuationLevers, scoreRubric } = require('./deepseek');
const { SECTOR_LABELS, valHash, compositeScore, classifyArchetypeFallback } = require('./engine');
const { comparablesFor, comparableForBp } = require('./comparables');
const { usdCnyRate } = require('./fx');

// 估值算法版本：评分卡 + 单一主干 + 第一方信号优先 = v2（便于回测对比 v1）
const ALGO_VERSION = 'v2';

// 采集第一方可观测信号（最可信、自动、不靠用户更新）：
//  - 站内 per-bp 行为（bp_events：试玩/浏览/分享/停留/复访，按访客去重，难刷）
//  - URL/GitHub 客观数据（可比库）
function collectSignals(db, bp, cm) {
  const s = {};
  try {
    const plays = db.prepare("SELECT COUNT(DISTINCT visitor) n FROM bp_events WHERE bp_id = ? AND kind = 'play'").get(bp.id)?.n || 0;
    const views = db.prepare("SELECT COUNT(DISTINCT visitor) n FROM bp_events WHERE bp_id = ? AND kind = 'view'").get(bp.id)?.n || 0;
    const shares = db.prepare("SELECT COUNT(DISTINCT visitor) n FROM bp_events WHERE bp_id = ? AND kind = 'share'").get(bp.id)?.n || 0;
    // 复访：在 >=2 个不同日期有过 view/play 的访客数
    const ret = db.prepare("SELECT COUNT(*) n FROM (SELECT visitor FROM bp_events WHERE bp_id = ? AND kind IN ('view','play') GROUP BY visitor HAVING COUNT(DISTINCT day) >= 2)").get(bp.id)?.n || 0;
    const dwell = db.prepare("SELECT AVG(dwell_ms) a FROM bp_events WHERE bp_id = ? AND kind = 'view' AND dwell_ms > 0").get(bp.id)?.a || 0;
    if (views) s.views = views;
    if (plays) s.plays = plays;
    if (shares) s.shares = shares;
    if (ret) s.returning = ret;
    if (views) s.return_rate = Math.round((ret / views) * 100) / 100;
    if (dwell) s.avg_dwell_s = Math.round(dwell / 1000);
  } catch {}
  if (cm) {
    if (cm.stars) s.gh_stars = cm.stars;
    if (cm.forks) s.gh_forks = cm.forks;
    if (cm.pushed_at) s.gh_pushed_at = cm.pushed_at;
    if (cm.archived) s.gh_archived = true;
  }
  return s;
}

function buildQuery(bp) {
  const sector = SECTOR_LABELS[bp.sector] || bp.sector || '';
  const cat = bp.subsector || sector;
  const kindWord = bp.kind === 'demo' ? 'product' : 'startup';
  return `${bp.title} ${cat} ${kindWord} market size, comparable products and pricing, recent funding or acquisition valuations`.trim();
}

function median(nums) {
  const a = nums.filter((n) => n > 0).sort((x, y) => x - y);
  if (!a.length) return 0;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}
// 去极值后取中位数：剔除最高/最低各 k 个离群值，避免被个别极端估值拉飞
function trimmedMedian(nums) {
  const a = nums.filter((n) => n > 0).sort((x, y) => x - y);
  if (a.length < 5) return median(a);
  const k = Math.max(1, Math.floor(a.length * 0.15));
  return median(a.slice(k, a.length - k));
}

// 各家估值的分歧度：返回各家区间总跨度 lo–hi 与离散等级（low/mid/high）。
function dispersion(lows, highs) {
  const mids = [];
  for (let i = 0; i < lows.length; i++) { if (lows[i] > 0 && highs[i] > 0) mids.push((lows[i] + highs[i]) / 2); }
  if (mids.length < 2) return null;
  const lo = Math.round(Math.min(...lows.filter((x) => x > 0)));
  const hi = Math.round(Math.max(...highs.filter((x) => x > 0)));
  const med = median(mids);
  const ratio = med > 0 ? (Math.max(...mids) - Math.min(...mids)) / med : 0;
  const level = ratio < 0.5 ? 'low' : ratio < 1.2 ? 'mid' : 'high';
  return { lo, hi, level };
}

async function valuateBp(db, bp, { force = false } = {}) {
  // 0) 成本控制：内容未变且已有估值 → 直接沿用，不调用任何 LLM（省钱）
  const cur = valHash(bp);
  const existingN = db.prepare('SELECT COUNT(*) c FROM valuations WHERE bp_id = ?').get(bp.id).c;
  if (!force && existingN > 0 && bp.val_hash === cur) {
    let s = null; try { s = JSON.parse(bp.val_summary || 'null'); } catch {}
    return { ...(s || { n: existingN }), skipped: true };
  }

  // 1) 共享联网搜索 + 站内同赛道真实可比项目（估值锚点）
  const evidence = await tavilySearch(buildQuery(bp));
  db.prepare('UPDATE bps SET val_evidence = ? WHERE id = ?').run(JSON.stringify(evidence), bp.id);
  const comps = comparablesFor(db, bp, 5);

  // 真实融资硬下限：仅采信**可核实**的融资/收购（verified=1 或带来源链接）——自报无来源不抬 floor
  let floor = 0;
  const ownMoney = db.prepare("SELECT MAX(amount) m FROM outcomes WHERE bp_id = ? AND type IN ('raised','acquired') AND amount > 0 AND (verified = 1 OR (source_url IS NOT NULL AND source_url != ''))").get(bp.id)?.m || 0;
  if (ownMoney > 0) floor = ownMoney;
  const cm = comparableForBp(db, bp);
  if (cm && cm.funding_amount_usd > 0) {
    const rate = await usdCnyRate();
    floor = Math.max(floor, Math.round(cm.funding_amount_usd * rate));
  }

  // 2) 12 位投资人估值（分批并发，避免被模型限流/超时）
  const invMap = {};
  for (const r of db.prepare('SELECT id, slug FROM investors').all()) invMap[r.slug] = r.id;
  const results = [];
  const BATCH = 6;
  for (let i = 0; i < PERSONAS.length; i += BATCH) {
    const batch = PERSONAS.slice(i, i + BATCH);
    const part = await Promise.all(batch.map((p) => valuateDemo(bp, p, evidence, comps, floor).then((v) => ({ p, v })).catch(() => ({ p, v: null }))));
    results.push(...part);
  }

  // 3) 存库
  const up = db.prepare(`
    INSERT INTO valuations (bp_id, investor_id, low, high, method, drivers, evidence, confidence, reasoning, en, algo_version, created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?, datetime('now'))
    ON CONFLICT(bp_id, investor_id) DO UPDATE SET
      low=excluded.low, high=excluded.high, method=excluded.method, drivers=excluded.drivers,
      evidence=excluded.evidence, confidence=excluded.confidence, reasoning=excluded.reasoning,
      en=excluded.en, algo_version=excluded.algo_version, created_at=excluded.created_at
  `);
  const lows = [], highs = [], confs = [];
  let n = 0;
  for (const { p, v } of results) {
    if (!v || !invMap[p.slug]) continue;
    up.run(bp.id, invMap[p.slug], v.low, v.high, v.method, JSON.stringify(v.drivers), JSON.stringify(v.evidence), v.confidence, v.reasoning, JSON.stringify(v.en || null), ALGO_VERSION);
    lows.push(v.low); highs.push(v.high); confs.push(v.confidence); n++;
  }

  // 4) 综合估值（含各家分歧度）
  const summary = {
    low: Math.round(trimmedMedian(lows)),
    high: Math.round(trimmedMedian(highs)),
    confidence: confs.length ? Math.round(confs.reduce((s, x) => s + x, 0) / confs.length) : 0,
    n,
    disp: dispersion(lows, highs),
    comps: comps.length,
    compList: comps.slice(0, 5).map((c) => ({ name: c.name, url: c.url, stars: c.stars, funding: c.funding || '' })),
    at: new Date().toISOString().slice(0, 10),
  };
  // 4.5) 真实融资硬下限：估值区间下限不应低于项目已有的真金白银量级
  if (floor > 0) {
    summary.floor = floor;
    if (summary.low < floor) summary.low = floor;
    if (summary.high < summary.low) summary.high = Math.round(summary.low * 1.1);
  }
  // 4.7) 六维评分卡（结构化解释层 + 驱动建议 + 对市场区间做"有界微调"，供 What-if 模拟器联动）
  //   - 12 家中位区间仍是市场主体；评分卡只做 ±25% 的有界倾斜，禁止无界连乘 / 双重计分。
  //   - validation/commercial 优先用第一方信号；缺数据由 scoreRubric 内保守处理。
  const archetype = bp.archetype || classifyArchetypeFallback(bp);
  summary.archetype = archetype;
  const signals = collectSignals(db, bp, cm);
  if (signals && Object.keys(signals).length) summary.signals = signals;
  if (n > 0) {
    try {
      const rb = await scoreRubric(bp, archetype, evidence, comps, floor, signals);
      if (rb && rb.dims) {
        const compScore = compositeScore(rb.dims, archetype); // 0-100
        const tilt = Math.max(0.75, Math.min(1.25, 0.75 + (compScore / 100) * 0.5)); // 50→×1.0，0→×0.75，100→×1.25
        summary.baseLow = summary.low; summary.baseHigh = summary.high;
        summary.low = Math.round(summary.low * tilt);
        summary.high = Math.round(summary.high * tilt);
        if (floor > 0 && summary.low < floor) { summary.low = floor; if (summary.high < summary.low) summary.high = Math.round(summary.low * 1.1); }
        summary.rubric = rb.dims; summary.rubricEn = rb.en; summary.compScore = compScore; summary.tilt = Math.round(tilt * 100) / 100;
      }
    } catch {}
  }
  summary.algo_version = ALGO_VERSION;
  // 5) 估值杠杆：便宜的一次 chat 调用，给出抬高/拖低估值的关键动作（失败不影响主流程）
  if (n > 0) {
    try { const lv = await valuationLevers(bp, summary, evidence); if (lv && lv.levers) summary.levers = lv.levers; } catch {}
  }
  db.prepare('UPDATE bps SET val_summary = ?, val_hash = ? WHERE id = ?').run(JSON.stringify(summary), cur, bp.id);
  if (n > 0) {
    db.prepare('INSERT INTO valuation_history (bp_id, low, high, confidence, algo_version) VALUES (?,?,?,?,?)')
      .run(bp.id, summary.low, summary.high, summary.confidence, ALGO_VERSION);
  }
  console.log(`[valuation] bp#${bp.id} 成功 ${n}/${PERSONAS.length} 家，证据 ${evidence.length} 条${summary.levers ? `，杠杆 ${summary.levers.length} 条` : ''}`);
  return { ...summary, skipped: false };
}

module.exports = { valuateBp };
