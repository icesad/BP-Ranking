// DeepSeek 真实LLM适配器（OpenAI兼容接口）。无密钥或调用失败时返回 null，由引擎降级为模拟。
// 12 位投资人共用 DeepSeek 模型，但各自带人格 prompt，形成不同视角的独立评分。

// 通用反作弊评分准则：只奖励可验证的实质，惩罚辞藻堆砌，且完全忽略团队背景。
const BP_RUBRIC = `评分准则（务必严格遵守）：
1. 主轴是"洞察与推理质量"，不是"有没有数字"：评估问题是否真实清晰、解法是否成立、是否有非共识却站得住脚的洞察、计划是否现实、对风险是否诚实、逻辑是否自洽。
2. 按"项目阶段"用合理预期评估：
   · 想法/Pre-MVP 阶段：不要因为缺少营收/用户数据而扣分。重点看洞察、对问题与用户的理解、解决方案的合理性，以及"最关键的未验证假设 + 打算如何用这笔钱去验证"。讲清假设与验证计划、诚实承认未知，应当加分。
   · 已有 MVP/营收 阶段：才考察其数据与单位经济是否合理、可信。
3. 对无法验证的"已实现"大数字保持审慎：不要仅因为出现漂亮数字就给高分；编造或夸大的数据不应获得优势。真正加分的是论证是否扎实、是否诚实、洞察是否独到。
4. 名实校验：若项目自报为"想法/Pre-MVP"阶段，却声称已实现大量营收/用户/增长，视为名实不符或夸大，需降低可信度与评分。
5. 严禁因流行词加分。对"颠覆/革命/十倍/改变世界/遥遥领先/独角兽"等无支撑的口号要明显减分；通篇空话则压到 30 分以下。
6. 团队/创始人背景一律忽略：无法背景调查，任何名人/大厂/连续创业之类自述都不得作为加减分依据。`;

const DEMO_RUBRIC = `评分准则：基于产品本身（功能完成度、交互、创意、技术、实用价值）评估，看"做出了什么"而非"说了什么"，忽略任何团队背景自述。对无实质功能的炫词减分。`;

function personaIntro(persona) {
  if (!persona) return '你是一位持有1亿元虚拟资金的风险投资人。';
  const prefs = Object.keys(persona.sectors || {}).join('、');
  return `你是"${persona.name}"，一位持有1亿元虚拟资金的${persona.type === 'famous' ? '（风格模拟）' : ''}风险投资人。
你的投资风格：${persona.style}。${prefs ? `相对偏好的赛道：${prefs}（仅是口味，不能替代对实质的判断）。` : ''}
请用符合你风格的视角评估，但评分必须遵守下述统一准则，不得因风格而违背。`;
}

