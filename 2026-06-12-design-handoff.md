# Demo-Ranking 设计与交接文档（截至 2026-06-12）

> 写给下一个会话/模型的开发交接。当前状态：BP赛道 + Demo赛道 + 估值/可比库/校准闭环均已完成，可直接 `npm run dev` 运行。
> （前身为 BP-Ranking，显示品牌名已改为 Demo-Ranking；文件夹/工程名仍是 D:\BP-Ranking。）

## 产品概念

双赛道AI创业竞技场。12位虚拟投资人（6个LLM投资人 + 6个知名投资人风格模拟智能体），**BP赛道与Demo赛道各持1亿虚拟资金，两本账独立核算**。用户上传BP（.pptx）或提交Demo（HTML文件/URL/GitHub仓库），投资人评估后注资/撤资/调仓，形成两个独立排行榜。**当前主线已升级为「AI/vibecoding 时代的估值锚点」**：投资人联网搜索 + 深度推理给出带证据的估值，并随真实结果做校准。定位递进：BP是海选（"说"），Demo是晋级赛（"做"），Demo 为重心。

## 技术栈与架构

- Next.js 14.2.13（App Router，JS非TS）+ better-sqlite3 + recharts + jszip，纯CSS（无Tailwind）
- 数据库：SQLite（data/bp-ranking.db，首次启动自动建表+播种；data/ 已gitignore）
- 关键设计决策：**Demo复用bps表**（kind='bp'|'demo'），holdings/transactions/evaluations全部通用；资金池路由在 lib/portfolio.js 的 cashField(kind) —— cash=BP池，demo_cash=Demo池；撤资腾挪只在同赛道内进行
- 数据库迁移：lib/db.js 里 ALTER TABLE 数组 + try/catch，幂等，老库无损升级

## 文件地图（核心）

- lib/personas.js — 12个投资人人格（权重/赛道偏好/风险系数/语气voice），INITIAL_FUND=1亿
- lib/engine.js — 评分引擎 + valHash(内容指纹) + 赛道/阶段/商业模式标签 + L()双语映射
- lib/portfolio.js — processNewBp / reEvaluateBp / rebalanceAll（全局调仓，5%滞回，含 valuationTilts 估值倾斜）/ marketTick / applyTx
- lib/deepseek.js — LLM适配器：deepseekEvaluate(评分) / deepseekClassify(分类) / valuateDemo(估值) / valuationLevers(杠杆) / extractFunding(融资抽取，防编造)
- lib/valuation.js — valuateBp 估值编排（Tavily + reasoner + 综合 + disp/levers/compList/floor）
- lib/comparables.js — 可比库：upsertComparable / comparablesFor / comparableForBp
- lib/fx.js — 美元→人民币汇率（实时+缓存+回退）
- lib/tavily.js — Tavily 联网搜索；lib/demofetch.js — URL/GitHub 抓取；lib/screenshot.js — puppeteer 首屏截图（可选）
- lib/queries.js — leaderboard/bpDetail/bpValuations/bpValuationHistory/bpOutcomes/calibrationData/comparablesOverview 等
- app/ — page.js(→/demos重定向) demos/(默认落地·Demo榜) bp/(BP榜) bp/[id]/(详情) upload/ upload-demo/ resubmit/ calibration/ comparables/ investors/ api/(value, value-batch, outcome, fxrate, tick, resubmit, upload* 等)

## 安全与合规约定（勿破坏）

- Demo iframe 用 sandbox="allow-scripts allow-pointer-lock"（禁弹窗/跳转/同源）
- 知名投资人全部用"风格模拟"命名 + 全站免责声明；商业化前建议改为纯虚构人设（姓名权风险）
- ai_only 可见性：榜单匿名显示、详情页/preview接口404拦截
- 估值/校准的立身之本是**诚实**：评分/估值防刷词、团队不计分、敢给低分、承认误差、引用真实可比。任何"为了好看刷高分"的改动都会摧毁可信度（=唯一护城河）。

## 用户环境

- Windows，项目在 D:\BP-Ranking，PowerShell执行策略已修（RemoteSigned）
- 用户非专业开发者，命令要可直接复制，提醒先 cd D:\BP-Ranking
- 密钥已在 .env.local，建议用后轮换

---

# 主线功能（2026-06-12）

## 品牌与导航
- **显示品牌名 Demo-Ranking**（仅界面文案，勿改文件夹/路径）。
- **Demo 为重心**：`/` 重定向到 `/demos`（默认落地页，挂估值主打文案）；**BP 榜在 `/bp`**（app/bp/page.js）；导航顺序 Demo榜→BP榜；首页投资人展示墙已移除（仍在 `/investors`）。
- 首屏 slogan 估值主打 +"诚实到给自己打低分"卖点（lib/i18n.js 的 home.hero*）。

