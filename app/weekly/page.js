import Link from 'next/link';
import { cookies } from 'next/headers';
import { weeklyDigest, fmtMoney } from '@/lib/queries';
import { SECTOR_LABELS, SECTOR_LABELS_EN, L } from '@/lib/engine';

export const dynamic = 'force-dynamic';

export default function WeeklyPage() {
  const locale = cookies().get('lang')?.value === 'en' ? 'en' : 'zh';
  const en = locale === 'en';
  const d = weeklyDigest();
  const empty = d.risers.length + d.fallers.length + d.newcomers.length + d.reentries.length === 0;
  const T = (r) => (r.visibility === 'public' ? r.title : (en ? '🔒 A mystery BP' : '🔒 一份神秘的BP'));
  const Item = ({ r, href, children }) =>
    r.visibility === 'public'
      ? <Link href={href} className="wk-item">{children}</Link>
      : <div className="wk-item" style={{ opacity: 0.7 }}>{children}</div>;

  return (
    <div>
      <h1 className="page-title">📰 {en ? 'This Week in Sectors' : '本周赛道风云'}</h1>
      <p className="page-sub">{en
        ? `Last 7 days at a glance: ${d.counts.up} rises, ${d.counts.down} drops, ${d.counts.nw} new projects.`
        : `过去 7 天的榜单动态汇总。本周共 ${d.counts.up} 次上涨、${d.counts.down} 次下滑、${d.counts.nw} 个新项目登场。`}</p>

      {empty ? (
        <div className="card" style={{ textAlign: 'center', color: 'var(--text2)' }}>
          {en ? <>Not enough activity this week. Hit <code>/api/market-tick</code> to stir the market, or upload a project.</> : <>本周还没有足够动态。让榜单动起来：访问 <code>/api/market-tick</code> 触发一次市场波动，或上传新项目。</>}
        </div>
      ) : (
        <>
          {d.hotSector && (
            <div className="card">
              <h3>🔥 {en ? 'Hottest sector this week' : '本周最热赛道'}</h3>
              <p className="rp-p" style={{ fontSize: 14 }}>
                <Link href={`/sector/${d.hotSector.sector}`} style={{ color: 'var(--accent)' }}>{L(SECTOR_LABELS, SECTOR_LABELS_EN, d.hotSector.sector, locale)}</Link>
                {en ? `: ${d.hotSector.cnt} projects, ${fmtMoney(d.hotSector.total, locale)} invested.` : `：${d.hotSector.cnt} 个项目，累计注资 ${fmtMoney(d.hotSector.total, locale)}。`}
              </p>
            </div>
          )}

          {d.risers.length > 0 && (
            <div className="card">
              <h3>📈 {en ? 'Biggest risers' : '本周飙升'}</h3>
              {d.risers.map((r) => <Item key={r.bp_id} r={r} href={`/bp/${r.bp_id}`}><span className="wk-up">▲{r.up}</span> {T(r)}</Item>)}
            </div>
          )}
          {d.fallers.length > 0 && (
            <div className="card">
              <h3>📉 {en ? 'Biggest fallers' : '本周下滑'}</h3>
              {d.fallers.map((r) => <Item key={r.bp_id} r={r} href={`/bp/${r.bp_id}`}><span className="wk-down">▼{r.down}</span> {T(r)}</Item>)}
            </div>
          )}
          {d.newcomers.length > 0 && (
            <div className="card">
              <h3>🆕 {en ? 'New entries' : '新登场'}</h3>
              {d.newcomers.map((r) => <Item key={r.bp_id} r={r} href={`/bp/${r.bp_id}`}>{T(r)}</Item>)}
            </div>
          )}
          {d.reentries.length > 0 && (
            <div className="card">
              <h3>⚔️ {en ? 'Re-entries' : '重新参战'}</h3>
              {d.reentries.map((r) => <Item key={r.bp_id} r={r} href={`/bp/${r.bp_id}`}>{T(r)}{!en && r.body ? <span className="hint"> {r.body}</span> : null}</Item>)}
            </div>
          )}
        </>
      )}
    </div>
  );
}