async function deepseekEvaluate(bp, persona) {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) return null;
  const model = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

  const isDemo = bp.kind === 'demo';
  const STAGE_LABELS = { idea: '想法/Pre-MVP', mvp: '已有MVP', revenue: '有营收/增长' };
  const stageLabel = STAGE_LABELS[bp.stage] || '未指定（请从内容自行推断）';
  const head = personaIntro(persona);
  const fmt = `严格只输出JSON（不要任何其他文字）。所有文本字段同时给出中文（顶层）和地道英文（放在 en 对象，不要直译腔）。格式：
{"score": 0-100的数字, "valuation": "估值区间", "strengths": "最大亮点一句话", "weaknesses": "最需改进的一句话", "moat": "${isDemo ? '技术实现点评' : '护城河分析'}一句话", "comment": "以你的口吻写的80字内点评，说明是否注资及原因", "question": "你最想让创始人回答的一个尖锐具体问题（30字内）", "en": {"valuation": "EN", "strengths": "EN", "weaknesses": "EN", "moat": "EN", "comment": "EN", "question": "EN"}}`;

  const body = isDemo
    ? `${head}
以下是一个刚开发完成的产品Demo（${bp.demo_type === 'html' ? '附源代码节选' : bp.demo_type === 'github' ? '附README节选' : '附页面内容节选'}）。
${DEMO_RUBRIC}
${fmt}

Demo名称：${bp.title}
简介：${bp.summary}
代码/内容节选：${(bp.content || '').slice(0, 3000)}`
    : `${head}
请评估以下商业计划书。
${BP_RUBRIC}
${fmt}

项目自报阶段：${stageLabel}（请按该阶段的合理预期评估）
商业计划书标题：${bp.title}
摘要：${bp.summary}
正文（节选）：${(bp.content || '').slice(0, 3000)}`;

  try {
    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: body }],
        temperature: 0.6,
        max_tokens: 600,
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const j = JSON.parse(match[0]);
    if (typeof j.score !== 'number') return null;
    return {
      score: Math.max(1, Math.min(99, j.score)),
      valuation: String(j.valuation || ''),
      strengths: String(j.strengths || ''),
      weaknesses: String(j.weaknesses || ''),
      moat: String(j.moat || ''),
      comment: String(j.comment || ''),
      question: String(j.question || ''),
      en: j.en && typeof j.en === 'object' ? {
        valuation: String(j.en.valuation || ''),
        strengths: String(j.en.strengths || ''),
        weaknesses: String(j.en.weaknesses || ''),
        moat: String(j.en.moat || ''),
        comment: String(j.en.comment || ''),
        question: String(j.en.question || ''),
      } : null,
      source: 'deepseek',
    };
  } catch {
    return null;
  }
}

// 单次分类调用：返回 {subsector, biz_model, customer, tags}；无 key/失败返回 null。
async function deepseekClassify(bp) {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) return null;
  const model = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
  const prompt = `给下面的项目做分类并设计一个封面，严格只输出JSON（不要其他文字）：
{"subsector":"所属细分赛道，简短中文，如'AI医疗影像'/'跨境电商SaaS'/'储能系统'", "biz_model":"从[saas,transaction,hardware,marketplace,ads,license,other]里选一个", "customer":"从[enterprise,gov,developer,consumer,smb,other]里选一个", "archetype":"从[website,game,tool,saas,ai_agent,ecommerce,community,other]里选一个最贴切的产品原型", "tags":["3-5个关键标签，简短"], "cover":{"emoji":"一个最能代表该项目的emoji","kw":"4字以内的封面关键词","palette":"从[blue,purple,teal,green,gold,red,slate,pink]里选一个最契合主题的配色"}}

标题：${bp.title}
简介：${bp.summary}
内容节选：${(bp.content || '').slice(0, 1500)}`;
  try {
    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], temperature: 0.2, max_tokens: 300 }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const m = (data.choices?.[0]?.message?.content || '').match(/\{[\s\S]*\}/);
    if (!m) return null;
    return JSON.parse(m[0]);
  } catch {
    return null;
  }
}

