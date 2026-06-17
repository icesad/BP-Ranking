# BP-Ranking 设计与交接文档

> 写给下一个会话/模型的开发交接。当前状态：BP赛道 + Demo赛道均已完成并通过验证，可直接 `npm run dev` 运行。

## 产品概念

双赛道AI创业竞技场。12位虚拟投资人（6个LLM投资人 + 6个知名投资人风格模拟智能体），**BP赛道与Demo赛道各持1亿虚拟资金，两本账独立核算**。用户上传BP（.pptx）或提交Demo（HTML文件/URL/GitHub仓库），投资人评估后注资/撤资/调仓，形成两个独立排行榜。Slogan：「AI时代觉得自己的BP最牛？上BP-Ranking，一战高下」。定位递进：BP是海选（"说"），Demo是晋级赛（"做"）。

## 技术栈与架构

- Next.js 14.2.13（App Router，JS非TS）+ better-sqlite3 + recharts + jszip，纯CSS（无Tailwind）
- 数据库：SQLite（data/bp-ranking.db，首次启动自动建表+播种；data/ 已gitignore）
- 关键设计决策：**Demo复用bps表**（kind='bp'|'demo'），holdings/transactions/evaluations全部通用；资金池路由在 lib/portfolio.js 的 cashField(kind) —— cash=BP池，demo_cash=Demo池；撤资腾挪只在同赛道内进行
- 数据库迁移：lib/db.js 里 ALTER TABLE 数组 + try/catch，幂等，老库无损升级

## 文件地图

- lib/personas.js — 12个投资人人格（权重/赛道偏好/风险系数/语气voice），INITIAL_FUND=1亿
- lib/engine.js — 评分引擎。BP六维（team/market/moat/traction/clarity/bold关键词命中）；Demo五维（completeness/interactivity/creativity/tech/utility，从HTML代码特征提取）；DEMO_DIM_MAP把人格权重映射到Demo维度；seededRand保证同人对同项目评分稳定；targetAllocation: score<45不投，上限≈28%×risk
- lib/portfolio.js — processNewBp（新项目全员评估注资）、rebalanceAll（全局调仓，5%滞回）、applyTx（按kind路由资金池）
- lib/deepseek.js — 真实LLM适配器（OpenAI兼容），BP/Demo两套prompt，失败自动降级模拟；密钥在 .env.local（DEEPSEEK_API_KEY，已配置）
- lib/demofetch.js — URL抓取（含响应时间）/ GitHub README抓取
- lib/pptx.js — jszip解包提取 a:t 文本
- lib/seed.js — 8份示例BP带30天历史 + 2个可试玩示例Demo（贪吃蛇/番茄钟）
- lib/queries.js — leaderboard(kind)/bpDetail/investorsList/investorDetail（双赛道累计轨迹）
- app/ — page.js(BP榜) demos/(Demo榜) upload/ upload-demo/ bp/[id]/(详情+Demo内嵌试玩iframe) investors/ investors/[slug]/(双曲线轨迹图+调仓时间线) api/upload api/upload-demo api/demo/[id]/preview(托管HTML) api/tick(全局调仓)

## 安全与合规约定（勿破坏）

- Demo iframe 用 sandbox="allow-scripts allow-pointer-lock"（禁弹窗/跳转/同源）
- 知名投资人全部用"风格模拟"命名（价值之锚-巴菲特风格等）+ 全站免责声明；商业化前建议改为纯虚构人设（姓名权风险）
- ai_only 可见性：榜单匿名显示、详情页/preview接口404拦截

## 用户环境

- Windows，项目在 D:\BP-Ranking，PowerShell执行策略已修（RemoteSigned）
- 用户非专业开发者，命令要可直接复制，提醒先 cd D:\BP-Ranking
- DeepSeek密钥已在 .env.local，建议用后轮换

## 已验证

上传BP(.pptx解析)→12人评估→排行；提交HTML Demo→五维评测→上榜→iframe试玩；双账本精确平衡（每人每赛道持仓+现金=1亿）；ai_only隐藏；/api/tick；生产构建通过。

