import Link from 'next/link';
import { cookies } from 'next/headers';
import { leaderboard, investorsList, fmtMoney, fmtRange } from '@/lib/queries';
import { getDb } from '@/lib/db';
import { rankDeltas } from '@/lib/ranks';
import { STAGE_LABELS, STAGE_LABELS_EN, BIZ_MODEL_LABELS, BIZ_MODEL_LABELS_EN, CUSTOMER_LABELS, CUSTOMER_LABELS_EN, L } from '@/lib/engine';
import { t as tr } from '@/lib/i18n';
import RankDelta from '@/components/RankDelta';
import CoverThumb from '@/components/CoverThumb';

export const dynamic = 'force-dynamic';

function moneyBacked(r) { if (r.money_outcomes > 0) return true; try { const v = JSON.parse(r.val_summary || 'null'); return !!(v && v.floor > 0); } catch { return false; } }

export default function BpBoard({ searchParams }) {
  const locale = cookies().get('lang')?.value === 'en' ? 'en' : 'zh';
  const en = locale === 'en';
  const all = en ? 'All' : '全部';

  const STAGE_TABS = [['all', all], ['idea', en ? '💡 Idea' : '💡 想法'], ['mvp', '🛠 MVP'], ['revenue', en ? '📈 Revenue' : '📈 营收']];
  const MODEL_TABS = [['all', all], ...Object.keys(BIZ_MODEL_LABELS).map((k) => [k, en ? BIZ_MODEL_LABELS_EN[k] : BIZ_MODEL_LABELS[k]])];
  const CUST_TABS = [['all', all], ...Object.keys(CUSTOMER_LABELS).map((k) => [k, en ? CUSTOMER_LABELS_EN[k] : CUSTOMER_LABELS[k]])];

  const rows = leaderboard();
  rows.forEach((r, i) => { r._rank = i + 1; });
  const deltas = rankDeltas(getDb(), 'bp');
  const invs = investorsList();
  const totalInvested = rows.reduce((s, r) => s + r.total_invested, 0);

  const stageF = STAGE_TABS.some((x) => x[0] === searchParams?.stage) ? searchParams.stage : 'all';
  const modelF = MODEL_TABS.some((x) => x[0] === searchParams?.model) ? searchParams.model : 'all';
  const custF = CUST_TABS.some((x) => x[0] === searchParams?.customer) ? searchParams.customer : 'all';
  const shown = rows.filter((r) =>
    (stageF === 'all' || (r.stage || 'idea') === stageF) &&
    (modelF === 'all' || r.biz_model === modelF) &&
    (custF === 'all' || r.customer === custF)
  );
  const buildHref = (over) => {
    const p = { stage: stageF, model: modelF, customer: custF, ...over };
    const qs = Object.entries(p).filter(([, v]) => v && v !== 'all').map(([k, v]) => `${k}=${v}`).join('&');
    return qs ? `/bp?${qs}` : '/bp';
  };

  return (
    <div>
      <section className="hero">
        <h1>{en ? <>BP is “telling” — <span>pitch your idea</span></> : <>BP 是“说”——<span>用商业计划书一较高下</span></>}</h1>
        <p>{en ? `${invs.length} AI investors read your deck, invest and rank it · ` : `${invs.length} 位 AI 投资人阅读你的 BP，注资排名 · `}<Link href="/demos" style={{ color: 'var(--accent)' }}>{en ? 'Built a demo? Go value it →' : '做出 Demo 了？去估值 →'}</Link></p>
      </section>

      <div className="stats-bar">
        <div className="stat"><b>{rows.length}</b><span>{tr(locale, 'home.statBp')}</span></div>
        <div className="stat"><b>{invs.length}</b><span>{tr(locale, 'home.statInv')}</span></div>
        <div className="stat"><b>{fmtMoney(totalInvested, locale)}</b><span>{tr(locale, 'home.statTotal')}</span></div>
        <div className="stat"><b>{fmtMoney(invs.length * 100000000, locale)}</b><span>{tr(locale, 'home.statPool')}</span></div>
      </div>

      <h2 className="section-title">{tr(locale, 'home.boardTitle')} <span className="hint">{tr(locale, 'home.sortHint')} · <Link href="/controversial" style={{ color: 'var(--accent)' }}>🔥 {en ? 'Controversial' : '争议榜'}</Link> · <Link href="/sectors" style={{ color: 'var(--accent)' }}>🗺 {en ? 'Sectors' : '赛道总览'}</Link> · <Link href="/dealflow" style={{ color: 'var(--accent)' }}>💼 Deal Flow</Link></span></h2>
      <div className="filter-axis">
        <span className="filter-label">{tr(locale, 'filter.stage')}</span>
        {STAGE_TABS.map(([v, lbl]) => <Link key={v} href={buildHref({ stage: v })} className={`stage-tab ${stageF === v ? 'active' : ''}`}>{lbl}</Link>)}
      </div>
      <div className="filter-axis">
        <span className="filter-label">{tr(locale, 'filter.model')}</span>
        {MODEL_TABS.map(([v, lbl]) => <Link key={v} href={buildHref({ model: v })} className={`stage-tab ${modelF === v ? 'active' : ''}`}>{lbl}</Link>)}
      </div>
      <div className="filter-axis">
        <span className="filter-label">{tr(locale, 'filter.customer')}</span>
        {CUST_TABS.map(([v, lbl]) => <Link key={v} href={buildHref({ customer: v })} className={`stage-tab ${custF === v ? 'active' : ''}`}>{lbl}</Link>)}
      </div>
      {shown.length === 0 && <p className="hint">{en ? 'No projects in this filter.' : '该筛选下暂无项目。'}</p>}
      {shown.map((r) => {
        const i = r._rank - 1;
        const isPublic = r.visibility === 'public';
        let v = null; try { const j = JSON.parse(r.val_summary || 'null'); if (j && j.n > 0) v = j; } catch {}
        const inner = (
          <>
            <div className={`rank-num ${i === 0 ? 'top1' : i === 1 ? 'top2' : i === 2 ? 'top3' : ''}`}>{r._rank}</div>
            {isPublic ? <CoverThumb cover={r.cover} bp={r} /> : null}
            <div className="rank-main">
              <div className="rank-title">
                {isPublic ? r.title : (en ? '🔒 A mystery BP (AI-only)' : '🔒 一份神秘的BP（仅AI可见）')}{' '}
                <span className={`badge ${isPublic ? 'badge-public' : 'badge-ai'}`}>{tr(locale, isPublic ? 'badge.public' : 'badge.aionly')}</span>
                {r.stage && STAGE_LABELS[r.stage] ? <span className="badge badge-llm">{L(STAGE_LABELS, STAGE_LABELS_EN, r.stage, locale)}</span> : null}
                {moneyBacked(r) ? <span title={en ? 'Backed by real funding' : '有真实融资背书'}> 💰</span> : null}
                <RankDelta delta={deltas[r.id]} />
              </div>
              <div className="rank-sub">{isPublic ? `${r.founder} · ${r.summary}` : (en ? 'Hidden by the uploader, still competing on the board.' : '上传者选择了仅AI可见，内容已隐藏，但它依然参与排名')}</div>
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
    </div>
  );
}
