import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { investorDetail, fmtMoney } from '@/lib/queries';
import { pName, pStyle } from '@/lib/i18n';
import TrajectoryChart from '@/components/TrajectoryChart';

export const dynamic = 'force-dynamic';

export default function InvestorPage({ params }) {
  const locale = cookies().get('lang')?.value === 'en' ? 'en' : 'zh';
  const en = locale === 'en';
  const data = investorDetail(params.slug);
  if (!data) notFound();
  const { inv, holdings, txs, trajectory } = data;
  const bpInvested = holdings.filter((h) => h.kind !== 'demo').reduce((s, h) => s + h.amount, 0);
  const demoInvested = holdings.filter((h) => h.kind === 'demo').reduce((s, h) => s + h.amount, 0);

  return (
    <div>
      <div className="inv-head" style={{ marginTop: 10 }}>
        <div className="inv-avatar" style={{ width: 56, height: 56, fontSize: 28 }}>{inv.emoji}</div>
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>
            {pName(locale, params.slug, inv.name)}{' '}
            <span className={`badge ${inv.type === 'famous' ? 'badge-famous' : 'badge-llm'}`}>
              {inv.type === 'famous' ? (en ? 'Style-sim agent' : '风格模拟智能体') : (en ? 'LLM investor' : 'LLM 投资人')}
            </span>
            {inv.real_llm ? <span className="badge badge-real"> {en ? 'Live LLM' : '真实LLM'}</span> : null}
          </h1>
          <p className="page-sub" style={{ margin: '4px 0 0' }}>{pStyle(locale, params.slug, inv.style)} · {en ? '~$14M per track (BP & Demo), tracked separately' : 'BP/Demo双赛道各持1亿独立核算'}</p>
        </div>
      </div>

      <div className="stats-bar">
        <div className="stat"><b style={{ color: 'var(--accent)' }}>{fmtMoney(bpInvested, locale)}</b><span>{en ? 'BP invested' : 'BP赛道已投'}</span></div>
        <div className="stat"><b>{fmtMoney(inv.cash, locale)}</b><span>{en ? 'BP cash' : 'BP赛道现金'}</span></div>
        <div className="stat"><b style={{ color: 'var(--accent2)' }}>{fmtMoney(demoInvested, locale)}</b><span>{en ? 'Demo invested' : 'Demo赛道已投'}</span></div>
        <div className="stat"><b>{fmtMoney(inv.demo_cash, locale)}</b><span>{en ? 'Demo cash' : 'Demo赛道现金'}</span></div>
        <div className="stat"><b>{holdings.length}</b><span>{en ? 'Holdings' : '持仓项目'}</span></div>
        <div className="stat"><b>{txs.length}</b><span>{en ? 'Total moves' : '累计调仓次数'}</span></div>
      </div>

      <h2 className="section-title">📈 {en ? 'Capital trajectory (both tracks)' : '双赛道持仓资金变化轨迹'}</h2>
      <div className="card">
        <TrajectoryChart data={trajectory} />
      </div>

      <h2 className="section-title">💼 {en ? 'Current holdings' : '当前持仓分布'}</h2>
      <div className="card">
        <table className="simple">
          <thead><tr><th>{en ? 'Project' : '项目'}</th><th>{en ? 'Track' : '赛道'}</th><th>{en ? 'Score' : '评分'}</th><th style={{ textAlign: 'right' }}>{en ? 'Invested' : '注资金额'}</th><th style={{ textAlign: 'right' }}>{en ? 'Track position' : '占该赛道仓位'}</th></tr></thead>
          <tbody>
            {holdings.map((h) => (
              <tr key={h.id}>
                <td>
                  {h.visibility === 'public'
                    ? <Link href={`/bp/${h.id}`} style={{ color: 'var(--accent)' }}>{h.title}</Link>
                    : (en ? `🔒 AI-only ${h.kind === 'demo' ? 'Demo' : 'BP'}` : `🔒 仅AI可见的${h.kind === 'demo' ? 'Demo' : 'BP'}`)}
                </td>
                <td>{h.kind === 'demo' ? '🎮 Demo' : '📄 BP'}</td>
                <td>{h.score ?? '-'}</td>
                <td style={{ textAlign: 'right', color: 'var(--green)', fontWeight: 600 }}>{fmtMoney(h.amount, locale)}</td>
                <td style={{ textAlign: 'right' }}>{((h.amount / 100000000) * 100).toFixed(1)}%</td>
              </tr>
            ))}
            {holdings.length === 0 && <tr><td colSpan={5} className="hint">{en ? 'No holdings — all capital on the sidelines.' : '暂无持仓，资金全部观望中'}</td></tr>}
          </tbody>
        </table>
      </div>

      <h2 className="section-title">🧭 {en ? 'Moves & reasoning' : '调仓记录与判断理由'}</h2>
      <div className="card">
        <div className="timeline">
          {txs.map((t) => (
            <div className={`tl-item ${t.type === 'withdraw' ? 'withdraw' : 'invest'}`} key={t.id}>
              <div className="tl-date">{t.created_at} · {t.kind === 'demo' ? '🎮 Demo' : '📄 BP'}</div>
              <div className="tl-action" style={{ color: t.amount > 0 ? 'var(--green)' : 'var(--red)' }}>
                {t.amount > 0 ? (en ? '⬆ In' : '⬆ 注入') : (en ? '⬇ Out' : '⬇ 撤出')} {fmtMoney(Math.abs(t.amount), locale)} ·{' '}
                {t.visibility === 'public' ? t.title : (en ? `🔒 AI-only ${t.kind === 'demo' ? 'Demo' : 'BP'}` : `🔒 仅AI可见的${t.kind === 'demo' ? 'Demo' : 'BP'}`)}
              </div>
              <div className="tl-reason">{t.reason}</div>
            </div>
          ))}
          {txs.length === 0 && <p className="hint">{en ? 'No moves yet.' : '暂无调仓记录'}</p>}
        </div>
      </div>
    </div>
  );
}
