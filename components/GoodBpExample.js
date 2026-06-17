// 填写引导：教用户写"具体证据"而非"口号"，可折叠，纯展示。
export default function GoodBpExample({ en = false }) {
  if (en) {
    return (
      <details className="guide-box">
        <summary>📖 How to score high? Open for examples</summary>
        <div className="guide-body">
          <div className="guide-col guide-good">
            <h4>✅ Revenue stage: let real data speak</h4>
            <p>“AI triage tool for county clinics. Piloted in 28 clinics across 3 counties for 6 months: 41,000 triages, accuracy up from 71% to 86%; ¥800/clinic/month subscription, 12 paying, 92% monthly retention, ~2-month payback. Next: scale to 50 clinics. Main risk: inconsistent data entry at the grassroots.”</p>
          </div>
          <div className="guide-col guide-good">
            <h4>✅ No data yet? Insight + plan + honest risk</h4>
            <p>“County clinics lack standardized triage, causing missed/wrong referrals. We found reusable structured symptom data hidden in insurance claims — an overlooked wedge. No product yet. Biggest unvalidated assumption: will doctors change their data-entry habits? Plan: an 8-week pilot in 2 clinics to validate ‘&gt;80% entry-completion’; if it fails, pivot to voice entry. Top risk: grassroots networks and data compliance.”</p>
          </div>
          <div className="guide-tpl">
            <h4>✍️ Fill it in (add numbers where you can)</h4>
            <ul>
              <li><b>What / for whom</b>: one line on the product and target user</li>
              <li><b>Real traction</b>: users / revenue / growth / retention (with numbers and dates)</li>
              <li><b>Business model</b>: pricing, CAC, payback</li>
              <li><b>Biggest risk</b>: state it honestly — honesty helps</li>
            </ul>
            <p className="hint">Note: investors score by your chosen stage — Idea/Pre-MVP isn’t penalized for lacking revenue; what matters is insight and a validation plan. Misreporting your stage (claiming “idea” while boasting big revenue) gets caught and lowers your score. Founder background is never scored.</p>
          </div>
        </div>
      </details>
    );
  }
  return (
    <details className="guide-box">
      <summary>📖 怎么写才拿高分？点开看范例</summary>
      <div className="guide-body">
        <div className="guide-col guide-good">
          <h4>✅ 有营收阶段：用真实数据说话</h4>
          <p>“面向县域诊所的 AI 分诊工具。在 3 个县 28 家诊所试点 6 个月，累计处理 4.1 万次分诊，准确率从 71% 提升到 86%；按每店每月 800 元订阅，已 12 家付费、月留存 92%，回收期约 2 个月。下一步扩到 50 家，主要风险是基层数据录入不规范。”</p>
        </div>
        <div className="guide-col guide-good">
          <h4>✅ 还没数据也能拿高分：讲清洞察+计划+风险</h4>
          <p>“县域诊所缺规范分诊，漏诊误转高发。我们发现医保结算单里藏着可复用的结构化症状数据——这是别人忽略的切入点。还没产品。最大的未验证假设是：医生愿不愿意改变录入习惯。计划用这笔钱在 2 家诊所做 8 周试点，验证‘录入完成率＞80%’这一指标；若不成立就转向医生端语音录入。最大风险：基层网络与数据合规。”</p>
        </div>
        <div className="guide-tpl">
          <h4>✍️ 照着填（每条尽量带数字）</h4>
          <ul>
            <li><b>做什么 / 为谁</b>：一句话说清产品与目标用户</li>
            <li><b>真实进展</b>：用户数 / 收入 / 增长 / 留存（带具体数字和时间）</li>
            <li><b>商业模式</b>：怎么收费、客单价、获客成本、回收期</li>
            <li><b>最大风险</b>：诚实写出来——诚实反而加分</li>
          </ul>
          <p className="hint">注：投资人按你选的阶段评分——想法/Pre-MVP 不会因为没有营收数据而扣分，重点看洞察与验证计划；但谎报阶段（说想法期却吹已实现大量营收）会被识破降分。团队背景一律不计入评分。</p>
        </div>
      </div>
    </details>
  );
}
