// 种子数据：12位投资人 + 8份示例BP + 过去一个月的持仓演变历史
const { PERSONAS, INITIAL_FUND } = require('./personas');
const { simEvaluation, scoreBp, withdrawReason, targetAllocation } = require('./engine');
const { applyTx, saveEvaluation } = require('./portfolio');

const DEMO_BPS = [
  {
    title: '灵犀智诊 · AI多模态基层医疗诊断助手', founder: '林一舟', sector: 'healthcare', visibility: 'public',
    summary: '面向县域基层医院的AI辅助诊断SaaS，融合影像、问诊语音与电子病历大模型分析，已覆盖37家医院，月活医生4200人。',
    content: '团队：创始人为三甲医院影像科前主任医师，CTO来自大厂医疗AI实验室，连续创业背景。市场规模：基层医疗信息化市场超千亿，AI辅诊渗透率不足5%，蓝海市场。护城河：积累28万例标注病例数据壁垒，已获两项专利。业务数据：ARR 1200万，月增长15%，续费率92%。商业模式：按床位订阅收费，定价清晰，获客通过省级卫健系统渠道。融资计划：A轮5000万，用于扩展至200家医院。',
  },
  {
    title: 'StarBridge · 低轨卫星物联网星座', founder: '陈曜', sector: 'space', visibility: 'public',
    summary: '为远洋渔业、矿业与应急通信提供低成本卫星物联网回传，首批6颗试验星已在轨，单星成本压至行业1/3。',
    content: '团队：创始人为前航天院所总体设计师，核心团队均有卫星型号经验。市场空间：全球卫星IoT市场百亿美元级，增长率34%。颠覆性：用消费级器件+批量化制造重新定义微小卫星成本结构，登月级野心。护城河：火箭搭载协议与频谱资源先发优势。业务数据：已签2.3亿意向订单，3家付费客户。融资计划：B轮3亿，发射36星组网。风险：发射排期与频谱协调存在不确定性。',
  },
  {
    title: '味觉实验室 · 功能性零食DTC品牌', founder: '苏蔓', sector: 'consumer', visibility: 'public',
    summary: '主打"益生菌+低GI"功能零食，全渠道月GMV 2800万，复购率41%，会员体系沉淀120万私域用户。',
    content: '团队：创始人为前头部新消费品牌增长负责人，供应链合伙人有20年代工厂经验。市场规模：功能性食品赛道两千亿，年增速20%。业务数据：月GMV 2800万，复购率41%，毛利率58%，已实现单月盈利。护城河：自建益生菌菌株库与专利配方，私域数据壁垒。商业模式：DTC+线下精品商超，获客成本持续下降。融资计划：A+轮8000万用于自建工厂。',
  },
  {
    title: 'CodePilot X · 企业级AI研发效能平台', founder: '何北辰', sector: 'ai', visibility: 'public',
    summary: '面向千人以上研发团队的私有化AI编程与代码评审平台，支持国产化部署，已签12家金融与央企客户。',
    content: '团队：创始人为前大厂基础架构总监，CTO为开源编译器项目核心维护者，名校背景。市场空间：企业研发效能工具市场500亿，AI代码助手渗透率快速提升。护城河：私有化部署与代码安全合规能力构成壁垒，金融行业准入资质独家优势。业务数据：ARR 3600万，净留存128%，订单均价300万。商业模式：订阅制+私有化实施费。融资计划：B轮1.5亿。',
  },
  {
    title: '青藤学径 · 乡村青少年科学教育公益商业体', founder: '阿依古丽', sector: 'education', visibility: 'public',
    summary: '“公益+商业”双轮模式：城市付费科学营收入反哺乡村学校科学教室，已建成86间教室，服务3.2万学生。',
    content: '团队：创始人为支教十年的科学教师，获多项社会创新奖，创始人故事打动人心。市场：素质教育市场千亿规模。商业模式：城市营地课程付费（客单价6800元）+企业ESG共建，盈利模式清晰。业务数据：年收入2400万，毛利率45%，乡村教室运营成本由商业收入全覆盖。短板：规模化依赖师资复制，护城河有限但品牌势能强。融资计划：千万级，用于课程数字化。',
  },
  {
    title: 'Helios 钙钛矿叠层电池中试线', founder: '赵铭远', sector: 'energy', visibility: 'public',
    summary: '钙钛矿/晶硅叠层电池效率实验室达33.2%，自建10MW中试线跑通良率72%，瞄准分布式光伏增量市场。',
    content: '团队：首席科学家为材料学界知名教授，产业化团队来自头部光伏厂。市场规模：光伏万亿市场，叠层技术是下一代确定性路线。护城河：12项核心专利，封装工艺独家技术积累。业务数据：中试线良率72%，已获两家组件厂联合开发协议。颠覆性：若量产良率达85%，度电成本下降30%，重新定义行业。风险：量产爬坡资金需求大。融资计划：Pre-B轮2亿。',
  },
  {
    title: 'EchoPod · AI播客双语内容引擎', founder: '江晚晴', sector: 'content', visibility: 'ai_only',
    summary: '一键将深度文章转为双语播客，创作者工具+内容分发双边网络，上线4个月生成12万期节目。',
    content: '团队：创始人为前播客平台内容总监。市场：音频内容市场快速增长，创作者经济百亿规模。业务数据：MAU 18万，付费率6%，月增长40%。商业模式：订阅+分发分成。护城河：双边网络效应初现，但模型能力依赖第三方，壁垒待验证。融资计划：天使+轮1500万。',
  },
  {
    title: '南海芯链 · 车规级碳化硅功率模块', founder: '欧阳澈', sector: 'hardware', visibility: 'public',
    summary: '车规SiC功率模块设计与封测，良率行业领先，已进入两家新势力车企二供名单，月产能5万套。',
    content: '团队：创始人为海归功率半导体博士，团队来自头部IDM大厂。市场规模：车规SiC百亿美元赛道，国产化率不足15%。护城河：银烧结封装专利+车规认证周期构成先发壁垒。业务数据：年营收8000万，毛利率32%，在手订单3.2亿。商业模式：Fabless+封测自建。融资计划：B轮2.5亿扩产能。',
  },
];

