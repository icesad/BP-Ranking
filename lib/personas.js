// 12位虚拟投资人定义。weights: 各维度评分权重；sectors: 偏好赛道加成；
// risk: 风险偏好(0-1, 越高下注越激进)；voice: 点评语气模板用。
// type: 'llm' = LLM虚拟投资人, 'famous' = 知名投资人风格模拟智能体
// real: true 表示接真实API（DeepSeek）

const PERSONAS = [
  {
    slug: 'claude-capital', name: 'Claude 资本', type: 'llm', emoji: '🟠',
    style: '严谨审慎 · 长期主义 · 重视风险披露',
    weights: { team: 0.25, market: 0.2, moat: 0.25, traction: 0.15, clarity: 0.15 },
    sectors: { ai: 8, saas: 6, healthcare: 5, education: 4 },
    risk: 0.45,
    voice: '审慎',
  },
  {
    slug: 'gpt-ventures', name: 'GPT 创投', type: 'llm', emoji: '🟢',
    style: '全能均衡 · 看重叙事与规模化潜力',
    weights: { team: 0.2, market: 0.3, moat: 0.15, traction: 0.2, clarity: 0.15 },
    sectors: { ai: 9, consumer: 5, saas: 5, web3: 3 },
    risk: 0.6,
    voice: '均衡',
  },
  {
    slug: 'gemini-fund', name: 'Gemini 基金', type: 'llm', emoji: '🔵',
    style: '技术驱动 · 偏好多模态与硬科技',
    weights: { team: 0.2, market: 0.2, moat: 0.3, traction: 0.1, clarity: 0.2 },
    sectors: { ai: 9, hardware: 7, robotics: 8, energy: 5 },
    risk: 0.55,
    voice: '技术',
  },
  {
    slug: 'deepseek-capital', name: 'DeepSeek 资本', type: 'llm', emoji: '🐋', real: true,
    style: '真实LLM在线分析 · 极致性价比 · 工程效率信仰',
    weights: { team: 0.2, market: 0.2, moat: 0.25, traction: 0.2, clarity: 0.15 },
    sectors: { ai: 9, saas: 6, hardware: 6, fintech: 4 },
    risk: 0.65,
    voice: '工程',
  },
  {
    slug: 'kimi-fund', name: 'Kimi 长思基金', type: 'llm', emoji: '🌙',
    style: '长文本深读 · 喜欢信息密度高的BP',
    weights: { team: 0.15, market: 0.25, moat: 0.2, traction: 0.15, clarity: 0.25 },
    sectors: { ai: 8, consumer: 6, education: 6, content: 7 },
    risk: 0.5,
    voice: '细读',
  },
  {
    slug: 'grok-frontier', name: 'Grok 前沿', type: 'llm', emoji: '⚡',
    style: '激进逆向 · 热爱疯狂的想法',
    weights: { team: 0.25, market: 0.15, moat: 0.15, traction: 0.1, clarity: 0.1, bold: 0.25 },
    sectors: { space: 9, robotics: 8, web3: 6, energy: 7, ai: 7 },
    risk: 0.85,
    voice: '激进',
  },
  {
    slug: 'buffett-style', name: '价值之锚（巴菲特风格）', type: 'famous', emoji: '🎩',
    style: '风格模拟 · 护城河至上 · 看得懂才投',
    weights: { team: 0.2, market: 0.1, moat: 0.4, traction: 0.25, clarity: 0.05 },
    sectors: { consumer: 8, fintech: 5, saas: 4, healthcare: 4 },
    risk: 0.3,
    voice: '价值',
  },
  {
    slug: 'son-style', name: '愿景猎手（孙正义风格）', type: 'famous', emoji: '🌋',
    style: '风格模拟 · 信息革命 · 要么颠覆要么离场',
    weights: { team: 0.2, market: 0.4, moat: 0.1, traction: 0.1, clarity: 0.05, bold: 0.15 },
    sectors: { ai: 9, robotics: 8, fintech: 6, space: 7, consumer: 5 },
    risk: 0.9,
    voice: '愿景',
  },
  {
    slug: 'xu-style', name: '天使摆渡人（徐小平风格）', type: 'famous', emoji: '🚣',
    style: '风格模拟 · 早期乐观派 · 看用户热爱与真实需求（团队背景无法核实，一律不纳入考量）',
    weights: { market: 0.3, moat: 0.1, traction: 0.4, clarity: 0.2 },
    sectors: { consumer: 6, education: 7, content: 6, ai: 5 },
    risk: 0.7,
    voice: '投人',
  },
  {
    slug: 'duan-style', name: '本分常识（段永平风格）', type: 'famous', emoji: '🍵',
    style: '风格模拟 · 商业模式常识 · 慢即是快',
    weights: { team: 0.25, market: 0.1, moat: 0.35, traction: 0.25, clarity: 0.05 },
    sectors: { consumer: 8, hardware: 6, saas: 4 },
    risk: 0.25,
    voice: '常识',
  },
  {
    slug: 'thiel-style', name: '从0到1（彼得·蒂尔风格）', type: 'famous', emoji: '♟️',
    style: '风格模拟 · 反共识 · 垄断性创新',
    weights: { team: 0.2, market: 0.15, moat: 0.3, traction: 0.05, clarity: 0.1, bold: 0.2 },
    sectors: { ai: 7, space: 8, fintech: 7, web3: 5, healthcare: 5 },
    risk: 0.75,
    voice: '反共识',
  },
  {
    slug: 'shen-style', name: '赛道捕手（沈南鹏风格）', type: 'famous', emoji: '🦌',
    style: '风格模拟 · 重仓赛道头部 · 数据驱动',
    weights: { team: 0.2, market: 0.3, moat: 0.15, traction: 0.3, clarity: 0.05 },
    sectors: { consumer: 7, ai: 7, healthcare: 6, saas: 6, fintech: 5 },
    risk: 0.55,
    voice: '数据',
  },
];

const INITIAL_FUND = 100_000_000; // 1亿虚拟资金

module.exports = { PERSONAS, INITIAL_FUND };
