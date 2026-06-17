import Link from 'next/link';
import { cookies } from 'next/headers';
import { calibrationData, fmtMoney } from '@/lib/queries';

export const dynamic = 'force-dynamic';

const TYPE_LABEL = { raised: { zh: '融资', en: 'Raised' }, acquired: { zh: '被收购', en: 'Acquired' }, revenue: { zh: '营收', en: 'Revenue' } };

export default function CalibrationPage() {
  const locale = cookies().get('lang')?.value === 'en' ? 'en' : 'zh';
  const en = locale === 'en';
  const { items, n, hitRate, medianRatio, byVersion, byArchetype } = calibrationData();
  const ARCH_LABEL = { website: en ? 'Website' : '网站', game: en ? 'Game' : '游戏', tool: en ? 'Tool' : '工具', saas: 'SaaS', ai_agent: 'AI Agent', ecommerce: en ? 'E-commerce' : '电商', community: en ? 'Community' : '社区', other: en ? 'Other' : '其他' };
  const CompareTable = ({ title, rows, labelFn }) => (
    <div className="card" style={{ marginBottom: 12 }}>
      <div className="rank-sub" style={{ fontWeight: 600, marginBottom: 6 }}>{title}</div>
      <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
        <thead><tr style={{ color: 'var(--text2)', textAlign: 'left' }}>
          <th>{en ? 'Group' : '分组'}</th><th>{en ? 'Samples' : '样本'}</th><th>{en ? 'Within range' : '命中率'}</th><th>{en ? 'Median ratio' : '中位比'}</th>
        </tr></thead>
        <tbody>{rows.map((r) => (
          <tr key={r.key}><td>{labelFn ? labelFn(r.key) : r.key}</td><td>{r.n}</td><td>{r.hitRate}%</td><td>{r.medianRatio}×</td></tr>
        ))}</tbody>
      </table>
    </div>
  );

  return (
    <div>
      <h1 className="page-title">🎯 {en ? 'Valuation Calibration' : '估值校准'}</h1>
      <p className="page-sub">{en
        ? 'Each AI valuation vs. the real outcome reported later. This record is how an honest anchor earns trust over time.'
        : '当初的 AI 估值 vs 后来报告的真实结果。一个诚实的锚点，就是靠这样一条条对照记录积累信任的。'}</p>

      {n === 0 ? (
        <div className="card" style={{ textAlign: 'center', color: 'var(--text2)' }}>
          {en
            ? <>No calibration data yet. When a project reports a funding / acquisition / revenue outcome, it appears here against its earlier valuation. Add one from any project page → “Report a real outcome”.</>
            : <>还没有校准数据。当某个项目报告了融资 / 收购 / 营收等真实结果，就会在这里与它当初的估值对照。可在任意项目详情页点「报告真实进展」录入。</>}
        </div>
      ) : (
        <>
          <div className="stats-bar">
            <div className="stat"><b>{n}</b><span>{en ? 'Calibrated' : '已校准项目'}</span></div>
            <div className="stat"><b>{hitRate}%</b><span>{en ? 'Within range' : '落在估值区间内'}</span></div>
            <div className="stat"><b>{medianRatio}×</b><span>{en ? 'Median realized / predicted' : '真实/预测 中位比'}</span></div>
          </div>
          {byVersion && byVersion.length > 1 ? <CompareTable title={en ? 'By algorithm version' : '按算法版本对比'} rows={byVersion} /> : null}
          {byArchetype && byArchetype.length > 1 ? <CompareTable title={en ? 'By archetype' : '按原型对比'} rows={byArchetype} labelFn={(k) => ARCH_LABEL[k] || k} /> : null}
          {items.map((x) => (
            <div key={x.bp_id} className="rank-row">
              <div className="rank-main">
                <div className="rank-title">
                  <Link href={`/bp/${x.bp_id}`}>{x.title}</Link>{' '}
                  <span className={`badge ${x.inRange ? 'badge-public' : 'badge-ai'}`}>{x.inRange ? (en ? 'in range' : '区间内') : (en ? 'off' : '偏离')}</span>
                </div>
                <div className="rank-sub">
                  {en ? 'Predicted ' : '预测 '}{fmtMoney(x.low, locale)}–{fmtMoney(x.high, locale)} · {en ? 'Realized ' : '真实 '}
                  {(en ? TYPE_LABEL[x.type]?.en : TYPE_LABEL[x.type]?.zh) || x.type} {fmtMoney(x.realized, locale)} ({x.occurred_at})
                  {x.source_url ? <> · <a href={x.source_url} target="_blank" rel="noopener noreferrer">{en ? 'source' : '来源'}</a></> : null}
                </div>
              </div>
              <div className="rank-metrics">
                <div className="rank-amount">{x.ratio ? x.ratio.toFixed(2) + '×' : '-'}</div>
                <div className="rank-investors">{en ? 'realized / predicted' : '真实 / 预测'}</div>
              </div>
            </div>
          ))}
          <p className="hint" style={{ marginTop: 12 }}>{en
            ? 'Ratio > 1 means the real outcome exceeded the predicted midpoint (under-valued); < 1 means over-valued. A small, growing sample — read directionally.'
            : '比值 > 1 表示真实结果高于预测中点（当初低估了）；< 1 表示高估。样本还小，看趋势而非绝对。'}</p>
        </>
      )}
    </div>
  );
}