function ts(daysAgo, hour = 10) {
  const d = new Date(Date.now() - daysAgo * 86400000);
  d.setHours(hour, Math.floor(Math.random() * 50) + 5, 0, 0);
  return d.toISOString().replace('T', ' ').slice(0, 19);
}

function seed(db) {
  const insInv = db.prepare('INSERT INTO investors (slug, name, type, emoji, style, real_llm, cash) VALUES (?,?,?,?,?,?,?)');
  for (const p of PERSONAS) {
    insInv.run(p.slug, p.name, p.type, p.emoji, p.style, p.real ? 1 : 0, INITIAL_FUND);
  }

  const insBp = db.prepare('INSERT INTO bps (title, founder, summary, content, sector, visibility, created_at) VALUES (?,?,?,?,?,?,?)');

  // 按时间顺序逐份"上传"BP并让投资人建仓（纯模拟，带历史时间戳）
  DEMO_BPS.forEach((d, i) => {
    const daysAgo = 34 - i * 4;
    const t = ts(daysAgo, 9 + (i % 3) * 2);
    const r = insBp.run(d.title, d.founder, d.summary, d.content, d.sector, d.visibility, t);
    const bp = { ...d, id: r.lastInsertRowid };

    for (const p of PERSONAS) {
      const ev = simEvaluation(p, bp);
      saveEvaluation(db, getInvId(db, p.slug), bp.id, ev, t);
      const target = Math.round(targetAllocation(p, ev.score) * INITIAL_FUND);
      if (target <= 0) continue;
      const invId = getInvId(db, p.slug);
      let cash = db.prepare('SELECT cash FROM investors WHERE id=?').get(invId).cash;
      if (cash < target) {
        const held = db.prepare('SELECT h.bp_id, h.amount, b.title, b.summary, b.content, b.sector, b.id as id FROM holdings h JOIN bps b ON b.id=h.bp_id WHERE h.investor_id=? AND h.amount>0').all(invId)
          .map((h) => ({ ...h, s: scoreBp(p, h).score }))
          .sort((a, b) => a.s - b.s);
        for (const h of held) {
          if (cash >= target || h.s >= ev.score) break;
          const pull = Math.min(h.amount, target - cash);
          applyTx(db, invId, h.bp_id, 'withdraw', -pull, withdrawReason(p, h), ts(daysAgo, 14));
          cash += pull;
        }
      }
      const amount = Math.min(target, Math.floor(cash));
      if (amount > 1000000) {
        applyTx(db, invId, bp.id, 'invest', amount, ev.comment, t);
      }
    }
  });
}