## 待做方向（按用户认可的优先级）

1. 关键验证指标：七日二次访问率 → 需要排名变动通知/重新参战机制让用户回流
2. /api/tick 接定时任务让榜单"活"起来（用户曾被提议过，未拍板）
3. Demo赛道升级：Playwright真实Agent试用+录屏（已讨论，成本高暂缓）
4. 部署上线（Vercel需改SQLite为云数据库，或建议用户先内网/本机演示）
5. 商业闭环：B端deal flow（把高分项目卖给真投资人）是认可的方向

---

# 更新日志 · 2026-06-12（估值锚点 / 可比库 / 校准闭环）

> 这一版的主线：把产品从"又一个 AI 评分器"推向**「AI/vibecoding 时代的估值锚点」**。核心信念：**护城河不是算法，而是随时间独家积累的真实结果数据 + 诚实带来的信任**。估值的可信度（敢于给自己/项目打低分、承认误差、引用真实可比）是立身之本，任何"为了好看把分刷高"的改动都会摧毁它。

## 品牌与导航变化
- **显示品牌名改为 Demo-Ranking**（仅界面文案，文件夹/工程名仍是 D:\BP-Ranking，勿改路径）。
- **Demo 为重心**：根路径 `/` 重定向到 `/demos`（默认落地页，挂估值主打文案）；**BP 榜搬到 `/bp`**（`app/bp/page.js`，原首页逻辑迁来）；导航顺序 Demo榜→BP榜；**首页投资人展示墙已移除**（投资人仍在 `/investors`）。
- 首屏 slogan 改为估值主打 + "诚实到给自己打低分"卖点（lib/i18n.js 的 home.hero*）。

## 估值功能（核心）
- **管线**：`lib/valuation.js` valuateBp() —— 一次 Tavily 联网搜索（全员共享）→ 12 位投资人用 `deepseek-reasoner` 并行估值（分批 6，失败回退 deepseek-chat）→ 去极值中位数(trimmedMedian)算综合区间 + 平均置信度。结果存 `valuations` 表 + bps.val_summary(JSON)。
- **成本控制**：内容指纹 `valHash(bp)`（engine.js），内容未变且已有估值则跳过、零 LLM 花费；force 可强制重算。约 ¥0.07/次。手动触发为主。
- **估值 JSON（valuateDemo in deepseek.js）**：low/high/method/drivers/evidence(带url)/confidence/reasoning + en 双语。
- **附加产出**（val_summary 内）：`disp`（各家分歧度 lo/hi/level）、`levers`（2-3 条抬高/拖低估值的可执行杠杆，由便宜的一次 chat 调用 valuationLevers 生成）、`compList`（参考的可比项目）、`floor`（真金白银硬下限）。
- **展示**：详情页估值卡片（`app/bp/[id]/page.js`）显示区间、置信度、分歧度、波动声明、杠杆、联网证据、可比项目、各家估值与依据、历史趋势(details)、🔒下限锚定。
- **估值 → 持仓**：rebalanceAll 里加了 `valuationTilts()`——同赛道内市价占比 vs 估值占比，低估加仓/高估减仓（系数 0.6~1.7）。单次估值(`/api/value/[id]`)成功后、批量估值跑完都会触发调仓。
- **批量估值**：`/api/value-batch`（GET 列待估、POST 估单个）+ `components/BatchValuateButton.js`（Demo 榜上，逐个顺序跑、带进度/费用确认/停止，跑完调 /api/tick 调仓）。
- **重新参战自动估值**：ResubmitForm 勾选"提交后立即重新估值" → 跳转 `/bp/[id]?revalue=1` → ValuationButton 自动触发一次。