// 用 deepseek-reasoner 给项目估值：基于联网证据 + 深度推理 + 投资人风格。
// evidence: [{title,snippet,url}]（Tavily 结果，可空）。无 key 返回 null。
async function valuateDemo(bp, persona, evidence = [], comparables = [], floor = 0) {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) return null;
  const model = process.env.DEEPSEEK_VALUATION_MODEL || 'deepseek-reasoner'; // 深度推理出最佳估值；失败会自动回退 deepseek-chat
  const isDemo = bp.kind === 'demo';
  const ev = (evidence || []).slice(0, 6).map((e, i) => `[${i + 1}] ${e.title} — ${e.snippet} (${e.url})`).join('\n');
  const comps = (comparables || []).slice(0, 6).map((c, i) => `[可比${i + 1}] ${c.name}（${c.language || '—'}）⭐${c.stars} · fork ${c.forks} · ${c.archived ? '已停更' : '活跃'}${c.pushed_at ? ` · 最近提交 ${c.pushed_at}` : ''}${c.homepage ? ' · 有产品主页' : ''}${c.funding ? ` · 💰真实：${c.funding}` : ''}`).join('\n');
  const head = persona
    ? `你是"${persona.name}"，一位持有1亿元虚拟资金的${persona.type === 'famous' ? '（风格模拟）' : ''}风险投资人。风格：${persona.style}。`
    : '你是一位风险投资人。';

  const prompt = `${head}
请给下面这个${isDemo ? '产品 Demo' : '商业计划书'}做一个**虚拟估值**（人民币元），用你的风格与认知，并尽量引用下方"联网证据"作为依据。
${ev ? `联网证据（可引用其 url）：\n${ev}\n` : '（本次没有联网证据，请基于你的认知谨慎估值，并在 evidence 里说明依据来源类型。）\n'}
${comps ? `站内真实可比项目（同赛道，GitHub 客观数据，作为相对锚点；它们多为开源热度信号而非直接估值，请据此判断本项目的相对规模/成熟度，不要凭空臆造不可比的对象）：\n${comps}\n其中标注「💰真实」的是可核实的融资/收购金额，是比 star 更硬的估值锚——若同赛道可比项目有真实融资额，请优先据此判断本项目的合理量级。\n请在估值依据(evidence)中至少有一条说明"相对这些可比项目，本项目处于什么位置"。\n` : ''}
${floor > 0 ? `⚠️ 本项目自身已有可核实的公开融资/收购，约合人民币 ¥${Math.round(floor).toLocaleString()}（真金白银）。这是硬下限——你的估值区间下限不应明显低于此量级。\n` : ''}估值要求：给出区间（low/high，单位元）、估值方法、关键驱动因素、支撑证据（每条尽量带 url）、置信度(0-100)、一句话估值逻辑。
重要原则（务必遵守）：
- 对**无收入、无用户、无独占技术**的单个 Demo/项目，估值要以它**自身**的可变现价值为准：开发/复刻成本、模板或代码资产价值、极小的分发潜力。绝不能用"赛道很热/市场很大"或平台级头部公司（如 Cursor、Lovable 等数十亿美元估值）来抬高一个单文件小项目——那些是平台公司，不可直接类比。
- 对经典游戏/常见工具的克隆，要扣减其缺乏 IP、差异化与护城河的事实，估值通常只在很小的数额区间（如几百到几千元，至多数万元）。
- 早期/无收入项目谨慎估值，不要因华丽辞藻抬高，团队背景不计入。宁可保守，也不要明显高估。
严格只输出JSON（不要其他文字），所有文本字段同时给中文与英文(en)：
{"low": 数字, "high": 数字, "method": "估值方法", "drivers": ["驱动1","驱动2"], "evidence": [{"point":"依据","url":"链接或空"}], "confidence": 0-100, "reasoning": "一句话逻辑", "en": {"method":"EN","drivers":["EN"],"evidence":[{"point":"EN","url":""}],"reasoning":"EN"}}

${isDemo ? 'Demo' : 'BP'}名称：${bp.title}
简介：${bp.summary}
${isDemo ? '代码/内容' : '正文'}节选：${(bp.content || '').slice(0, 2500)}`;

  const cleanEv = (arr) => (Array.isArray(arr) ? arr : []).slice(0, 5).map((e) => ({ point: String(e?.point || '').slice(0, 200), url: String(e?.url || '').slice(0, 300) }));
  async function callModel(m, timeout, attempt = 0) {
    try {
      const res = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({ model: m, messages: [{ role: 'user', content: prompt }], max_tokens: 2000 }),
        signal: AbortSignal.timeout(timeout),
      });
      if (!res.ok) {
        if ((res.status === 429 || res.status >= 500) && attempt < 2) {
          await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
          return callModel(m, timeout, attempt + 1);
        }
        return null;
      }
      const data = await res.json();
      const text = data.choices?.[0]?.message?.content || '';
      const mm = text.match(/\{[\s\S]*\}/);
      if (!mm) return null;
      const j = JSON.parse(mm[0]);
      const low = Number(j.low) || 0;
      const high = Number(j.high) || 0;
      if (low <= 0 && high <= 0) return null;
      return {
        low, high, source: m,
        method: String(j.method || '').slice(0, 60),
        drivers: (Array.isArray(j.drivers) ? j.drivers : []).slice(0, 5).map((x) => String(x).slice(0, 60)),
        evidence: cleanEv(j.evidence),
        confidence: Math.max(0, Math.min(100, Number(j.confidence) || 0)),
        reasoning: String(j.reasoning || '').slice(0, 300),
        en: j.en && typeof j.en === 'object' ? {
          method: String(j.en.method || '').slice(0, 60),
          drivers: (Array.isArray(j.en.drivers) ? j.en.drivers : []).slice(0, 5).map((x) => String(x).slice(0, 60)),
          evidence: cleanEv(j.en.evidence),
          reasoning: String(j.en.reasoning || '').slice(0, 300),
        } : null,
      };
    } catch (e) {
      // 网络抖动（ECONNRESET/超时）重试
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
        return callModel(m, timeout, attempt + 1);
      }
      console.warn(`[valuation] ${m} 调用失败:`, e?.cause?.code || e?.name || e?.message || e);
      return null;
    }
  }
  // 先用推理模型；失败/超时则回退到对话模型，提高成功率
  return (await callModel(model, 120000)) || (model !== 'deepseek-chat' ? await callModel('deepseek-chat', 40000) : null);
}