function getInvId(db, slug) {
  return db.prepare('SELECT id FROM investors WHERE slug=?').get(slug).id;
}

// ===== Demo赛道示例（2个可直接试玩的单文件HTML Demo）=====
const SAMPLE_SNAKE = `<!DOCTYPE html><html lang="zh"><head><meta charset="utf-8"><title>极简贪吃蛇</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{background:#0b0e14;color:#e8ecf4;font-family:sans-serif;display:flex;flex-direction:column;align-items:center;padding:20px}canvas{border:1px solid #333;border-radius:8px;background:#11151f}h3{margin:8px}#s{color:#34d399}</style></head><body><h3>极简贪吃蛇 · 得分 <span id="s">0</span></h3><canvas id="c" width="300" height="300"></canvas><p>方向键控制，手机滑动</p><script>const cv=document.getElementById('c'),x=cv.getContext('2d'),G=15,N=20;let snake=[[10,10]],dir=[1,0],food=[5,5],score=0,dead=false;function spawn(){food=[Math.floor(Math.random()*N),Math.floor(Math.random()*N)]}function step(){if(dead)return;const h=[(snake[0][0]+dir[0]+N)%N,(snake[0][1]+dir[1]+N)%N];if(snake.some(p=>p[0]==h[0]&&p[1]==h[1])){dead=true;return}snake.unshift(h);if(h[0]==food[0]&&h[1]==food[1]){score+=10;document.getElementById('s').textContent=score;spawn()}else snake.pop();x.fillStyle='#11151f';x.fillRect(0,0,300,300);x.fillStyle='#fbbf24';x.fillRect(food[0]*G,food[1]*G,G-1,G-1);x.fillStyle='#34d399';snake.forEach(p=>x.fillRect(p[0]*G,p[1]*G,G-1,G-1));if(dead){x.fillStyle='#f87171';x.font='20px sans-serif';x.fillText('游戏结束，刷新重来',60,150)}}document.addEventListener('keydown',e=>{const m={ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0]}[e.key];if(m&&!(m[0]==-dir[0]&&m[1]==-dir[1]))dir=m});let t0=null;document.addEventListener('touchstart',e=>t0=[e.touches[0].clientX,e.touches[0].clientY]);document.addEventListener('touchend',e=>{if(!t0)return;const dx=e.changedTouches[0].clientX-t0[0],dy=e.changedTouches[0].clientY-t0[1];dir=Math.abs(dx)>Math.abs(dy)?[dx>0?1:-1,0]:[0,dy>0?1:-1]});setInterval(step,120)</script></body></html>`;

