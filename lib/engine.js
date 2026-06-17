// 虚拟投资人评估与调仓引擎（模拟部分）
const { PERSONAS } = require('./personas');

const SECTOR_KEYWORDS = {
  ai: ['ai', '人工智能', '大模型', 'llm', 'agent', '智能体', '机器学习', '深度学习', 'gpt'],
  saas: ['saas', '企业服务', 'b2b', '订阅', 'crm', 'erp', '协同'],
  consumer: ['消费', '电商', '零售', '品牌', 'c端', '社交', '本地生活'],
  healthcare: ['医疗', '健康', '制药', '诊断', '基因', '问诊'],
  education: ['教育', '学习', '培训', '课程', 'k12'],
  fintech: ['金融', '支付', '信贷', '保险', '理财', '风控'],
  hardware: ['硬件', '芯片', '传感器', '智能设备', 'iot', '物联网'],
  robotics: ['机器人', '自动驾驶', '无人机', '具身智能'],
  energy: ['能源', '电池', '光伏', '储能', '碳中和', '新能源'],
  space: ['航天', '卫星', '火箭', '太空'],
  web3: ['web3', '区块链', '加密', 'nft', 'defi', 'dao'],
  content: ['内容', '短视频', '直播', '播客', '创作者', '游戏'],
};

const SECTOR_LABELS = {
  ai: '人工智能', saas: '企业服务', consumer: '消费', healthcare: '医疗健康',
  education: '教育', fintech: '金融科技', hardware: '硬件', robotics: '机器人',
  energy: '新能源', space: '航天', web3: 'Web3', content: '内容', other: '其他',
};

const STAGE_LABELS = { idea: '想法 / Pre-MVP', mvp: '已有 MVP', revenue: '有营收 / 增长' };
const STAGE_LABELS_EN = { idea: 'Idea / Pre-MVP', mvp: 'Has MVP', revenue: 'Revenue / Growth' };
const SECTOR_LABELS_EN = { ai: 'AI', saas: 'SaaS', consumer: 'Consumer', healthcare: 'Healthcare', education: 'Education', fintech: 'Fintech', hardware: 'Hardware', robotics: 'Robotics', energy: 'Energy', space: 'Space', web3: 'Web3', content: 'Content', other: 'Other' };
const BIZ_MODEL_LABELS_EN = { saas: 'SaaS', transaction: 'Take-rate', hardware: 'Hardware', marketplace: 'Marketplace', ads: 'Ads', license: 'License', other: 'Other' };
const CUSTOMER_LABELS_EN = { enterprise: 'Enterprise', gov: 'Gov', developer: 'Developer', consumer: 'Consumer', smb: 'SMB', other: 'Other' };
// 按语言取标签
function L(zhMap, enMap, key, locale) { return (locale === 'en' ? enMap[key] : zhMap[key]) || zhMap[key] || key; }

const BIZ_MODEL_LABELS = {
  saas: 'SaaS订阅', transaction: '交易抽佣', hardware: '硬件销售',
  marketplace: '平台撮合', ads: '广告', license: '授权/项目制', other: '其他',
};
const CUSTOMER_LABELS = {
  enterprise: '企业', gov: '政府', developer: '开发者',
  consumer: '消费者', smb: '中小商家', other: '其他',
};