// 估值杠杆：一次便宜的 deepseek-chat 调用，给出"抬高(up)/拖低(down)估值"的关键动作（双语）。无 key 返回 null。
async function valuationLevers(bp, summary, evidence = []) {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) return null;
  const ev = (evidence || []).slice(0, 4).map((e, i) => `[${i + 1}] ${e.title} — ${e.snippet}`).join('\n');
  const prompt = `你是一位 VC 估值分析师。下面是一个${bp.kind === 'demo' ? '产品 Demo' : '项目'}的综合估值结果。请给出最多 3 条"关键杠杆"——哪些动作或事实会显著**抬高(up)**或**拉低(down)**它的估值。每条要具体、可执行或可观察，聚焦项目自身能改变的因素（真实用户、付费/收入、留存、自有数据或 IP、差异化、可复制性、合规壁垒等），不要空泛。给出粗略影响幅度（倍数或人民币区间）。
严格只输出JSON（不要其他文字），文本同时给中英：
{"levers":[{"label":"中文，<24字","dir":"up或down","impact":"影响幅度，<14字，如 ‘+3~10倍’ / ‘上压约50%’","en":{"label":"EN","impact":"EN"}}]}

项目：${bp.title}
简介：${bp.summary}
当前综合估值：¥${summary.low} – ¥${summary.high}（${summary.n} 家，平均置信度 ${summary.confidence}%）
${ev ? `联网证据：\n${ev}` : ''}`;
  try {
    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: 'deepseek-chat', messages: [{ role: 'user', content: prompt }], temperature: 0.4, max_tokens: 500 }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const m = (data.choices?.[0]?.message?.content || '').match(/\{[\s\S]*\}/);
    if (!m) return null;
    const j = JSON.parse(m[0]);
    const levers = (Array.isArray(j.levers) ? j.levers : []).slice(0, 3).map((x) => ({
      label: String(x?.label || '').slice(0, 40),
      dir: x?.dir === 'down' ? 'down' : 'up',
      impact: String(x?.impact || '').slice(0, 30),
      en: x?.en && typeof x.en === 'object'
        ? { label: String(x.en.label || '').slice(0, 90), impact: String(x.en.impact || '').slice(0, 40) }
        : null,
    })).filter((x) => x.label);
    return levers.length ? { levers } : null;
  } catch {
    return null;
  }
}

