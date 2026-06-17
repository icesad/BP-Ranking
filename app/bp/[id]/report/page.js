import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { bpDetail, leaderboard, fmtMoney } from '@/lib/queries';
import { analyzeBpText } from '@/lib/engine';
import { pName } from '@/lib/i18n';
import PrintButton from '@/components/PrintButton';

export const dynamic = 'force-dynamic';

export default function ReportPage({ params }) {
  const id = Number(params.id);
  const en = cookies().get('lang')?.value === 'en';
  const data = bpDetail(id);
  if (!data || data.bp.visibility !== 'public' || data.bp.kind === 'demo') notFound();
  const { bp, evals, total } = data;
  const enOf = (e) => { try { return JSON.parse(e.en || 'null'); } catch { return null; } };
  const pick = (e, f) => (en && enOf(e)?.[f]) || e[f];

  const board = leaderboard('bp');
  const rank = board.findIndex((r) => r.id === id) + 1;
  const avg = evals.length ? +(evals.reduce((s, e) => s + e.score, 0) / evals.length).toFixed(1) : 0;
  const analysis = analyzeBpText(`${bp.summary} ${bp.content}`);
  const sorted = evals.slice().sort((a, b) => b.score - a.score);
  const top = sorted[0];
  const low = sorted[sorted.length - 1];
  const invested = evals.filter((e) => e.holding > 0).length;

  const suggestions = [];
  if (en) {
    if (analysis.evidence === 0) suggestions.push('Add quantifiable real data (revenue, users, retention, growth, unit economics) — your single biggest scoring lever.');
    else if (analysis.evidence < 5) suggestions.push('Add a few more key business numbers to back up your core claims with facts.');
    if (analysis.hype >= 3) suggestions.push(`Cut hype phrasing (e.g. ${analysis.hypeSamples.slice(0, 4).join(', ')}); replace adjectives with concrete facts.`);
    if (avg < 50) suggestions.push('Overall credibility is low — focus on one strongest, most verifiable wedge instead of covering everything.');
    suggestions.push('Answer the key investor questions below and submit via “Re-enter” to climb back.');
  } else {
    if (analysis.evidence === 0) suggestions.push('补充可量化的真实数据（收入、用户量、留存、增长率、单位经济模型）——这是当前最大的提分项。');
    else if (analysis.evidence < 5) suggestions.push('再补充几组关键业务数据，让核心主张更有事实支撑。');
    if (analysis.hype >= 3) suggestions.push(`删减口号式表述（如：${analysis.hypeSamples.slice(0, 4).join('、')}），用具体事实替代形容词。`);
    if (avg < 50) suggestions.push('整体可信度偏低，建议聚焦一个最强、最可验证的切入点讲透，而非面面俱到。');
    suggestions.push('逐条回应下方投资人提出的关键问题，并在「重新参战」时提交，争取名次回升。');
  }
  const nameOf = (e) => pName(en ? 'en' : 'zh', e.slug, e.name);

  return (
    <div className="report-wrap">
      <div className="report-actions no-print">
        <Link href={`/bp/${id}`} style={{ color: 'var(--accent)' }}>{en ? '← Back to project' : '← 返回项目'}</Link>
        <PrintButton />
      </div>

      <div className="report-paper" id="report">
        <div className="rp-head">
          <div>
            <div className="rp-kicker">Demo-Ranking · {en ? 'Deep Diagnosis Report' : '深度诊断报告'}</div>
            <h1 className="rp-title">{bp.title}</h1>
            <div className="rp-sub">{bp.founder} · {en ? 'generated' : '生成于'} {new Date().toISOString().slice(0, 10)}</div>
          </div>
          <div className="rp-score">{avg}<span>{en ? 'Avg score' : '综合均分'}</span></div>
        </div>

        <div className="rp-stats">
          <div><b>{en ? `#${rank}` : `第 ${rank} 名`}</b><span>{en ? 'BP rank' : 'BP 榜排名'}</span></div>
          <div><b>{fmtMoney(total, en ? 'en' : 'zh')}</b><span>{en ? 'Total invested' : '累计虚拟注资'}</span></div>
          <div><b>{invested}/{evals.length}</b><span>{en ? 'Investors holding' : '投资人持仓中'}</span></div>
        </div>

        <h2 className="rp-h2">{en ? '1. Scoring basis (evidence vs hype)' : '一、评分依据（证据 vs 口号）'}</h2>
        <p className="rp-p">{en ? 'Scoring rewards verifiable content, not rhetoric, and excludes founder background.' : '本平台评分只认可验证的内容，不奖励辞藻堆砌，且不将团队背景计入评分。'}</p>
        <p className="rp-p">{en ? <>Detected <b>{analysis.evidence}</b> verifiable evidence points and <b>{analysis.hype}</b> hype phrases.</> : <>系统识别到 <b>{analysis.evidence}</b> 处可验证证据、<b>{analysis.hype}</b> 处口号式表述。</>}</p>
        {analysis.evidenceSamples.length > 0 && (
          <>
            <div className="rp-label">{en ? 'Recognized specifics:' : '被认可的具体信息：'}</div>
            <ul className="rp-ul">{analysis.evidenceSamples.map((s, i) => <li key={i}>{s}</li>)}</ul>
          </>
        )}
        {analysis.hypeSamples.length > 0 && <p className="rp-p rp-muted">{en ? 'Hype words detected: ' : '检测到的口号词：'}{analysis.hypeSamples.join(en ? ', ' : '、')}</p>}

        <h2 className="rp-h2">{en ? `2. Investor evaluations (${evals.length})` : `二、投资人评估汇总（${evals.length} 位）`}</h2>
        <table className="rp-table">
          <thead><tr><th>{en ? 'Investor' : '投资人'}</th><th className="num">{en ? 'Score' : '评分'}</th><th>{en ? 'One-line comment' : '一句话点评'}</th></tr></thead>
          <tbody>
            {sorted.map((e) => (
              <tr key={e.id}>
                <td>{e.emoji} {nameOf(e)}</td>
                <td className="num">{e.score}</td>
                <td>{pick(e, 'comment')}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2 className="rp-h2">{en ? '3. Consensus & disagreement' : '三、共识与分歧'}</h2>
        <p className="rp-p">{en ? 'Most bullish' : '最看好'}：<b>{top.emoji} {nameOf(top)}</b>（{top.score}）——{pick(top, 'strengths')}</p>
        <p className="rp-p">{en ? 'Most cautious' : '最谨慎'}：<b>{low.emoji} {nameOf(low)}</b>（{low.score}）——{pick(low, 'weaknesses')}</p>

        <h2 className="rp-h2">{en ? '4. Key questions to address' : '四、待回应的关键问题'}</h2>
        <ul className="rp-ul">
          {sorted.filter((e) => e.question).slice(-3).map((e) => (
            <li key={e.id}><b>{nameOf(e)}</b>：{pick(e, 'question')}</li>
          ))}
          {sorted.filter((e) => e.question).length === 0 && <li className="rp-muted">{en ? '(questions appear after re-scoring)' : '（重评后将生成投资人提问）'}</li>}
        </ul>

        <h2 className="rp-h2">{en ? '5. Suggestions' : '五、改进建议'}</h2>
        <ol className="rp-ol">{suggestions.map((s, i) => <li key={i}>{s}</li>)}</ol>

        <div className="rp-foot">{en ? 'Auto-generated by Demo-Ranking from 12 AI investors. All capital and valuations are virtual; not investment advice.' : '本报告由 Demo-Ranking 依据 12 位 AI 投资人评估自动生成，所有资金与估值均为虚拟，不构成投资建议。'}</div>
      </div>
    </div>
  );
}