## 估值功能（核心）
- **管线**：valuateBp() —— 一次 Tavily 搜索（共享）→ 12 位投资人 `deepseek-reasoner` 并行估值（分批6，失败回退 deepseek-chat）→ trimmedMedian 综合区间 + 平均置信度。存 `valuations` 表 + bps.val_summary(JSON)。
- **成本控制**：valHash 内容指纹，内容未变且已有估值则跳过零花费；force 强制重算。约 ¥0.07/次，手动触发为主。
- **附加产出**（val_summary 内）：`disp`(分歧度)、`levers`(抬高/拖低估值的可执行杠杆)、`compList`(参考可比)、`floor`(真金白银硬下限)。
- **展示**：详情页估值卡片显示区间/置信度/分歧度/波动声明/杠杆/联网证据/可比项目/各家依据/历史趋势/🔒下限。
- **估值 → 持仓**：rebalanceAll 的 valuationTilts() —— 同赛道市价占比 vs 估值占比，低估加仓/高估减仓(0.6~1.7)。单次估值后、批量估值跑完都触发调仓。
- **批量估值**：`/api/value-batch` + BatchValuateButton（Demo榜，逐个顺序、进度/费用确认/停止，跑完调 /api/tick）。
- **重新参战自动估值**：ResubmitForm 勾选 → `/bp/[id]?revalue=1` → ValuationButton 自动触发一次。

## 可比项目库（估值锚点，不进排行榜）
- 表 `comparables`：GitHub 客观信号 + 融资字段(funding/funding_amount_usd/funding_url/funding_at/enriched_at)。
- lib/comparables.js：upsertComparable / comparablesFor(同赛道top by stars喂估值) / comparableForBp(按demo_url匹配)。
- 脚本：`import-comparables.js`(建库,$0)；`import-github.js`(导入竞争Demo时也写入可比库)。
- **半自动融资核查**：`enrich-comparables.js [n] [all]` —— Tavily搜索 + extractFunding(严格防编造，必须命中本项目且有来源url)。约几分钱/条。
- 可视化页 `/comparables`（按赛道分组，有融资标 💰 带来源）。

## 真实结果 + 估值校准（信任复利键石）
- 表 `outcomes`(bp_id/type[raised|acquired|revenue|users|shutdown|other]/amount(元)/note/source_url/occurred_at)。
- OutcomeReporter（详情页估值卡底部）：报告真实进展，**¥/$ 币种下拉 + 单位前缀 + 切换按汇率即时换算**（默认人民币，统一折成¥入库）；该项目在可比库有融资则自动带出并"用它预填"（美元先折人民币）。`/api/outcome/[id]` 落库。
- 汇率：lib/fx.js usdCnyRate()（实时+6h缓存，回退7.2或 USD_CNY_RATE）；`/api/fxrate`。
- **真金白银硬下限**：项目自身融资/收购(¥)或对应可比项公开融资($×汇率) → valuateBp 算 floor，写进prompt且综合后强制兜底；详情页 🔒。
- 校准页 `/calibration`：有货币结果且有估值的项目，预测区间 vs 真实金额，命中率/中位比。
- 榜单 💰 标记：leaderboard 带 money_outcomes，Demo/BP 榜对"有真金白银背书"(货币结果或 floor>0)的项目名后加 💰。

## 反作弊评分 / i18n
- 评分只认可可验证证据、不奖励堆词、**团队背景不计分**、分阶段(idea/mvp/revenue)、原创性查重乘子(防套壳)。
- 全站中英双语：cookie `lang`，服务端 cookies() / 客户端 useLocale()，字典 lib/i18n.js。
- 截图：lib/screenshot.js（puppeteer可选；国内装Chromium用 .puppeteerrc.cjs 指 npmmirror 镜像）。

## 环境变量（.env.local）
- 必需：`DEEPSEEK_API_KEY`、`TAVILY_API_KEY`。
- 可选：`GITHUB_TOKEN`、`USD_CNY_RATE`(汇率兜底)、`DEEPSEEK_VALUATION_MODEL`(默认 deepseek-reasoner)、`MARKET_TICK_MINUTES`(默认180，0关闭)。

## 常用脚本（在 D:\BP-Ranking 下）
- `node scripts/import-comparables.js "topic:ai stars:>800" 40` — 建可比库
- `node scripts/enrich-comparables.js 30` — 半自动核查融资（带来源落库）
- `node scripts/import-github.js "topic:ai stars:>800" 15` — 批量导入竞争 Demo（$0）

## 开发注意
- 改表结构（comparables 列、outcomes 表）需**重启 dev server** 让迁移生效；纯前端改动热更新刷新即可。
- better-sqlite3 仅 Windows 本机可跑；Linux 沙箱跑不了，且经 mount 读取大文件常被截断（语法报错多为假象，以 Read 工具/真实 dev server 为准）。

## 待续方向（按优先级）
1. 给可比库/项目接更多真实结果维度（ProductHunt / 营收 / 收购）。
2. 校准记录做成公开"可信度看板"（预测 vs 现实的准确率，信任复利）。
3. 用户回填结果的审核/防刷（目前匿名可填，靠来源链接抽查）。
4. 商业闭环：B端 deal flow（把高分/高估值项目对接真投资人）。
5. 部署（SQLite → 云数据库；Vercel/容器）。