// 从联网搜索结果中抽取某项目"可核实的融资/收购"信息（严格防编造）。无 key / 无证据 / 无确凿来源返回 null。
async function extractFunding(name, description, evidence = []) {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) return null;
  const ev = (evidence || []).slice(0, 8).map((e, i) => `[${i + 1}] ${e.title} — ${e.snippet} (${e.url})`).join('\n');
  if (!ev) return null;
  const prompt = `下面是关于某项目的联网搜索结果。判断其中是否包含**这个具体项目**的、可核实的"融资或被收购"事件。
严格要求：
- 只有当证据明确指向"${name}"这个项目本身时才算数；同名/相似名的其它公司不算。
- 必须能从下方结果里找到对应来源 url；找不到确切来源就当作没有。
- 绝不允许猜测或编造。没有确凿信息时输出 {"found": false}。
只输出JSON：{"found": true或false, "type": "raised或acquired", "amount_usd": 数字或null, "round": "如 Seed/Series A，可空", "date": "YYYY-MM 或空", "summary": "一句话中文摘要", "url": "来源链接(必须来自上面结果)"}

项目名：${name}
项目简介：${description || ''}
联网搜索结果：
${ev}`;
  try {
    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: 'deepseek-chat', messages: [{ role: 'user', content: prompt }], temperature: 0.1, max_tokens: 400 }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const m = (data.choices?.[0]?.message?.content || '').match(/\{[\s\S]*\}/);
    if (!m) return null;
    const j = JSON.parse(m[0]);
    if (!j.found || !j.url) return null;
    return {
      type: j.type === 'acquired' ? 'acquired' : 'raised',
      amount_usd: Number(j.amount_usd) || null,
      round: String(j.round || '').slice(0, 40),
      date: /^\d{4}(-\d{2})?/.test(String(j.date || '')) ? String(j.date).slice(0, 10) : '',
      summary: String(j.summary || '').slice(0, 200),
      url: String(j.url).slice(0, 400),
    };
  } catch {
    return null;
  }
}

