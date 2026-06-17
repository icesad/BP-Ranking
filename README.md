# Demo-Ranking

> AI 时代，你的 Demo 到底值多少？上 Demo-Ranking，12 位 AI 投资人联网搜索 + 深度推理给出带证据来源的估值——诚实到连自己都只敢打几万块。BP 是"说"，Demo 是"做"。

双赛道竞技场：12 位虚拟投资人（6 个 LLM 投资人 + 6 个知名投资人风格模拟智能体），**BP 与 Demo 两个赛道各持 1 亿虚拟资金，独立核算**。

- **BP 赛道**：上传商业计划书（.pptx），投资人阅读后注资、撤资、调仓，形成排行榜
- **Demo 赛道（晋级赛）**：提交刚 vibecoding 完的产品 Demo，投资人按完成度/交互性/创意/技术/实用价值五维评分注资；单文件 HTML Demo 直接托管，**详情页内嵌试玩**

## 快速开始

需要 Node.js 18+（推荐 20/22 LTS）。

```bash
npm install
npm run dev        # 开发模式，访问 http://localhost:3000
```

首次启动自动创建 SQLite 数据库并播种：12 位投资人 + 8 份示例BP + 历史持仓记录。

```bash
npm run build && npm start   # 生产模式
npm run seed                 # 重置数据库（清空所有上传与持仓，重新播种）
```

## 接入真实 DeepSeek

复制 `.env.local.example` 为 `.env.local`，填入 `DEEPSEEK_API_KEY`。之后"DeepSeek 资本"对每份新上传BP的评估将真实调用 DeepSeek API（OpenAI 兼容接口），其评估报告会标注"真实LLM分析"。不填密钥或调用失败时自动降级为本地模拟。

## 功能

- **BP榜**（`/`）与 **Demo榜**（`/demos`）：两个独立榜单，按各自赛道虚拟注资总额排名；"仅AI可见"的项目匿名参战
- **上传BP**（`/upload`）：标题+简介+.pptx（服务端逐页提取文本），可见权限二选一（所有人可见 / 仅AI可见）
- **提交Demo**（`/upload-demo`）：三种方式——上传单文件HTML（托管+在线试玩）/ 在线URL（抓取页面+测响应速度）/ GitHub仓库（读README）
- **详情页**（`/bp/[id]`）：12位投资人的评分、虚拟估值、优势/亮点、短板/改进建议、护城河/技术点评；Demo详情页含内嵌试玩区
- **投资人列表**（`/investors`）与**个人页**（`/investors/[slug]`）：双赛道持仓资金轨迹图（双曲线）、持仓分布、每笔调仓记录及判断理由
- **全局调仓**（`GET /api/tick`）：触发所有投资人分赛道重审组合（可配合定时任务模拟"持续盯盘"）

## 投资人引擎

- 每位投资人有独立人格：维度权重（团队/市场/护城河/业务数据/清晰度/颠覆性）、赛道偏好、风险系数、点评语气，定义在 `lib/personas.js`
- 评分 → 目标仓位；资金不足时自动从低分持仓撤资腾挪，每笔交易附带理由
- 同一投资人对同一BP评分稳定（稳定伪随机扰动）

## 目录结构

```
app/            页面与API（Next.js App Router）
components/     导航、持仓轨迹图（recharts）
lib/            personas 人格 / engine 评分 / portfolio 调仓 / db / pptx解析 / deepseek适配器 / seed
data/           SQLite 数据库与上传文件（自动创建，已 gitignore）
scripts/        seed 重置脚本
```

## 免责声明

所有资金均为虚拟资金；"知名投资人"均为基于公开风格的模拟智能体，不代表本人观点；所有评估内容不构成投资建议。
