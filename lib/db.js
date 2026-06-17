const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(path.join(DATA_DIR, 'uploads'))) fs.mkdirSync(path.join(DATA_DIR, 'uploads'), { recursive: true });

let db;

function getDb() {
  if (db) return db;
  db = new Database(path.join(DATA_DIR, 'bp-ranking.db'));
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS bps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      founder TEXT NOT NULL,
      summary TEXT DEFAULT '',
      content TEXT DEFAULT '',
      sector TEXT DEFAULT '',
      visibility TEXT DEFAULT 'public', -- public | ai_only
      filename TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS investors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,        -- llm | famous
      emoji TEXT DEFAULT '🤖',
      style TEXT DEFAULT '',
      real_llm INTEGER DEFAULT 0,
      cash REAL NOT NULL
    );
    CREATE TABLE IF NOT EXISTS holdings (
      investor_id INTEGER NOT NULL,
      bp_id INTEGER NOT NULL,
      amount REAL NOT NULL DEFAULT 0,
      PRIMARY KEY (investor_id, bp_id)
    );
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      investor_id INTEGER NOT NULL,
      bp_id INTEGER NOT NULL,
      type TEXT NOT NULL,        -- invest | withdraw | adjust
      amount REAL NOT NULL,      -- 正=注入 负=撤出
      reason TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS evaluations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      investor_id INTEGER NOT NULL,
      bp_id INTEGER NOT NULL,
      score REAL NOT NULL,
      valuation TEXT DEFAULT '',
      strengths TEXT DEFAULT '',
      weaknesses TEXT DEFAULT '',
      moat TEXT DEFAULT '',
      comment TEXT DEFAULT '',
      source TEXT DEFAULT 'sim', -- sim | deepseek
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE (investor_id, bp_id)
    );
    -- 排名快照：每次调仓/新提交后按赛道记录各项目名次，用于计算涨跌
    CREATE TABLE IF NOT EXISTS rank_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch TEXT NOT NULL,          -- 同一次快照共用的时间戳
      bp_id INTEGER NOT NULL,
      kind TEXT NOT NULL,           -- bp | demo
      rank INTEGER NOT NULL,        -- 1 起
      total_invested REAL NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_snap_bp ON rank_snapshots (bp_id, batch);
    -- 站内动态：排名涨跌 / 重新参战等事件
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bp_id INTEGER NOT NULL,
      kind TEXT NOT NULL,           -- bp | demo
      type TEXT NOT NULL,           -- rank_up | rank_down | new_entry | re_entry
      rank_from INTEGER,
      rank_to INTEGER,
      body TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_notif_created ON notifications (created_at);
    -- 访问埋点：每个匿名访客每天最多记一条，用于算复访率
    CREATE TABLE IF NOT EXISTS visits (
      visitor TEXT NOT NULL,
      day TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (visitor, day)
    );
    -- 路演问答：投资人提问(存在evaluations.question) + 创始人作答(此表)
    CREATE TABLE IF NOT EXISTS qa (
      bp_id INTEGER NOT NULL,
      investor_id INTEGER NOT NULL,
      q TEXT DEFAULT '',          -- 作答时对应的问题（用于判断答案是否已过期）
      a TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (bp_id, investor_id)
    );
    -- 估值：每位投资人对项目的结构化估值（联网取证 + 深度推理）
    CREATE TABLE IF NOT EXISTS valuations (
      bp_id INTEGER NOT NULL,
      investor_id INTEGER NOT NULL,
      low REAL DEFAULT 0,           -- 估值下限（元）
      high REAL DEFAULT 0,          -- 估值上限（元）
      method TEXT DEFAULT '',       -- 估值方法
      drivers TEXT DEFAULT '',      -- 关键驱动（JSON 数组）
      evidence TEXT DEFAULT '',     -- 证据（JSON 数组 {point,url}）
      confidence INTEGER DEFAULT 0, -- 置信度 0-100
      reasoning TEXT DEFAULT '',    -- 一句话估值逻辑
      en TEXT DEFAULT '',           -- 英文版 JSON {method,drivers,evidence,reasoning}
      created_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (bp_id, investor_id)
    );
    -- 估值历史：每次重估存一条综合估值快照，用于趋势曲线
    CREATE TABLE IF NOT EXISTS valuation_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bp_id INTEGER NOT NULL,
      low REAL DEFAULT 0,
      high REAL DEFAULT 0,
      confidence INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_valhist_bp ON valuation_history (bp_id, id);
    -- 可比项目库：导入的真实项目（GitHub 客观信号），作为估值锚点（不进排行榜）
    CREATE TABLE IF NOT EXISTS comparables (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source TEXT DEFAULT 'github',
      ref_id TEXT,                  -- 唯一标识（如 github full_name），用于去重/更新
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      url TEXT DEFAULT '',
      homepage TEXT DEFAULT '',
      sector TEXT DEFAULT '',
      language TEXT DEFAULT '',
      topics TEXT DEFAULT '',        -- JSON 数组
      stars INTEGER DEFAULT 0,
      forks INTEGER DEFAULT 0,
      watchers INTEGER DEFAULT 0,
      issues INTEGER DEFAULT 0,
      license TEXT DEFAULT '',
      created_at_src TEXT DEFAULT '',-- 仓库创建日期
      pushed_at TEXT DEFAULT '',     -- 最近提交日期
      archived INTEGER DEFAULT 0,
      star_velocity REAL DEFAULT 0,  -- stars/月（粗略热度速度）
      tier TEXT DEFAULT '',          -- toy|traction|popular|star（按 stars 粗分）
      funding TEXT DEFAULT '',       -- 半自动核查到的融资/收购摘要（真金白银锚点）
      funding_amount_usd REAL DEFAULT 0, -- 融资/收购金额（美元，数值，便于折算与做估值下限）
      funding_url TEXT DEFAULT '',   -- 来源链接
      funding_at TEXT DEFAULT '',    -- 事件日期
      enriched_at TEXT DEFAULT '',   -- 上次融资核查日期（空=未查过）
      fetched_at TEXT DEFAULT (datetime('now')),
      UNIQUE (source, ref_id)
    );
    CREATE INDEX IF NOT EXISTS idx_comp_sector ON comparables (sector);
    -- 真实结果：项目后来发生的可核实进展（融资/收购/营收/用户/停运），用于校准与建立信任复利
    CREATE TABLE IF NOT EXISTS outcomes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bp_id INTEGER NOT NULL,
      type TEXT NOT NULL,           -- raised | acquired | revenue | users | shutdown | other
      amount REAL,                  -- 金额(元) 或 数量(用户数)；shutdown/other 可空
      note TEXT DEFAULT '',
      source_url TEXT DEFAULT '',
      occurred_at TEXT DEFAULT '',  -- 发生日期 YYYY-MM 或 YYYY-MM-DD
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_outcome_bp ON outcomes (bp_id);
  `);
  // 迁移：Demo赛道（对已有数据库无损）
  const migrations = [
    "ALTER TABLE bps ADD COLUMN kind TEXT DEFAULT 'bp'",
    "ALTER TABLE bps ADD COLUMN demo_type TEXT DEFAULT ''",
    "ALTER TABLE bps ADD COLUMN demo_url TEXT DEFAULT ''",
    'ALTER TABLE investors ADD COLUMN demo_cash REAL DEFAULT 100000000',
    'ALTER TABLE bps ADD COLUMN version INTEGER DEFAULT 1',
    'ALTER TABLE bps ADD COLUMN last_resubmit_at TEXT',
    'ALTER TABLE bps ADD COLUMN authenticity REAL DEFAULT 1', // 查重/原创性乘子 0-1
    "ALTER TABLE evaluations ADD COLUMN question TEXT DEFAULT ''", // 投资人对该项目的尖锐提问
    "ALTER TABLE bps ADD COLUMN stage TEXT DEFAULT 'idea'", // 项目阶段 idea|mvp|revenue
    "ALTER TABLE bps ADD COLUMN subsector TEXT DEFAULT ''",  // 细分赛道(LLM)
    "ALTER TABLE bps ADD COLUMN biz_model TEXT DEFAULT ''",  // 商业模式
    "ALTER TABLE bps ADD COLUMN customer TEXT DEFAULT ''",   // 服务对象
    "ALTER TABLE bps ADD COLUMN tags TEXT DEFAULT ''",       // JSON 字符串数组
    "ALTER TABLE bps ADD COLUMN cover TEXT DEFAULT ''",      // 封面方案 JSON {emoji,kw,palette}
    "ALTER TABLE evaluations ADD COLUMN en TEXT DEFAULT ''", // 英文版评估 JSON {valuation,strengths,weaknesses,moat,comment,question}
    "ALTER TABLE bps ADD COLUMN val_evidence TEXT DEFAULT ''", // 估值共享联网证据 JSON [{title,snippet,url}]
    "ALTER TABLE bps ADD COLUMN val_summary TEXT DEFAULT ''",  // 综合估值 JSON {low,high,confidence,n,at}
    "ALTER TABLE bps ADD COLUMN val_hash TEXT DEFAULT ''",     // 估值时的内容指纹（内容未变则跳过重估）
    "ALTER TABLE bps ADD COLUMN shot TEXT DEFAULT ''",         // 首屏截图文件名（无头浏览器）
    "ALTER TABLE comparables ADD COLUMN funding TEXT DEFAULT ''",      // 可比库：融资/收购摘要
    "ALTER TABLE comparables ADD COLUMN funding_amount_usd REAL DEFAULT 0", // 可比库：融资金额(美元数值)
    "ALTER TABLE comparables ADD COLUMN funding_url TEXT DEFAULT ''",  // 可比库：来源链接
    "ALTER TABLE comparables ADD COLUMN funding_at TEXT DEFAULT ''",   // 可比库：事件日期
    "ALTER TABLE comparables ADD COLUMN enriched_at TEXT DEFAULT ''",  // 可比库：上次核查日期
    "ALTER TABLE bps ADD COLUMN archetype TEXT DEFAULT ''",            // DEMO 原型：website|game|tool|saas|ai_agent|ecommerce|community|other
    "ALTER TABLE valuations ADD COLUMN algo_version TEXT DEFAULT 'v1'",        // 估值算法版本（便于回测对比）
    "ALTER TABLE valuation_history ADD COLUMN algo_version TEXT DEFAULT 'v1'", // 综合估值快照的算法版本
    "ALTER TABLE outcomes ADD COLUMN verified INTEGER DEFAULT 0",      // 0=未核实/创始人声称，1=有来源已核实（仅核实者抬 floor）
  ];
  for (const m of migrations) { try { db.exec(m); } catch {} }

  // 改进建议（与评分卡同源）：每条锚定一个评分卡弱项，说清"补什么证据能把这维提上去"，
  // 用定性潜力(低/中/高)代替"假精确的估值百分比"（诚实优先，不编造金额影响）。
  db.exec(`
    CREATE TABLE IF NOT EXISTS suggestions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bp_id INTEGER NOT NULL,
      archetype TEXT DEFAULT '',
      dim TEXT DEFAULT '',           -- feature|differentiation|avoid|visual|ux|growth|coldstart|tech|moat
      rubric_dim TEXT DEFAULT '',    -- 主要补强的评分卡维度 completeness|validation|commercial|maintainability|market|moat
      title TEXT DEFAULT '',
      detail TEXT DEFAULT '',
      evidence_needed TEXT DEFAULT '',-- 采纳后"补什么可核实证据/达到什么指标"才能把该维提上去
      potential TEXT DEFAULT '',      -- 定性潜力：低|中|高（不再用编造的百分比）
      effort TEXT DEFAULT '',         -- 低|中|高
      impact_low REAL DEFAULT 0,      -- 兼容旧字段，保留不用
      impact_high REAL DEFAULT 0,
      evidence_url TEXT DEFAULT '',
      en TEXT DEFAULT '',             -- 英文版 JSON {title,detail,evidence_needed}
      algo_version TEXT DEFAULT 'v1',
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_sugg_bp ON suggestions (bp_id);
  `);
  // 老库补列（表已存在时 CREATE 不会加列）
  for (const m of [
    "ALTER TABLE suggestions ADD COLUMN evidence_needed TEXT DEFAULT ''",
    "ALTER TABLE suggestions ADD COLUMN potential TEXT DEFAULT ''",
  ]) { try { db.exec(m); } catch {} }

  // 第一方可观测信号（按项目）：试玩/浏览/分享/停留。按 (bp_id, visitor, kind, day) 去重——
  // 同一访客每天每类只记一条，喂给估值的是去重后的信号 → 刷量基本无收益（与防刷红线一致）。
  db.exec(`
    CREATE TABLE IF NOT EXISTS bp_events (
      bp_id INTEGER NOT NULL,
      visitor TEXT NOT NULL,
      kind TEXT NOT NULL,           -- view | play | share
      day TEXT NOT NULL,
      dwell_ms INTEGER DEFAULT 0,   -- 停留时长（取当天最大值）
      created_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (bp_id, visitor, kind, day)
    );
    CREATE INDEX IF NOT EXISTS idx_bpev_bp ON bp_events (bp_id, kind);
  `);

  // 用户账户（阶段 2）：GitHub OAuth 身份 + 作品归属。匿名上传仍允许（owner_user_id 可空）。
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider TEXT NOT NULL DEFAULT 'github',
      provider_uid TEXT NOT NULL,        -- 第三方唯一 id（如 github 数字 id）
      handle TEXT UNIQUE NOT NULL,       -- 站内用户名（/u/[handle]）
      name TEXT DEFAULT '',
      avatar TEXT DEFAULT '',
      bio TEXT DEFAULT '',
      github_login TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE (provider, provider_uid)
    );
  `);
  for (const m of ['ALTER TABLE bps ADD COLUMN owner_user_id INTEGER']) { try { db.exec(m); } catch {} }

  // 积分变现（阶段 3，站内积分过渡，不接真支付）：打赏 + 提示词工程售卖
  for (const m of ['ALTER TABLE users ADD COLUMN points INTEGER DEFAULT 1000']) { try { db.exec(m); } catch {} }
  db.exec(`
    CREATE TABLE IF NOT EXISTS ledger (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      delta INTEGER NOT NULL,          -- 正=收入 负=支出（积分）
      type TEXT NOT NULL,              -- signup | tip_out | tip_in | sale_in | purchase_out | grant
      ref_bp_id INTEGER,
      ref_user_id INTEGER,
      note TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_ledger_user ON ledger (user_id, id);
    CREATE TABLE IF NOT EXISTS tips (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_user_id INTEGER NOT NULL,
      to_user_id INTEGER NOT NULL,
      bp_id INTEGER NOT NULL,
      amount INTEGER NOT NULL,
      message TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_tips_bp ON tips (bp_id);
    -- 提示词工程包：每个作品一份（v1 不分段；分段留 v2）
    CREATE TABLE IF NOT EXISTS prompt_packs (
      bp_id INTEGER PRIMARY KEY,
      owner_user_id INTEGER NOT NULL,
      title TEXT DEFAULT '',
      preview TEXT DEFAULT '',         -- 免费预览（人人可见）
      body TEXT DEFAULT '',            -- 付费正文/总览（购买/作者可见）
      llm TEXT DEFAULT '',             -- 用了哪个 LLM 及版本（免费可见，如 "Claude Opus 4.8"）
      stack TEXT DEFAULT '[]',         -- 用到的工具/插件/技能等标签 JSON 数组（免费可见）
      assets TEXT DEFAULT '[]',        -- 可复刻资产 JSON：[{kind,title,content}]（付费解锁；预览只露 kind/title）
      price INTEGER NOT NULL DEFAULT 0,-- 积分定价（0=免费公开）
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS pack_purchases (
      buyer_user_id INTEGER NOT NULL,
      bp_id INTEGER NOT NULL,
      amount INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (buyer_user_id, bp_id)
    );
  `);
  // 老库补列（提示词包结构化字段）
  for (const m of [
    "ALTER TABLE prompt_packs ADD COLUMN llm TEXT DEFAULT ''",
    "ALTER TABLE prompt_packs ADD COLUMN stack TEXT DEFAULT '[]'",
    "ALTER TABLE prompt_packs ADD COLUMN assets TEXT DEFAULT '[]'",
  ]) { try { db.exec(m); } catch {} }

  // 账户化的关注与模拟持仓（登录后服务端存；匿名仍用 localStorage）
  db.exec(`
    CREATE TABLE IF NOT EXISTS follows (
      user_id INTEGER NOT NULL,
      bp_id INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, bp_id)
    );
    CREATE TABLE IF NOT EXISTS portfolios (
      user_id INTEGER PRIMARY KEY,
      fund REAL NOT NULL DEFAULT 100000000,
      positions TEXT DEFAULT '[]',     -- JSON 数组
      updated_at TEXT DEFAULT (datetime('now'))
    );
    -- 用户画像（方向5）：从多个作品 + 自报社媒公开信息综合（LLM）。仅供参考、社媒未核实。
    CREATE TABLE IF NOT EXISTS user_profiles (
      user_id INTEGER PRIMARY KEY,
      dims TEXT DEFAULT '{}',          -- JSON：能力维度 0-100 {tech,product,business,aesthetic,vision,originality,execution,influence}
      themes TEXT DEFAULT '[]',        -- JSON：题材偏好标签
      summary TEXT DEFAULT '',         -- 一段画像小结
      social_summary TEXT DEFAULT '',  -- 社媒公开信息综述（标注未核实）
      based_on INTEGER DEFAULT 0,      -- 基于多少个作品
      algo_version TEXT DEFAULT 'p1',
      updated_at TEXT DEFAULT (datetime('now'))
    );
    -- 用户自报社媒链接（展示 + 喂画像；未核实）
    CREATE TABLE IF NOT EXISTS user_socials (
      user_id INTEGER NOT NULL,
      platform TEXT NOT NULL,          -- xiaohongshu | x | bilibili | github | site | other
      url TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, platform)
    );
    -- 资源对接（方向9）：需求(vibe coder 的痛点) ↔ 资源(服务方/投资人/设计/增长…)
    CREATE TABLE IF NOT EXISTS needs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      bp_id INTEGER,                   -- 可关联自己的作品
      type TEXT NOT NULL,              -- icp|deploy|coldstart|seedusers|distribution|funding|legal|design|growth|other
      detail TEXT DEFAULT '',
      region TEXT DEFAULT '',
      status TEXT DEFAULT 'open',      -- open | closed
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_needs_type ON needs (type, status);
    CREATE TABLE IF NOT EXISTS resources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,                 -- 自荐者(可空=运营录入)
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      detail TEXT DEFAULT '',
      region TEXT DEFAULT '',
      contact TEXT DEFAULT '',         -- 联系方式(可空，优先走主页)
      verified INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_resources_type ON resources (type);
  `);

  // 资讯流（阶段 5 lite）：vibecoding 圈动态。半自动抓取(Tavily)+ 带来源；只读展示。
  db.exec(`
    CREATE TABLE IF NOT EXISTS news (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      summary TEXT DEFAULT '',
      source_url TEXT DEFAULT '',
      source_name TEXT DEFAULT '',
      tags TEXT DEFAULT '',          -- JSON 字符串数组
      region TEXT DEFAULT '',        -- 如 '上海' / 'global'，可空
      published_at TEXT DEFAULT '',  -- 来源日期(若有)
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE (source_url)
    );
    CREATE INDEX IF NOT EXISTS idx_news_created ON news (created_at);
  `);

  // 活动日历（阶段 5）：vibecoding 圈线下/线上活动。带报名链接；"谁去了"等社交待账户验证后接。
  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      host TEXT DEFAULT '',          -- 主办
      region TEXT DEFAULT '',        -- 城市/地区，如 上海
      venue TEXT DEFAULT '',         -- 地点
      start_at TEXT DEFAULT '',      -- YYYY-MM-DD 或 YYYY-MM-DD HH:MM（可空=待定）
      end_at TEXT DEFAULT '',
      signup_url TEXT DEFAULT '',     -- 报名链接
      source_url TEXT DEFAULT '',
      description TEXT DEFAULT '',
      tags TEXT DEFAULT '',          -- JSON 数组
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_events_start ON events (start_at);
  `);

  // 首次运行自动播种
  const count = db.prepare('SELECT COUNT(*) c FROM investors').get().c;
  if (count === 0) {
    const { seed } = require('./seed');
    seed(db);
  }
  // Demo赛道为空时补种示例Demo（含老库升级场景）
  const demoCount = db.prepare("SELECT COUNT(*) c FROM bps WHERE kind = 'demo'").get().c;
  if (demoCount === 0) {
    const { seedDemos } = require('./seed');
    seedDemos(db);
  }
  // 启动市场心跳定时器（幂等，可用 MARKET_TICK_MINUTES=0 关闭）
  try { require('./scheduler').startScheduler(getDb); } catch {}
  return db;
}

module.exports = { getDb, DATA_DIR };