// 六维评分卡：一次便宜的 deepseek-chat 调用，按原型重点信号给六维打分（0-100），每维带证据与 known 标记。
// 缺数据/无证据 → 保守低分且 known:false（绝不假设乐观值）。无 key 返回 null。
// signals: 站内第一方可观测信号快照（最可信，优先据此判断 validation/commercial），可空。
async function scoreRubric(bp, archetype = 'other', evidence = [], comparables = [], floor = 0, signals = null) {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) return null;
  const { ARCHETYPE_FOCUS } = require('./engine');
  const focus = ARCHETYPE_FOCUS[archetype] || ARCHETYPE_FOCUS.other;
  const ev = (evidence || []).slice(0, 5).map((e, i) => `[${i + 1}] ${e.title} — ${e.snippet} (${e.url})`).join('\n');
  const comps = (comparables || []).slice(0, 5).map((c, i) => `[可比${i + 1}] ${c.name} ⭐${c.stars}${c.funding ? ` · 💰${c.funding}` : ''}`).join('\n');
  const sig = signals && Object.keys(signals).length
    ? `站内第一方可观测信号（最可信，validation/commercial 优先据此判断）：${JSON.stringify(signals)}`
    : '（暂无站内第一方可观测信号——validation/commercial 缺真实使用数据时请从保守，并标 known:false）';
  const prompt = `你是一位严格、诚实的早期项目评审。请给下面这个【${archetype}】类${bp.kind === 'demo' ? '产品 Demo' : '项目'}做**六维评分卡**（每维 0-100 整数）。
该类型重点看：${focus}。
评分铁律（务必遵守）：
- 缺数据或无证据的维度，给**保守低分**并标 known:false；绝不假设乐观值。
- **团队背景不计分**；不要用平台级巨头（Cursor / Lovable 等数十亿美元公司）类比来抬分。
- validation / commercial **优先采用"站内第一方信号"与"可核实证据"**；自报且无来源的不予采信。
- 经典游戏/常见工具的克隆要扣减（缺 IP、差异化、护城河）。
六维含义：completeness完成度 / validation真实验证(真实用户·留存·使用) / commercial商业化(变现路径与证据) / maintainability可维护可扩展(技术债的反面) / market市场空间 / moat差异化壁垒。
${sig}
${ev ? `联网证据：\n${ev}\n` : ''}${comps ? `同赛道可比：\n${comps}\n` : ''}${floor > 0 ? `已知可核实硬下限约 ¥${Math.round(floor).toLocaleString()}。\n` : ''}
严格只输出 JSON（不要其他文字），evidence 一句话依据，known 为布尔：
{"dims":{"completeness":{"score":0,"evidence":"","known":false},"validation":{"score":0,"evidence":"","known":false},"commercial":{"score":0,"evidence":"","known":false},"maintainability":{"score":0,"evidence":"","known":false},"market":{"score":0,"evidence":"","known":false},"moat":{"score":0,"evidence":"","known":false}},"en":{"completeness":{"evidence":""},"validation":{"evidence":""},"commercial":{"evidence":""},"maintainability":{"evidence":""},"market":{"evidence":""},"moat":{"evidence":""}}}

名称：${bp.title}
简介：${bp.summary}
${bp.kind === 'demo' ? '代码/内容' : '正文'}节选：${(bp.content || '').slice(0, 2000)}`;
  try {
    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: process.env.DEEPSEEK_MODEL || 'deepseek-chat', messages: [{ role: 'user', content: prompt }], temperature: 0.2, max_tokens: 1600 }),
      signal: AbortSignal.timeout(45000),
    });
    if (!res.ok) { console.warn(`[rubric] HTTP ${res.status}`); return null; }
    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content || '';
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) { console.warn('[rubric] 未匹配到 JSON，原始片段：', raw.slice(0, 120)); return null; }
    let j;
    try { j = JSON.parse(m[0]); } catch (e) { console.warn('[rubric] JSON 解析失败（可能被截断），长度', m[0].length); return null; }
    const DIMS = ['completeness', 'validation', 'commercial', 'maintainability', 'market', 'moat'];
    const dims = {};
    for (const d of DIMS) {
      const x = j.dims?.[d] || {};
      dims[d] = {
        score: Math.max(0, Math.min(100, Math.round(Number(x.score) || 0))),
        evidence: String(x.evidence || '').slice(0, 160),
        known: !!x.known,
      };
    }
    const en = {};
    for (const d of DIMS) en[d] = { evidence: String(j.en?.[d]?.evidence || '').slice(0, 160) };
    return { dims, en };
  } catch (e) {
    console.warn('[rubric] 调用异常：', e?.cause?.code || e?.name || e?.message || e);
    return null;
  }
}