const SAMPLE_POMODORO = `<!DOCTYPE html><html lang="zh"><head><meta charset="utf-8"><title>专注番茄钟</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{background:linear-gradient(160deg,#0b0e14,#1a1040);color:#e8ecf4;font-family:sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:90vh;margin:0}#t{font-size:72px;font-weight:800;font-variant-numeric:tabular-nums}button{padding:12px 28px;border-radius:12px;border:none;font-size:16px;font-weight:700;cursor:pointer;margin:6px;background:#4f8cff;color:#fff}button.g{background:#34d399}#cnt{color:#9aa4b8}.ring{transition:stroke-dashoffset 1s linear}</style></head><body><h2>🍅 专注番茄钟</h2><svg width="220" height="220"><circle cx="110" cy="110" r="100" fill="none" stroke="#252c3d" stroke-width="8"/><circle class="ring" id="r" cx="110" cy="110" r="100" fill="none" stroke="#4f8cff" stroke-width="8" stroke-linecap="round" stroke-dasharray="628" stroke-dashoffset="0" transform="rotate(-90 110 110)"/></svg><div id="t">25:00</div><div><button id="b" class="g">开始专注</button><button onclick="reset()">重置</button></div><p id="cnt">今日完成 0 个番茄</p><script>let total=25*60,left=total,run=false,timer=null,done=0;const t=document.getElementById('t'),b=document.getElementById('b'),r=document.getElementById('r');function fmt(s){return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0')}function render(){t.textContent=fmt(left);r.style.strokeDashoffset=628*(1-left/total)}function tick(){if(left>0){left--;render()}else{clearInterval(timer);run=false;done++;document.getElementById('cnt').textContent='今日完成 '+done+' 个番茄';b.textContent='再来一个';left=total;try{new AudioContext().createOscillator().connect}catch(e){}}}b.onclick=()=>{if(run){clearInterval(timer);run=false;b.textContent='继续'}else{timer=setInterval(tick,1000);run=true;b.textContent='暂停'}};function reset(){clearInterval(timer);run=false;left=total;b.textContent='开始专注';render()}render()</script></body></html>`;

const DEMO_PROJECTS = [
  {
    title: '极简贪吃蛇 · 30分钟vibecoding产物', founder: '示例开发者A', sector: 'content',
    demo_type: 'html', visibility: 'public', file: 'sample-snake.html', html: SAMPLE_SNAKE,
    summary: '用AI半小时写完的经典贪吃蛇，支持键盘与手机滑动操作，验证"越简单越好玩"的小游戏分发思路。',
  },
  {
    title: '专注番茄钟 · 极简效率工具', founder: '示例开发者B', sector: 'saas',
    demo_type: 'html', visibility: 'public', file: 'sample-pomodoro.html', html: SAMPLE_POMODORO,
    summary: 'SVG环形进度+番茄工作法的极简计时器，无需注册即开即用，未来计划加入专注数据统计与白噪音。',
  },
];

function seedDemos(db) {
  const fs = require('fs');
  const path = require('path');
  const uploadsDir = path.join(process.cwd(), 'data', 'uploads');
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

  const insBp = db.prepare("INSERT INTO bps (title, founder, summary, content, sector, visibility, filename, kind, demo_type, demo_url, created_at) VALUES (?,?,?,?,?,?,?,'demo',?,?,?)");
  DEMO_PROJECTS.forEach((d, i) => {
    fs.writeFileSync(path.join(uploadsDir, d.file), d.html);
    const t = ts(3 - i, 11 + i * 3);
    const r = insBp.run(d.title, d.founder, d.summary, d.html, d.sector, d.visibility, d.file, d.demo_type, '', t);
    const bp = db.prepare('SELECT * FROM bps WHERE id = ?').get(r.lastInsertRowid);

    for (const p of PERSONAS) {
      const ev = simEvaluation(p, bp);
      const invId = getInvId(db, p.slug);
      saveEvaluation(db, invId, bp.id, ev, t);
      const target = Math.round(targetAllocation(p, ev.score) * INITIAL_FUND);
      if (target <= 0) continue;
      const cash = db.prepare('SELECT demo_cash FROM investors WHERE id=?').get(invId).demo_cash;
      const amount = Math.min(target, Math.floor(cash));
      if (amount > 1000000) {
        const { applyTx: tx } = require('./portfolio');
        tx(db, invId, bp.id, 'invest', amount, ev.comment, t);
      }
    }
  });
}

module.exports = { seed, seedDemos, DEMO_BPS };