// 封面配色（深色双段渐变）与按赛道兜底的 emoji/配色
const COVER_PALETTES = {
  blue: ['#0e2a5e', '#1b6bbf'], purple: ['#2a1055', '#6b2db5'], teal: ['#06403f', '#11897e'],
  green: ['#0b3d2e', '#137a4e'], gold: ['#3d2e08', '#b5841d'], red: ['#3d1015', '#b53a4a'],
  slate: ['#1a2230', '#37506b'], pink: ['#3d1030', '#b52d86'],
};
const SECTOR_EMOJIS = {
  ai: ['🤖', '🧠', '✨', '🦾', '💡'],
  saas: ['🧰', '📊', '⚙️', '🗂️', '🔧'],
  consumer: ['🛍️', '🛒', '🥤', '👗', '🍫'],
  healthcare: ['🩺', '💊', '🧬', '🏥', '🫀'],
  education: ['📚', '🎓', '✏️', '🔬', '🧑‍🏫'],
  fintech: ['💳', '🏦', '📈', '💰', '🪙'],
  hardware: ['🔩', '💾', '🛠️', '🔌', '📡'],
  robotics: ['🦾', '🤖', '🛸', '🚗', '🦿'],
  energy: ['🔋', '⚡', '☀️', '🌱', '🔆'],
  space: ['🛰️', '🚀', '🌌', '🪐', '☄️'],
  web3: ['⛓️', '🪙', '🔐', '🌐', '💎'],
  content: ['🎬', '🎙️', '📹', '🎵', '✍️'],
  other: ['💡', '🌟', '🧩', '🔥', '🚀'],
};
const PALETTE_POOL = ['blue', 'purple', 'teal', 'green', 'gold', 'red', 'slate', 'pink'];
function hashStr(s) { let h = 2166136261; for (let i = 0; i < (s || '').length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
// 估值内容指纹：内容（标题/简介/正文/阶段）不变则指纹不变 → 可跳过重复估值省钱
function valHash(bp) { return hashStr(`${bp.title || ''}|${bp.summary || ''}|${bp.content || ''}|${bp.stage || ''}`).toString(36); }
function coverFallback(bp) {
  const s = bp.sector || 'other';
  const pool = SECTOR_EMOJIS[s] || SECTOR_EMOJIS.other;
  const h = hashStr(`${bp.id || ''}|${bp.title || ''}`);
  return {
    emoji: pool[h % pool.length],
    kw: SECTOR_LABELS[s] || '项目',
    palette: PALETTE_POOL[h % PALETTE_POOL.length],
  };
}

// ===== DEMO 原型（archetype）：分类型估值的基础 =====
const ARCHETYPE_LABELS = {
  website: '网站', game: '游戏', tool: '工具', saas: 'SaaS',
  ai_agent: 'AI Agent', ecommerce: '电商/交易', community: '内容/社区', other: '其他',
};
const ARCHETYPE_LABELS_EN = {
  website: 'Website', game: 'Game', tool: 'Tool', saas: 'SaaS',
  ai_agent: 'AI Agent', ecommerce: 'E-commerce', community: 'Community', other: 'Other',
};
// 各原型重点观察的信号（喂给评分卡 prompt）
const ARCHETYPE_FOCUS = {
  website: '转化动作/线索/SEO/品牌文案', game: '可玩性·留存(次日/7日)·分享传播·ARPU',
  tool: '省时·使用频率·错误率·付费意愿', saas: 'MRR·churn·activation·LTV/CAC',
  ai_agent: '任务成功率·幻觉率·单次成本·数据壁垒', ecommerce: 'GMV·订单·复购·支付闭环',
  community: 'DAU·UGC·互动率·SEO流量', other: '完成度·真实使用·变现·可维护性',
};
// 六维评分卡的分原型权重（每行合计 100；起始值，后续由回测对齐真实结果再调）
const ARCHETYPE_WEIGHTS = {
  website:   { completeness: 20, validation: 30, commercial: 15, maintainability: 10, market: 10, moat: 15 },
  game:      { completeness: 15, validation: 30, commercial: 15, maintainability: 5,  market: 15, moat: 20 },
  tool:      { completeness: 20, validation: 25, commercial: 20, maintainability: 10, market: 10, moat: 15 },
  saas:      { completeness: 15, validation: 25, commercial: 25, maintainability: 15, market: 10, moat: 10 },
  ai_agent:  { completeness: 15, validation: 20, commercial: 15, maintainability: 15, market: 15, moat: 20 },
  ecommerce: { completeness: 15, validation: 25, commercial: 30, maintainability: 10, market: 10, moat: 10 },
  community: { completeness: 10, validation: 35, commercial: 15, maintainability: 10, market: 15, moat: 15 },
  other:     { completeness: 20, validation: 25, commercial: 20, maintainability: 15, market: 10, moat: 10 },
};
const RUBRIC_DIMS = ['completeness', 'validation', 'commercial', 'maintainability', 'market', 'moat'];

// 关键词兜底判定原型（无 LLM 时尽力而为）
function classifyArchetypeFallback(bp) {
  const t = `${bp.title || ''} ${bp.summary || ''} ${bp.content || ''}`.toLowerCase();
  const has = (...ws) => ws.some((w) => t.includes(w));
  if (has('游戏', 'game', '关卡', '玩法', 'player', '贪吃蛇', '2048', 'puzzle', 'rpg', 'arcade', 'score')) return 'game';
  if (has('agent', '智能体', 'rag', '知识库', 'prompt', 'gpt', 'llm', '大模型', 'chatbot', 'assistant', '对话')) return 'ai_agent';
  if (has('商城', '电商', '购物', '下单', '支付', '订单', 'shop', 'cart', 'checkout', 'sku')) return 'ecommerce';
  if (has('saas', '后台', '管理系统', 'dashboard', 'crm', 'erp', '订阅', '工作流', '看板')) return 'saas';
  if (has('社区', '论坛', '博客', 'feed', '发帖', '评论', 'forum', 'blog', 'ugc', '内容平台')) return 'community';
  if (has('工具', '计算器', '生成器', '转换', 'calculator', 'converter', 'formatter', '编辑器', '脚本')) return 'tool';
  if (has('官网', '落地页', '作品集', 'landing', 'portfolio', 'homepage', '品牌', '展示页')) return 'website';
  // demo 托管的单文件 HTML 多为可玩/可用页面，兜底为 website
  return bp.kind === 'demo' ? 'website' : 'other';
}

// 综合分：六维分按原型权重加权（0-100）。dims 可为 {dim:score} 或 {dim:{score}}
function compositeScore(dims, archetype) {
  const w = ARCHETYPE_WEIGHTS[archetype] || ARCHETYPE_WEIGHTS.other;
  let total = 0, wsum = 0;
  for (const k of RUBRIC_DIMS) {
    const d = dims?.[k];
    const s = typeof d === 'number' ? d : Number(d?.score) || 0;
    total += w[k] * Math.max(0, Math.min(100, s));
    wsum += w[k];
  }
  return wsum ? Math.round(total / wsum) : 0;
}

// 无 LLM 时的关键词兜底分类（尽力而为）
function classifyFallback(bp) {
  const t = `${bp.title || ''} ${bp.summary || ''} ${bp.content || ''}`.toLowerCase();
  const has = (...ws) => ws.some((w) => t.includes(w));
  let biz_model = 'other';
  if (has('saas', '订阅', '会员')) biz_model = 'saas';
  else if (has('抽佣', '佣金', '撮合', 'take rate')) biz_model = 'transaction';
  else if (has('硬件', '芯片', '设备', '模块')) biz_model = 'hardware';
  else if (has('平台', 'marketplace', '双边')) biz_model = 'marketplace';
  else if (has('广告')) biz_model = 'ads';
  else if (has('项目制', '授权', '许可', '实施费')) biz_model = 'license';
  let customer = 'other';
  if (has('政府', '政务', '卫健', '监管')) customer = 'gov';
  else if (has('开发者', 'sdk', 'api', '研发团队')) customer = 'developer';
  else if (has('企业', 'b2b', '央企', '客户')) customer = 'enterprise';
  else if (has('门店', '商家', '诊所', '小微')) customer = 'smb';
  else if (has('消费者', 'c端', '用户', '个人')) customer = 'consumer';
  return { subsector: '', biz_model, customer, archetype: classifyArchetypeFallback(bp), tags: [], cover: coverFallback(bp) };
}

function normalizeClassification(c, bp) {
  const biz = BIZ_MODEL_LABELS[c?.biz_model] ? c.biz_model : 'other';
  const cus = CUSTOMER_LABELS[c?.customer] ? c.customer : 'other';
  // archetype：LLM 给的有效则用，否则关键词兜底（bp 可空时退 other）
  const arch = ARCHETYPE_LABELS[c?.archetype] ? c.archetype : (bp ? classifyArchetypeFallback(bp) : 'other');
  const sub = String(c?.subsector || '').trim().slice(0, 20);
  let tags = Array.isArray(c?.tags) ? c.tags : [];
  tags = tags.map((x) => String(x).trim().slice(0, 12)).filter(Boolean).slice(0, 5);
  const cv = c?.cover || {};
  const cover = {
    emoji: (String(cv.emoji || '').trim().slice(0, 4)) || '🚀',
    kw: String(cv.kw || '').trim().slice(0, 8),
    palette: COVER_PALETTES[cv.palette] ? cv.palette : 'blue',
  };
  return { subsector: sub, biz_model: biz, customer: cus, archetype: arch, tags, cover };
}

const DIM_KEYWORDS = {
  team: ['团队', '创始人', '联合创始人', 'cto', 'ceo', '背景', '履历', '连续创业', '名校', '大厂'],
  market: ['市场规模', 'tam', '万亿', '百亿', '千亿', '增长率', '渗透率', '蓝海', '市场空间'],
  moat: ['护城河', '壁垒', '专利', '独家', '网络效应', '规模效应', '先发优势', '技术积累', '数据壁垒'],
  traction: ['营收', '收入', '用户数', '增长', 'mau', 'dau', '留存', '复购', 'arr', 'gmv', '盈利', '订单'],
  clarity: ['商业模式', '盈利模式', '定价', '获客', '成本结构', '路线图', '里程碑', '融资计划'],
  bold: ['颠覆', '革命', '重新定义', '改变世界', '范式', '登月', '十倍'],
};

function detectSector(text) {
  const t = (text || '').toLowerCase();
  let best = 'other', bestN = 0;
  for (const [sector, kws] of Object.entries(SECTOR_KEYWORDS)) {
    const n = kws.reduce((s, k) => s + (t.includes(k) ? 1 : 0), 0);
    if (n > bestN) { bestN = n; best = sector; }
  }
  return best;
}

// 从BP文本提取各维度强度 0-100
function extractFeatures(text) {
  const t = (text || '').toLowerCase();
  const feats = {};
  for (const [dim, kws] of Object.entries(DIM_KEYWORDS)) {
    const hits = kws.reduce((s, k) => s + (t.includes(k.toLowerCase()) ? 1 : 0), 0);
    feats[dim] = Math.min(100, 30 + hits * 14);
  }
  // 信息量加成：太短的BP扣分
  const lenBonus = Math.min(15, Math.floor(t.length / 400));
  feats.clarity = Math.min(100, feats.clarity + lenBonus);
  return feats;
}

// ===== Demo 赛道：从代码/页面内容提取五维特征 0-100 =====
// completeness 完成度 | interactivity 交互性 | creativity 创意 | tech 技术复杂度 | utility 实用价值
function extractDemoFeatures(bp) {
  const code = bp.content || '';
  const lc = code.toLowerCase();
  const count = (re) => (lc.match(re) || []).length;

  const interactions = count(/addeventlistener|onclick|oninput|onchange|onsubmit|onkey/g) + count(/<button|<input|<select|<textarea/g);
  const techHits = count(/canvas|webgl|websocket|fetch\(|async |localstorage|indexeddb|audiocontext|requestanimationframe|navigator\.|three\.js|d3\./g);
  const styleHits = count(/@keyframes|transition|transform|animation|gradient|box-shadow|flex|grid/g);
  const dataHits = count(/json|map\(|filter\(|reduce\(|sort\(|chart|table|form/g);

  const feats = {
    completeness: Math.min(100, 34 + Math.floor(code.length / 600) * 5 + (lc.includes('<title') ? 8 : 0) + (lc.includes('<style') || lc.includes('css') ? 8 : 0)),
    interactivity: Math.min(100, 35 + interactions * 7),
    creativity: Math.min(100, 36 + styleHits * 5 + count(/game|游戏|动画|粒子|音乐|绘|画/g) * 8),
    tech: Math.min(100, 34 + techHits * 8),
    utility: Math.min(100, 35 + dataHits * 4 + count(/工具|效率|管理|计算|记录|todo|笔记|搜索/g) * 7),
  };
  // URL/GitHub 型：代码拿不到太多，靠文本描述兜底
  if (bp.demo_type !== 'html') {
    const t = `${bp.title} ${bp.summary} ${code}`.toLowerCase();
    for (const k of Object.keys(feats)) feats[k] = Math.max(feats[k], Math.min(85, 40 + Math.floor(t.length / 200) * 3));
  }
  return feats;
}

// BP人格权重 → Demo维度映射（沿用各投资人的性格倾向）
const DEMO_DIM_MAP = { team: 'tech', market: 'utility', moat: 'creativity', traction: 'completeness', clarity: 'interactivity', bold: 'creativity' };
const DEMO_DIM_LABELS = { completeness: '完成度', interactivity: '交互性', creativity: '创意', tech: '技术复杂度', utility: '实用价值' };

// 用slug+bp_id做稳定伪随机，保证同一投资人对同一BP评分稳定
function seededRand(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 1000) / 1000;
}

// ===== 反作弊：BP 不靠关键词给分，只看“可验证的证据/具体性”，并惩罚空话 =====
// 词表仅用于“扣分”，绝不因为出现某个词而加基础分，避免用户总结词表后照刷。
const HYPE_WORDS = ['颠覆', '革命性', '革命', '重新定义', '改变世界', '范式', '登月', '十倍', '百倍', '千倍',
  '绝对领先', '遥遥领先', '无与伦比', '风口', '独角兽', '秒杀', '吊打', '史诗级', '空前', '天花板',
  '碾压', '王炸', '降维打击', '改变行业', '彻底改变'];

// 量化证据：数字+单位、百分比、年份等“写出了具体内容”的信号（不是数关键词）
function evidenceCount(text) {
  const t = text || '';
  const numUnit = (t.match(/\d[\d,.]*\s*(%|％|‰|亿|万|千万|百万|倍|x|×|元|美元|名|人次|人|个|家|单|笔|年|月|周|日|天|月活|日活|mau|dau|arr|gmv|pv|uv|qps|tps)/gi) || []).length;
  const years = (t.match(/20\d{2}\s*年/g) || []).length;
  const pct = (t.match(/\d+(?:\.\d+)?\s*[%％]/g) || []).length;
  return numUnit + years + pct;
}

// BP 实质分（5-90）：仅作为无 LLM 时的兜底。中性基准 + 口号惩罚 + 信息充分度；
// 不读“团队”，不因任何词命中加基础分。数字证据只在“已有MVP/营收”阶段轻度加分且封顶很低，
// 避免“堆数字=高分”和“编造数据”的激励；想法阶段不因缺数据扣分。真正的洞察判断交给 LLM。
function bpSubstance(text, stage = 'idea') {
  const t = text || '';
  const len = t.length;
  if (len < 1) return 20;
  const evidence = evidenceCount(t);
  let hype = 0;
  for (const w of HYPE_WORDS) { const m = t.match(new RegExp(w, 'g')); if (m) hype += m.length; }
  let score = 50;                                     // 中性基准（不预设高低）
  score += Math.min(6, Math.floor(len / 500) * 2);    // 论述充分 → 很小加分
  score -= Math.min(20, hype * 3);                    // 口号词 → 扣分
  const hypeRatio = hype / Math.max(1, len / 80);
  if (hypeRatio > 1) score -= 8;                      // 口号密度过高 → 再扣
  if (stage === 'mvp' || stage === 'revenue') {
    score += Math.min(10, evidence * 2);              // 中后期才看数据，且封顶低
  }
  return Math.max(5, Math.min(90, Math.round(score * 10) / 10));
}

// 文本相似度（字符3-gram Jaccard），用于查重/反模板照抄
function textSimilarity(a, b) {
  const norm = (s) => (s || '').toLowerCase().replace(/\s+/g, '');
  const A = norm(a), B = norm(b);
  if (A.length < 12 || B.length < 12) return 0;
  const grams = (s) => { const set = new Set(); for (let i = 0; i + 3 <= s.length; i++) set.add(s.slice(i, i + 3)); return set; };
  const ga = grams(A), gb = grams(B);
  let inter = 0; for (const g of ga) if (gb.has(g)) inter++;
  const union = ga.size + gb.size - inter;
  return union ? inter / union : 0;
}

// 评分依据分析：从文本里挑出"被认可的具体证据"句子，与"不加分/扣分的口号词"，用于详情页解释评分。
function analyzeBpText(text) {
  const t = text || '';
  const evRe = /(\d[\d,.]*\s*(%|％|‰|亿|万|千万|百万|倍|x|×|元|美元|名|人次|人|个|家|单|笔|年|月|周|日|天|月活|日活|mau|dau|arr|gmv|pv|uv|qps|tps))|(20\d{2}\s*年)/i;
  const sentences = t.split(/[。；;\n!！?？]/).map((s) => s.trim()).filter((s) => s.length > 4);
  const evidenceSamples = [];
  for (const s of sentences) {
    if (evRe.test(s)) evidenceSamples.push(s.length > 50 ? s.slice(0, 50) + '…' : s);
    if (evidenceSamples.length >= 6) break;
  }
  const hypeSet = [];
  for (const w of HYPE_WORDS) { if (t.includes(w) && !hypeSet.includes(w)) hypeSet.push(w); }
  return { evidence: evidenceCount(t), hype: hypeSet.length, evidenceSamples, hypeSamples: hypeSet };
}

function scoreBp(persona, bp) {
  const isDemo = bp.kind === 'demo';
  const sector = bp.sector || detectSector(`${bp.title} ${bp.summary} ${bp.content}`);
  let score, feats;
  if (isDemo) {
    feats = extractDemoFeatures(bp);
    let s = 0, wsum = 0;
    for (const [dim, w] of Object.entries(persona.weights)) {
      const key = DEMO_DIM_MAP[dim];
      s += (feats[key] ?? 40) * w; wsum += w;
    }
    score = wsum ? s / wsum : 40;
  } else {
    // BP：不按关键词计分；按阶段看实质，团队背景一律忽略
    feats = {};
    score = bpSubstance(`${bp.title}。${bp.summary}。${bp.content}`, bp.stage || 'idea');
  }
  // 赛道偏好（投资人口味，非质量分）
  score += persona.sectors[sector] || 0;
  // 人格化稳定扰动
  score += (seededRand(persona.slug + '|' + bp.id) - 0.5) * 12;
  // 查重/原创性乘子（照抄模板会被压低）
  score *= (bp.authenticity ?? 1);
  return { score: Math.max(5, Math.min(98, Math.round(score * 10) / 10)), feats, sector };
}

const VOICE_TEMPLATES = {
  审慎: {
    invest: (bp, s) => `通读《${bp.title}》后，我认为其${s.top}是可验证的，风险敞口在可接受范围内。综合评分${s.score}，决定建仓，但会持续跟踪${s.weak}方面的进展。`,
    withdraw: (bp) => `复核《${bp.title}》时发现关键假设的不确定性上升，且组合中出现了风险收益比更优的标的，审慎起见减仓。`,
  },
  均衡: {
    invest: (bp, s) => `《${bp.title}》的叙事完整，${s.top}尤其突出，具备规模化想象空间。评分${s.score}，按组合策略配置仓位。`,
    withdraw: (bp) => `结合最新市场信息重新平衡组合，《${bp.title}》的相对吸引力下降，调出部分资金投向评分更高的新BP。`,
  },
  技术: {
    invest: (bp, s) => `从技术路线看，《${bp.title}》在${s.top}上有真实壁垒，工程可行性成立。评分${s.score}，注资观察其迭代速度。`,
    withdraw: (bp) => `技术路线竞争格局变化，《${bp.title}》的差异化窗口收窄，降低仓位等待下一个验证点。`,
  },
  工程: {
    invest: (bp, s) => `算了一笔账：《${bp.title}》的单位经济模型在${s.top}加持下能跑通，成本结构有优化空间。评分${s.score}，性价比合格，投。`,
    withdraw: (bp) => `重新测算后，《${bp.title}》的投入产出比不及组合内新标的，效率优先，撤出部分资金。`,
  },
  细读: {
    invest: (bp, s) => `逐页精读了《${bp.title}》全部材料，信息密度高，${s.top}的论证链条完整。评分${s.score}，值得下注。`,
    withdraw: (bp) => `对比通读组合内全部BP后，《${bp.title}》在${'细节论证'}上被新上传的BP超越，相应调整持仓。`,
  },
  激进: {
    invest: (bp, s) => `《${bp.title}》够疯狂！${s.top}如果成真就是十倍故事。评分${s.score}，重注，输了认。`,
    withdraw: (bp) => `这个项目变得太“安全”了，不够刺激。把筹码挪给更疯狂的想法。`,
  },
  价值: {
    invest: (bp, s) => `《${bp.title}》我能看懂，${s.top}构成了真实的护城河雏形，时间是它的朋友。评分${s.score}，以十年视角建仓。`,
    withdraw: (bp) => `重新审视后，《${bp.title}》的护城河没有想象中深，能力圈之外的部分太多，减仓。`,
  },
  愿景: {
    invest: (bp, s) => `《${bp.title}》站在信息革命的延长线上！${s.top}意味着这可能是下一个范式。评分${s.score}，要投就投成赛道第一。`,
    withdraw: (bp) => `愿景没有变，但执行速度跟不上时间窗口，资本要流向跑得更快的人。`,
  },
  投人: {
    invest: (bp, s) => `打动我的不是商业模式，是《${bp.title}》字里行间创始人的劲儿。${s.top}说明这个团队值得赌。评分${s.score}，投人，投了！`,
    withdraw: (bp) => `项目还行，但我在新上传的BP里看到了更让我心动的创始人气质，天使的子弹有限。`,
  },
  常识: {
    invest: (bp, s) => `用常识看《${bp.title}》：生意本质说得通，${s.top}是本分生意该有的样子。评分${s.score}，慢慢买。`,
    withdraw: (bp) => `有些环节不符合商业常识，看不懂的钱不赚，退一部分出来。`,
  },
  反共识: {
    invest: (bp, s) => `关键问题：有什么是你相信而大多数人反对的？《${bp.title}》在${s.top}上给出了反共识答案，有垄断潜质。评分${s.score}，入场。`,
    withdraw: (bp) => `当一个想法开始变成共识，超额收益就消失了。《${bp.title}》的稀缺性正在稀释，调仓。`,
  },
  数据: {
    invest: (bp, s) => `数据说话：《${bp.title}》的${s.top}指标处于赛道头部分位。评分${s.score}，按"重仓头部"纪律加注。`,
    withdraw: (bp) => `最新对比数据显示该项目已滑出赛道前列，纪律性减仓，资金转向新头部。`,
  },
};

const DIM_LABELS = { team: '团队', market: '市场空间', moat: '护城河', traction: '业务数据', clarity: '商业模式清晰度', bold: '颠覆性' };

function topAndWeakDims(persona, feats, isDemo = false) {
  const dims = isDemo ? Object.keys(DEMO_DIM_LABELS) : Object.keys(persona.weights);
  const labels = isDemo ? DEMO_DIM_LABELS : DIM_LABELS;
  const sorted = dims.slice().sort((a, b) => (feats[b] ?? 0) - (feats[a] ?? 0));
  return { top: labels[sorted[0]] || sorted[0], weak: labels[sorted[sorted.length - 1]] || '' };
}

// 生成模拟评估报告（无 LLM 时的兜底；BP 部分不评团队、不靠关键词）
function simEvaluation(persona, bp) {
  const isDemo = bp.kind === 'demo';
  const { score, feats, sector } = scoreBp(persona, bp);
  const valBase = Math.round((score * score) / 18) * 100; // 万元
  const valuation = score >= 50
    ? `${(valBase / 10000).toFixed(1)}亿 - ${((valBase * 1.6) / 10000).toFixed(1)}亿（虚拟估值区间）`
    : `暂不给出估值，需先验证核心假设`;
  if (isDemo) {
    const { top, weak } = topAndWeakDims(persona, feats, true);
    return {
      score,
      sector,
      valuation: score >= 50 ? valuation : '暂不给出估值，建议先打磨产品体验',
      strengths: `${top}是这个Demo最打动我的地方，能看出已经跑通了核心体验。`,
      weaknesses: `${weak}还有明显提升空间，建议下个版本优先补强；${bp.demo_type === 'html' ? '可以考虑部署上线接受真实用户检验' : '建议补充可直接试玩的版本'}。`,
      moat: feats.tech >= 60 ? '技术实现有亮点，继续深挖可形成差异化。' : '当前实现偏常规，亮点更多在产品想法层面。',
      comment: (VOICE_TEMPLATES[persona.voice]?.invest || VOICE_TEMPLATES['均衡'].invest)(bp, { top, weak, score }),
      question: `这个 Demo 的「${weak}」打算怎么补强？能否给出下一步可验证的计划？`,
      en: {
        valuation: score >= 50 ? `Est. valuation ¥${(valBase / 10000).toFixed(1)}–${((valBase * 1.6) / 10000).toFixed(1)}0k (virtual)` : 'No valuation yet — polish the core experience first.',
        strengths: 'The demo already runs its core flow, which is the most convincing part.',
        weaknesses: `There is clear room to improve; ${bp.demo_type === 'html' ? 'consider deploying it for real-user testing.' : 'consider providing a playable build.'}`,
        moat: feats.tech >= 60 ? 'The implementation shows real technical merit worth deepening.' : 'The build is fairly standard; the edge is more in the product idea.',
        comment: `Score ${score}. ${score >= 55 ? 'Worth backing — will watch its iteration speed.' : 'Holding off until it shows more.'}`,
        question: 'What is your concrete plan to strengthen the weakest part of this demo next?',
      },
    };
  }
  const stage = bp.stage || 'idea';
  const early = stage === 'idea';
  return {
    score,
    sector,
    valuation,
    strengths: early
      ? '作为早期项目，关键在于洞察与切入点是否成立——这里有值得深挖的角度。'
      : '已进入有产品/营收阶段，可结合其披露的进展进一步验证。',
    weaknesses: early
      ? '建议讲清：最关键的未验证假设是什么、打算用这笔钱做哪个最小实验去验证它，以及最大风险。'
      : '建议补充单位经济与可验证的业务进展；对“已实现”的数据给出来源或验证方式。',
    moat: '护城河看是否有可持续的、非共识的洞察；注意：团队背景无法核实，本平台不计入评分。',
    comment: (VOICE_TEMPLATES[persona.voice]?.invest || VOICE_TEMPLATES['均衡'].invest)(bp, { top: '核心洞察', weak: early ? '假设验证计划' : '数据可信度', score }),
    question: early
      ? '你最大的、尚未验证的假设是什么？拿到这笔钱后，打算用什么最小实验、在多久内验证它？'
      : '你最关键的业务数据来自哪里、如何验证？未来 6 个月可验证的目标是多少？',
    en: {
      valuation: score >= 50 ? `Est. valuation ¥${(valBase / 10000).toFixed(1)}–${((valBase * 1.6) / 10000).toFixed(1)}0k (virtual)` : 'No valuation yet; core assumptions need validation first.',
      strengths: early
        ? 'For an early-stage idea, what matters is whether the insight and entry point hold up — and there is an angle worth digging into here.'
        : 'It has reached a product/revenue stage, so claims can be checked against disclosed progress.',
      weaknesses: early
        ? 'Spell out: the single riskiest unvalidated assumption, the minimal experiment to test it with this funding, and the biggest risk.'
        : 'Add unit economics and verifiable traction; for any "achieved" numbers, cite the source or how they can be verified.',
      moat: 'A moat should rest on a durable, non-consensus insight. Note: founder background cannot be verified and is excluded from scoring.',
      comment: `Score ${score}. ${score >= 55 ? 'Worth taking a position and tracking closely.' : 'Holding off until the core is better substantiated.'}`,
      question: early
        ? 'What is your biggest unvalidated assumption, and what minimal experiment will you run — by when — to test it with this funding?'
        : 'Where does your key metric come from and how is it verified? What is your verifiable 6-month target?',
    },
  };
}

function investReason(persona, bp, score, feats) {
  const isDemo = bp.kind === 'demo';
  if (isDemo) {
    const f = feats || extractDemoFeatures(bp);
    const { top, weak } = topAndWeakDims(persona, f, true);
    return (VOICE_TEMPLATES[persona.voice]?.invest || VOICE_TEMPLATES['均衡'].invest)(bp, { top, weak, score });
  }
  return (VOICE_TEMPLATES[persona.voice]?.invest || VOICE_TEMPLATES['均衡'].invest)(bp, { top: '可验证的进展', weak: '证据充分度', score });
}
function withdrawReason(persona, bp) {
  return (VOICE_TEMPLATES[persona.voice]?.withdraw || VOICE_TEMPLATES['均衡'].withdraw)(bp);
}

// 根据评分计算目标仓位（占总资金比例）
function targetAllocation(persona, score) {
  if (score < 45) return 0;
  const frac = ((score - 45) / 55) * persona.risk * 0.28; // 单项目最高约28%×risk
  return Math.round(frac * 1000) / 1000;
}

function getPersona(slug) {
  return PERSONAS.find((p) => p.slug === slug);
}

module.exports = {
  PERSONAS, scoreBp, simEvaluation, investReason, withdrawReason,
  targetAllocation, detectSector, extractFeatures, extractDemoFeatures, getPersona,
  bpSubstance, evidenceCount, textSimilarity, analyzeBpText, valHash,
  SECTOR_LABELS, STAGE_LABELS, BIZ_MODEL_LABELS, CUSTOMER_LABELS,
  SECTOR_LABELS_EN, STAGE_LABELS_EN, BIZ_MODEL_LABELS_EN, CUSTOMER_LABELS_EN, L,
  classifyFallback, normalizeClassification, coverFallback, COVER_PALETTES,
  ARCHETYPE_LABELS, ARCHETYPE_LABELS_EN, ARCHETYPE_FOCUS, ARCHETYPE_WEIGHTS, RUBRIC_DIMS,
  classifyArchetypeFallback, compositeScore,
};