// 改进建议引擎（与评分卡同源）：依据六维评分卡的弱项 + 可比库"强竞品"信号，产出 4-6 条可执行建议，
// 每条挂到它主要抬升的评分卡维度上，并给出**有界**的预期估值影响(相对比例)。无 key 返回 null。
async function improvementPlan(bp, rubric = null, archetype = 'other', comparables = [], summary = null) {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) return null;
  const { ARCHETYPE_FOCUS } = require('./engine');
  const focus = ARCHETYPE_FOCUS[archetype] || ARCHETYPE_FOCUS.other;
  // 把评分卡六维（弱项优先）摘出来给模型
  const dimsTxt = rubric
    ? Object.entries(rubric).map(([k, v]) => `${k}: ${v.score}${v.known ? '' : '(数据不足)'} — ${v.evidence || ''}`).join('\n')
    : '（暂无评分卡，请基于项目内容判断弱项）';
  const comps = (comparables || []).slice(0, 5).map((c, i) => `[可比${i + 1}] ${c.name} ⭐${c.stars}${c.funding ? ` · 💰${c.funding}` : ''}${c.homepage ? ' · 有产品主页' : ''}`).join('\n');
  const valTxt = summary && summary.low ? `当前综合估值：¥${summary.low}–¥${summary.high}（${summary.n || 0} 家）。` : '';
  const prompt = `你是一位务实、诚实的早期产品顾问。下面是一个【${archetype}】类${bp.kind === 'demo' ? '产品 Demo' : '项目'}的**六维评分卡**与同赛道可比项目。
你的任务**不是**泛泛给创业建议，而是：**针对评分卡里分数最低/标注"数据不足"的那几个维度**，给出能把它补上去的具体动作。只给 3-5 条，宁缺毋滥。
该类型重点看：${focus}。
每条建议**硬性要求**：
- **必须锚定一个具体弱项 rubric_dim**（从 [completeness, validation, commercial, maintainability, market, moat] 选一个，且应是上面分数较低或数据不足的维度）。不针对弱项的不要写。
- **每条只一个原子动作**，能独立做完、能单独验证。绝不把两件事塞进一条。
- title 动词开头描述这一个动作；detail 说清"具体怎么做"。
- **evidence_needed**：做完后"要拿出什么**可核实的证据**或达到什么**可量化指标**，才能证明这一维真的变强了"（如"30 天内 ≥50 个真实陌生用户完成核心流程，且次周留存≥20%，并能在后台看到"）。这是本条的核心，必须具体、可验证。
- **potential 定性潜力（低/中/高）**：这件事一旦被真实证据兑现，对估值的提升潜力。**不要给任何百分比或金额**。只有"真实付费/留存/独占数据/可核实融资"这类硬验证才配"高"；卫生类（性能、改 bug、小美化）一律"低"。
- effort 工作量（低/中/高）。
- evidence_url 可空（引用了某个可比项目/证据时填）。
- **禁止**：空泛口号或纯定位类（"聚焦XX""强化心智"）、游戏化/刷量增长（签到/积分/分享得币）、以及建议它"其实已经有"的东西。
- 当某可比项目明显更强时，用 avoid（避开正面竞争）或 differentiation（找差异化角度）。
- dim 从 [feature, differentiation, avoid, visual, ux, growth, coldstart, tech, moat] 选一个分类。
${valTxt}
评分卡六维（分数越低越该优先补）：
${dimsTxt}
${comps ? `同赛道可比：\n${comps}\n` : ''}
严格只输出 JSON（不要其他文字），文本同时给中英：
{"suggestions":[{"rubric_dim":"","dim":"","title":"中文<24字","detail":"中文怎么做","evidence_needed":"做完要拿出的可核实证据/指标","potential":"低|中|高","effort":"低|中|高","evidence_url":"","en":{"title":"EN","detail":"EN","evidence_needed":"EN"}}]}

名称：${bp.title}
简介：${bp.summary}
${bp.kind === 'demo' ? '代码/内容' : '正文'}节选：${(bp.content || '').slice(0, 1500)}`;
  const DIMS = ['feature', 'differentiation', 'avoid', 'visual', 'ux', 'growth', 'coldstart', 'tech', 'moat'];
  const RDIMS = ['completeness', 'validation', 'commercial', 'maintainability', 'market', 'moat'];
  const EFFORT = ['低', '中', '高'];
  try {
    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: process.env.DEEPSEEK_MODEL || 'deepseek-chat', messages: [{ role: 'user', content: prompt }], temperature: 0.4, max_tokens: 1200 }),
      signal: AbortSignal.timeout(40000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const m = (data.choices?.[0]?.message?.content || '').match(/\{[\s\S]*\}/);
    if (!m) return null;
    const j = JSON.parse(m[0]);
    const LEVEL = ['低', '中', '高'];
    const out = (Array.isArray(j.suggestions) ? j.suggestions : []).slice(0, 6).map((x) => ({
      dim: DIMS.includes(x?.dim) ? x.dim : 'feature',
      rubric_dim: RDIMS.includes(x?.rubric_dim) ? x.rubric_dim : 'completeness',
      title: String(x?.title || '').slice(0, 48),
      detail: String(x?.detail || '').slice(0, 300),
      evidence_needed: String(x?.evidence_needed || '').slice(0, 300),
      potential: LEVEL.includes(x?.potential) ? x.potential : '中',
      effort: EFFORT.includes(x?.effort) ? x.effort : '中',
      evidence_url: String(x?.evidence_url || '').slice(0, 300),
      en: x?.en && typeof x.en === 'object'
        ? { title: String(x.en.title || '').slice(0, 90), detail: String(x.en.detail || '').slice(0, 360), evidence_needed: String(x.en.evidence_needed || '').slice(0, 360) }
        : null,
    })).filter((x) => x.title);
    return out.length ? out : null;
  } catch {
    return null;
  }
}

