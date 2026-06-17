// 评分原则说明：在上传 / 重新参战 / 详情页展示，明确告知反作弊规则。
export default function ScoringNote({ compact = false, en = false }) {
  if (en) {
    return (
      <div className="scoring-note">
        <b>📐 How scoring works (please read)</b>
        <ul>
          <li><b>No keyword stuffing.</b> Mentioning “disruptive / moat / trillion-dollar market” <u>earns nothing</u>; pure hype loses points.</li>
          <li><b>Evidence only.</b> Scores come from verifiable specifics — real data, metrics, unit economics, clear mechanisms. More fluff = lower score.</li>
          <li><b>Team isn’t scored.</b> Founder background can’t be verified and is <u>excluded</u> — don’t pad your résumé.</li>
          {!compact && <li><b>Anti-plagiarism.</b> Content too similar to others or to an old version is flagged as low-originality and down-weighted.</li>}
        </ul>
      </div>
    );
  }
  return (
    <div className="scoring-note">
      <b>📐 评分怎么算（请认真看）</b>
      <ul>
        <li><b>不靠堆词。</b>提到"颠覆/护城河/万亿市场"这类词本身<u>不会加分</u>，纯口号反而扣分。</li>
        <li><b>只认证据。</b>分数来自可验证的具体内容——真实数据、业务指标、单位经济模型、清晰机制。空话越多分越低。</li>
        <li><b>团队不计分。</b>创始人背景无法核实，<u>一律不作为评分或投资依据</u>，请别在团队履历上做文章。</li>
        {!compact && <li><b>反照抄。</b>与他人或旧版高度雷同的内容会被判定原创性低、自动降权。</li>}
      </ul>
    </div>
  );
}
