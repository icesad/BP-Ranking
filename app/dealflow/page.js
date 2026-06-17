import Link from 'next/link';
import { cookies } from 'next/headers';
import { dealflowProjects, fmtMoney } from '@/lib/queries';
import { SECTOR_LABELS, SECTOR_LABELS_EN, STAGE_LABELS, STAGE_LABELS_EN, BIZ_MODEL_LABELS, BIZ_MODEL_LABELS_EN, CUSTOMER_LABELS, evidenceCount, L } from '@/lib/engine';

export const dynamic = 'force-dynamic';

export default function DealflowPage({ searchParams }) {
  const locale = cookies().get('lang')?.value === 'en' ? 'en' : 'zh';
  const en = locale === 'en';
  const STAGE_TABS = [['', en ? 'All stages' : '全部阶段'], ['idea', en ? 'Idea' : '想法'], ['mvp', 'MVP'], ['revenue', en ? 'Revenue' : '营收']];
  const MODEL_TABS = [['', en ? 'All models' : '全部模式'], ...Object.keys(BIZ_MODEL_LABELS).map((k) => [k, en ? BIZ_MODEL_LABELS_EN[k] : BIZ_MODEL_LABELS[k]])];

  const f = {
    sector: searchParams?.sector || '',
    stage: searchParams?.stage || '',
    model: searchParams?.model || '',
    minScore: searchParams?.minScore || '',
  };
  const rows = dealflowProjects(f);
  const buildHref = (over) => {
    const p = { ...f, ...over };
    const qs = Object.entries(p).filter(([, v]) => v).map(([k, v]) => `${k}=${v}`).join('&');
    return qs ? `/dealflow?${qs}` : '/dealflow';
  };
  const csvHref = `/api/dealflow?${Object.entries(f).filter(([, v]) => v).map(([k, v]) => `${k}=${v}`).join('&')}`;

  return (
    <div>
      <h1 className="page-title">💼 Deal Flow</h1>
      <p className="page-sub">{en ? 'For real investors: filter high-scoring projects by sector/stage/model, export to CSV. (“Contact founder” opens once email/accounts ship.)' : '面向真实投资人：按赛道/阶段/模式筛选高分项目，可导出 CSV。（“联系创始人”需创始人开放授权，随邮箱/账号功能上线后开放）'}</p>

      <div className="filter-axis">
        <span className="filter-label">{en ? 'Stage' : '阶段'}</span>
        {STAGE_TABS.map(([v, lbl]) => <Link key={v} href={buildHref({ stage: v })} className={`stage-tab ${f.stage === v ? 'active' : ''}`}>{lbl}</Link>)}
      </div>
      <div className="filter-axis">
        <span className="filter-label">{en ? 'Model' : '模式'}</span>
        {MODEL_TABS.map(([v, lbl]) => <Link key={v} href={buildHref({ model: v })} className={`stage-tab ${f.model === v ? 'active' : ''}`}>{lbl}</Link>)}
      </div>
      <div className="filter-axis">
        <span className="filter-label">{en ? 'Avg' : '均分'}</span>
        {['', '50', '60', '70'].map((v) => <Link key={v} href={buildHref({ minScore: v })} className={`stage-tab ${f.minScore === v ? 'active' : ''}`}>{v ? `≥${v}` : (en ? 'Any' : '不限')}</Link>)}
        <a href={csvHref} className="btn btn-ghost" style={{ marginLeft: 'auto' }}>⬇️ {en ? `Export CSV (${rows.length})` : `导出 CSV（${rows.length}）`}</a>
      </div>

      {rows.length === 0 ? (
        <p className="hint">{en ? 'No matching projects.' : '没有符合条件的项目。'}</p>
      ) : (
        <div className="cmp-wrap">
          <table className="cmp-table">
            <thead><tr><th>{en ? 'Project' : '项目'}</th><th>{en ? 'Sector' : '赛道'}</th><th>{en ? 'Stage' : '阶段'}</th><th>{en ? 'Model' : '模式'}</th><th className="num">{en ? 'Avg' : '均分'}</th><th className="num">{en ? 'Invested' : '注资'}</th><th className="num">{en ? 'Evidence' : '证据'}</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td><Link href={`/bp/${r.id}`} style={{ color: 'var(--text)', fontWeight: 600 }}>{r.title}</Link><div className="hint">{r.founder}</div></td>
                  <td>{r.subsector || L(SECTOR_LABELS, SECTOR_LABELS_EN, r.sector, locale)}</td>
                  <td>{r.stage ? L(STAGE_LABELS, STAGE_LABELS_EN, r.stage, locale) : '-'}</td>
                  <td>{r.biz_model ? L(BIZ_MODEL_LABELS, BIZ_MODEL_LABELS_EN, r.biz_model, locale) : '-'}</td>
                  <td className="num" style={{ fontWeight: 700 }}>{r.avg_score ?? '-'}</td>
                  <td className="num" style={{ color: 'var(--green)' }}>{fmtMoney(r.total_invested, locale)}</td>
                  <td className="num">{evidenceCount(`${r.summary} ${r.content}`)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
