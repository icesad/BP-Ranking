// 轻量 i18n：字典 + t()。locale 由 cookie `lang` 决定（zh|en），服务端组件读取后传入。
const DICT = {
  // Nav
  'nav.bp': { zh: 'BP榜', en: 'BP Board' },
  'nav.demo': { zh: 'Demo榜', en: 'Demos' },
  'nav.feed': { zh: '动态', en: 'Feed' },
  'nav.news': { zh: '资讯', en: 'News' },
  'nav.events': { zh: '活动', en: 'Events' },
  'nav.match': { zh: '搭子', en: 'Buddies' },
  'nav.resources': { zh: '资源对接', en: 'Resources' },
  'nav.sectors': { zh: '赛道', en: 'Sectors' },
  'nav.following': { zh: '我的关注', en: 'Following' },
  'nav.portfolio': { zh: '我的投资', en: 'Portfolio' },
  'nav.investors': { zh: '虚拟投资人', en: 'Investors' },
  'nav.search': { zh: '🔎 搜索项目…', en: '🔎 Search…' },
  'nav.upload': { zh: '上传 BP，一战高下', en: 'Submit your BP' },
  'nav.uploadDemo': { zh: '提交 Demo 🎮', en: 'Submit your Demo 🎮' },
  // Home hero
  'home.heroA': { zh: 'AI 时代，你的 Demo 到底值多少？', en: "In the AI era, what's your demo really worth?" },
  'home.heroB': { zh: '12 位 AI 投资人联网估值给答案', en: '12 AI investors price it, with web evidence' },
  'home.heroSub': { zh: '位 AI 投资人联网搜索 + 深度推理，给出带证据来源的估值——诚实到连自己都只敢打几万块。BP/Demo 双赛道各持 1 亿，实时排座次', en: ' AI investors search the web and reason deeply to value your build with cited evidence — honest enough to lowball itself. Dual BP/Demo tracks, ~$14M each, ranked live' },
  'home.toDemo': { zh: '做出Demo了？去晋级赛 →', en: 'Built a demo? Go to the Demo track →' },
  // Home stats
  'home.statBp': { zh: '参战BP', en: 'BPs' },
  'home.statInv': { zh: '虚拟投资人', en: 'Investors' },
  'home.statTotal': { zh: 'BP赛道累计注资', en: 'Total invested (BP)' },
  'home.statPool': { zh: 'BP赛道资金池', en: 'BP capital pool' },
  // Home board
  'home.boardTitle': { zh: '🏆 BP 综合排行榜', en: '🏆 BP Leaderboard' },
  'home.sortHint': { zh: '按虚拟注资总额排序', en: 'Ranked by total virtual investment' },
  'home.investorsTitle': { zh: '🤖 虚拟投资人', en: '🤖 AI Investors' },
  // Filters
  'filter.stage': { zh: '阶段', en: 'Stage' },
  'filter.model': { zh: '模式', en: 'Model' },
  'filter.customer': { zh: '对象', en: 'Customer' },
  'filter.all': { zh: '全部', en: 'All' },
  // Badges
  'badge.public': { zh: '公开', en: 'Public' },
  'badge.aionly': { zh: '仅AI可见', en: 'AI-only' },
  // Intro banner
  'intro.title': { zh: '👋 欢迎来到 Demo-Ranking', en: '👋 Welcome to Demo-Ranking' },
  'intro.body': { zh: '上传你的 BP 或 Demo，12 位 AI 投资人会用 1 亿虚拟资金为你投票排名。评分只认可验证的内容与证据、不奖励套话，团队背景不计分。还能当投资人建仓、给项目打榜。', en: 'Submit your BP or demo and 12 AI investors vote with ~$14M virtual capital each. Scoring rewards verifiable evidence — not buzzwords — and ignores founder background. You can also invest and build your own portfolio.' },
  'intro.cta1': { zh: '上传 BP 一战高下', en: 'Submit your BP' },
  'intro.cta2': { zh: '看 Demo 榜', en: 'See Demos' },
};

function t(locale, key) {
  const e = DICT[key];
  if (!e) return key;
  return e[locale] || e.zh;
}

// 投资人名称/风格的英文版（按 slug）
const PERSONA_I18N = {
  'claude-capital': { name: 'Claude Capital', style: 'Rigorous · long-term · risk-aware' },
  'gpt-ventures': { name: 'GPT Ventures', style: 'All-round · narrative & scalability' },
  'gemini-fund': { name: 'Gemini Fund', style: 'Tech-driven · multimodal & deep tech' },
  'deepseek-capital': { name: 'DeepSeek Capital', style: 'Live LLM · cost-efficiency · engineering faith' },
  'kimi-fund': { name: 'Kimi Fund', style: 'Long-context reader · loves info-dense BPs' },
  'grok-frontier': { name: 'Grok Frontier', style: 'Aggressively contrarian · loves wild ideas' },
  'buffett-style': { name: 'Value Anchor (Buffett style)', style: 'Style sim · moat-first · invest what you understand' },
  'son-style': { name: 'Vision Hunter (Son style)', style: 'Style sim · information revolution · disrupt or leave' },
  'xu-style': { name: 'Angel Ferryman (Xu style)', style: 'Style sim · early optimist · user love & real demand (team not scored)' },
  'duan-style': { name: 'Common Sense (Duan style)', style: 'Style sim · business common sense · slow is fast' },
  'thiel-style': { name: 'Zero to One (Thiel style)', style: 'Style sim · contrarian · monopoly innovation' },
  'shen-style': { name: 'Sector Catcher (Shen style)', style: 'Style sim · bets on sector leaders · data-driven' },
};
function pName(locale, slug, fallback) { return (locale === 'en' && PERSONA_I18N[slug]?.name) || fallback; }
function pStyle(locale, slug, fallback) { return (locale === 'en' && PERSONA_I18N[slug]?.style) || fallback; }

module.exports = { DICT, t, PERSONA_I18N, pName, pStyle };