## 可比项目库（估值锚点，不进排行榜）
- 表 `comparables`（lib/db.js）：GitHub 客观信号 + 融资字段（funding/funding_amount_usd/funding_url/funding_at/enriched_at）。
- `lib/comparables.js`：upsertComparable / comparablesFor(同赛道 top by stars，喂给估值当锚) / comparableForBp(按 demo_url 匹配项目对应的可比记录)。
- 脚本：`scripts/import-comparables.js "<gh查询>" <n>` 建库（纯客观信号，$0）；`scripts/import-github.js` 导入竞争 Demo 时也写入可比库。
- **半自动融资核查**：`scripts/enrich-comparables.js [n] [all]` —— 对每个可比项目 Tavily 搜索 + `extractFunding`(deepseek.js，**严格防编造**：必须命中"该项目本身"且有来源 url，否则留空)。约几分钱/条。
- 可视化页 `/comparables`（按赛道分组，有融资标 💰 带来源）。

## 真实结果 + 估值校准（信任复利的键石）
- 表 `outcomes`（bp_id/type[raised|acquired|revenue|users|shutdown|other]/amount(元)/note/source_url/occurred_at）。
- `components/OutcomeReporter.js`（详情页估值卡底部）：报告真实进展，**¥/$ 币种下拉 + 单位前缀 + 切换按汇率即时换算**（默认人民币，统一折成 ¥ 入库）；若该项目在可比库有融资，自动带出并支持"用它预填"（美元先折成人民币）。`/api/outcome/[id]` 落库。
- 汇率：`lib/fx.js` usdCnyRate()（免费接口实时 + 6h 缓存，失败回退 7.2 或环境变量 USD_CNY_RATE）；`/api/fxrate`。
- **真金白银硬下限**：项目自身已报告的融资/收购(¥)或其对应可比项的公开融资($×汇率) → valuateBp 计算 floor，写进每位投资人 prompt 且综合后强制兜底；详情页显示 🔒。
- 校准页 `/calibration`（queries.calibrationData）：有货币结果且有估值的项目，预测区间 vs 真实金额，命中率/中位比。
- 榜单 💰 标记：leaderboard 带 money_outcomes，Demo/BP 榜对"有真金白银背书"(有货币结果或 floor>0)的项目名后加 💰。

## 反作弊评分 / i18n（此前已做，补记）
- 评分只认可可验证证据、不奖励堆词、**团队背景不计分**、分阶段(idea/mvp/revenue)评估、原创性查重乘子（防套壳）。
- 全站中英双语：cookie `lang`，服务端 cookies() / 客户端 useLocale()，字典 lib/i18n.js。
- 截图：lib/screenshot.js（puppeteer，可选；国内装 Chromium 用 .puppeteerrc.cjs 指向 npmmirror 镜像）。

## 环境变量（.env.local）
- `DEEPSEEK_API_KEY`（必需）、`TAVILY_API_KEY`（估值联网，必需）。
- 可选：`GITHUB_TOKEN`（提高 GitHub 额度）、`USD_CNY_RATE`（汇率兜底，国内取不到实时汇率时）、`DEEPSEEK_VALUATION_MODEL`（默认 deepseek-reasoner）、`MARKET_TICK_MINUTES`（市场心跳，默认180，0关闭）。

## 常用脚本（在 D:\BP-Ranking 下）
- `node scripts/import-comparables.js "topic:ai stars:>800" 40` — 建可比库
- `node scripts/enrich-comparables.js 30` — 半自动核查融资（带来源落库）
- `node scripts/import-github.js "topic:ai stars:>800" 15` — 批量导入竞争 Demo（便宜通道 $0）

## 开发注意
- 改了表结构（comparables 列、outcomes 表）需**重启 dev server**让迁移生效；纯前端改动热更新刷新即可。
- better-sqlite3 仅在 Windows 本机可跑；Linux 沙箱跑不了，且经 mount 读取大文件常被截断（语法报错多为假象，以 Read 工具/真实 dev server 为准）。
- 待续方向：(1) 给可比库/项目接更多真实结果维度（ProductHunt/营收）；(2) 校准记录做成公开可信度看板；(3) 用户回填结果的审核/防刷；(4) 部署（SQLite→云库）。