// 用户画像合成：据多个作品摘要(可验证) + 自报社媒公开信息(未核实) → 八维能力画像。无 key 返回 null。
async function synthesizeProfile(worksText, socialText, nWorks = 0) {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) return null;
  const prompt = `你是一位洞察敏锐但**诚实**的评审。请根据某用户的多个作品摘要（含各维评分卡，可验证）与其自报社媒的公开信息（**未核实**），提炼这个人的能力画像。
铁律：
- 主要依据**作品**（可验证）；社媒信息**未核实**，只能温和影响 aesthetic/influence 等维度，不能凭空拔高。
- 作品少（${nWorks} 个）时画像要**保守**，并在 summary 注明样本有限。
- 不编造具体事迹；summary 用观察性语气（"从作品看，TA 倾向…"）。
八维（0-100 整数）：tech技术力 / product产品·痛点敏感 / business商业洞见 / aesthetic审美 / vision视野·野心 / originality创意·原创 / execution落地·完成度 / influence影响力·受众。
严格只输出 JSON：{"dims":{"tech":0,"product":0,"business":0,"aesthetic":0,"vision":0,"originality":0,"execution":0,"influence":0},"themes":["题材偏好标签，3-6 个"],"summary":"一段中文小结(观察性)","social_summary":"社媒公开信息综述(注明未核实);无社媒则留空"}

作品摘要：
${worksText || '（暂无作品）'}

自报社媒公开信息（未核实）：
${socialText || '（用户未提供社媒）'}`;
  try {
    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: process.env.DEEPSEEK_MODEL || 'deepseek-chat', messages: [{ role: 'user', content: prompt }], temperature: 0.3, max_tokens: 1200 }),
      signal: AbortSignal.timeout(45000),
    });
    if (!res.ok) { console.warn('[profile] HTTP', res.status); return null; }
    const data = await res.json();
    const m = (data.choices?.[0]?.message?.content || '').match(/\{[\s\S]*\}/);
    if (!m) return null;
    const j = JSON.parse(m[0]);
    const AX = ['tech', 'product', 'business', 'aesthetic', 'vision', 'originality', 'execution', 'influence'];
    const dims = {};
    for (const a of AX) dims[a] = Math.max(0, Math.min(100, Math.round(Number(j.dims?.[a]) || 0)));
    const themes = (Array.isArray(j.themes) ? j.themes : []).map((x) => String(x).trim().slice(0, 16)).filter(Boolean).slice(0, 6);
    return { dims, themes, summary: String(j.summary || '').slice(0, 600), social_summary: String(j.social_summary || '').slice(0, 400) };
  } catch (e) { console.warn('[profile]', e?.message || e); return null; }
}

module.exports = { deepseekEvaluate, deepseekClassify, valuateDemo, valuationLevers, extractFunding, scoreRubric, improvementPlan, synthesizeProfile };
