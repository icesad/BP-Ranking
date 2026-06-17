import Link from 'next/link';
import { cookies } from 'next/headers';
import { leaderboard, investorsList, fmtMoney, fmtRange } from '@/lib/queries';
import { getDb } from '@/lib/db';
import { rankDeltas } from '@/lib/ranks';
import { t as tr } from '@/lib/i18n';
import RankDelta from '@/components/RankDelta';
import CoverThumb from '@/components/CoverThumb';
import IntroBanner from '@/components/IntroBanner';
import BatchValuateButton from '@/components/BatchValuateButton';

export const dynamic = 'force-dynamic';

const TYPE_LABELS = { html: '🎮 可在线试玩', url: '🔗 在线Demo', github: '🐙 GitHub', shots: '🖼 截图' };
const TYPE_LABELS_EN = { html: '🎮 Playable', url: '🔗 Live', github: '🐙 GitHub', shots: '🖼 Screenshot' };

function parseVal(r) { try { const v = JSON.parse(r.val_summary || 'null'); return v && v.n > 0 ? v : null; } catch { return null; } }
function moneyBacked(r) { if (r.money_outcomes > 0) return true; try { const v = JSON.parse(r.val_summary || 'null'); return !!(v && v.floor > 0); } catch { return false; } }

export default function DemosPage({ searchParams }) {
  const locale = cookies().get('lang')?.value === 'en' ? 'en' : 'zh';
  const en = locale === 'en';
  const sort = searchParams?.sort === 'invested' ? 'invested' : 'val';
  const rows = leaderboard('demo');
  if (sort === 'val') {
    rows.sort((a, b) => {
      const va = parseVal(a), vb = parseVal(b);
      const ma = va ? (va.low + va.high) / 2 : -1, mb = vb ? (vb.low + vb.high) / 2 : -1;
      return mb - ma;
    });
  }
  const deltas = rankDeltas(getDb(), 'demo');
  const invs = investorsList();
  const totalInvested = rows.reduce((s, r) => s + r.total_invested, 0);

  return (
    <div>
      <IntroBanner locale={locale} />
      <section className="hero">
        <h1>{tr(locale, 'home.heroA')}<br /><span>Demo-Ranking</span>{en ? ' — ' : '，'}{tr(locale, 'home.heroB')}</h1>
        <p>{invs.length} {tr(locale, 'home.heroSub')} · <Link href="/bp" style={{ color: 'var(--accent)' }}>{en ? 'BP board →' : '看 BP 榜 →'}</Link> · <Link href="/calibration" style={{ color: 'var(--accent)' }}>🎯 {en ? 'Calibration' : '估值校准'}</Link> · <Link href="/comparables" style={{ color: 'var(--accent)' }}>📚 {en ? 'Comparables' : '可比库'}</Link></p>
      </section>

      <div className="stats-bar">
        <div className="stat"><b>{rows.length}</b><span>{en ? 'Demos' : '参战Demo'}</span></div>
        <div className="stat"><b>{fmtMoney(totalInvested, locale)}</b><span>{en ? 'Total invested (Demo)' : 'Demo赛道累计注资'}</span></div>
        <div className="stat"><b>{fmtMoney(invs.length * 100000000, locale)}</b><span>{en ? 'Demo capital pool' : 'Demo赛道总资金池'}</span></div>
      </div>

      <div style={{ margin: '8px 0 20px', display: 'flex', gap: 12, justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
        <Link href="/upload-demo" className="btn">{en ? 'Submit my Demo 🎮' : '提交我的 Demo 🎮'}</Link>
        <BatchValuateButton en={en} />
      </div>

      <h2 className="section-title">🎮 {en ? 'Demo Leaderboard' : 'Demo 排行榜'}</h2>
      <div className="filter-axis">
        <span className="filter-label">{en ? 'Sort' : '排序'}</span>
        <Link href="/demos" className={`stage-tab ${sort === 'val' ? 'active' : ''}`}>{en ? '📊 By valuation' : '📊 按估值'}</Link>
        <Link href="/demos?sort=invested" className={`stage-tab ${sort === 'invested' ? 'active' : ''}`}>{en ? '💰 By investment' : '💰 按注资'}</Link>
      </div>
      {rows.map((r, i) => {
        const isPublic = r.visibility === 'public';
        const types = en ? TYPE_LABELS_EN : TYPE_LABELS;
        const v = parseVal(r);
        const inner = (
          <>
            <div className={`rank-num ${i === 0 ? 'top1' : i === 1 ? 'top2' : i === 2 ? 'top3' : ''}`}>{i + 1}</div>
            {isPublic ? <CoverThumb cover={r.cover} bp={r} /> : null}
            <div className="rank-main">
              <div className="rank-title">
                {isPublic ? r.title : (en ? '🔒 A mystery Demo (AI-only)' : '🔒 一个神秘的Demo（仅AI可见）')}{' '}
                <span className="badge badge-llm">{types[r.demo_type] || 'Demo'}</span>{' '}
                <span className={`badge ${isPublic ? 'badge-public' : 'badge-ai'}`}>{tr(locale, isPublic ? 'badge.public' : 'badge.aionly')}</span>
                {moneyBacked(r) ? <span title={en ? 'Backed by real funding' : '有真实融资背书'}> 💰</span> : null}
                <RankDelta delta={deltas[r.id]} />
              </div>
              <div className="rank-sub">{isPublic ? `${r.founder} · ${r.summary}` : (en ? 'Hidden by the developer, still competing.' : '开发者选择了仅AI可见，但它依然参与排名')}</div>
            </div>
            <div className="rank-metrics">
              {v ? (
                <div style={{ display: 'inline-block', background: 'rgba(251,191,36,0.10)', border: '1px solid rgba(251,191,36,0.30)', borderRadius: 8, padding: '2px 9px', marginBottom: 5 }}>
                  <span style={{ fontSize: '.62rem', fontWeight: 700, letterSpacing: '.03em', color: 'var(--gold)', opacity: 0.9, marginRight: 5 }}>{en ? 'Valuation' : '估值'}</span>
                  <span style={{ fontSize: '1.02rem', fontWeight: 800, color: 'var(--gold)' }}>{fmtRange(v.low, v.high, locale)}</span>
                </div>
              ) : null}
              <div className={v ? undefined : 'rank-amount'} style={v ? { fontSize: '.85rem' } : undefined}>
                <span style={{ fontSize: '.64rem', color: 'var(--text2)', marginRight: 4 }}>{en ? 'Invested' : '投资人注资'}</span>
                <b style={{ color: 'var(--green)', fontWeight: 700 }}>{fmtMoney(r.total_invested, locale)}</b>
              </div>
              <div className="rank-investors">{en ? `${r.investor_count} investors · avg ${r.avg_score ?? '-'}` : `${r.investor_count} 位投资人 · 均分 ${r.avg_score ?? '-'}`}</div>
            </div>
          </>
        );
        return isPublic
          ? <Link href={`/bp/${r.id}`} key={r.id} className="rank-row">{inner}</Link>
          : <div key={r.id} className="rank-row" style={{ opacity: 0.75 }}>{inner}</div>;
      })}
      {rows.length === 0 && <p className="hint">{en ? 'No demos yet — be the first!' : '还没有Demo参战，做第一个吃螃蟹的人？'}</p>}
    </div>
  );
}
