import Link from 'next/link';
import { cookies } from 'next/headers';
import { eventsList, eventRegions } from '@/lib/queries';

export const dynamic = 'force-dynamic';

const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// 把活动按"年-月"分组（未定日期归到末尾）
function groupByMonth(items, en) {
  const groups = [];
  const map = {};
  for (const e of items) {
    const key = e.start_at ? e.start_at.slice(0, 7) : '__tbd';
    if (!map[key]) { map[key] = { key, label: monthLabel(key, en), items: [] }; groups.push(map[key]); }
    map[key].items.push(e);
  }
  return groups;
}
function monthLabel(key, en) {
  if (key === '__tbd') return en ? 'Date TBD' : '日期待定';
  const [y, m] = key.split('-');
  return en ? `${MONTHS_EN[Number(m) - 1]} ${y}` : `${y} 年 ${Number(m)} 月`;
}
function dayChip(start) {
  if (!start) return ['—', ''];
  const d = start.slice(8, 10) || '';
  const m = start.slice(5, 7) || '';
  return [d || '—', m ? m + '月' : ''];
}

export default function EventsPage({ searchParams }) {
  const en = cookies().get('lang')?.value === 'en';
  const region = (searchParams?.region || '').toString();
  const past = searchParams?.past === '1';
  const items = eventsList({ region, past, limit: 100 });
  const regions = eventRegions();
  const groups = groupByMonth(items, en);

  return (
    <div>
      <h1 className="page-title">📅 {en ? 'Vibe Coder Events' : 'Vibe Coder 活动日历'}</h1>
      <p className="page-sub">{en
        ? 'Meetups, hackathons and talks in the vibecoding circle. Click to sign up.'
        : 'vibecoding 圈的线下聚会、黑客松、分享会。点"报名"直达报名渠道。'}
        {' '}<Link href="/news" style={{ color: 'var(--accent)' }}>📰 {en ? 'News' : '资讯'}</Link></p>

      <div className="filter-row" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' }}>
        <a href="/events" className={`badge ${!region && !past ? 'badge-llm' : 'badge-public'}`}>{en ? 'Upcoming' : '即将开始'}</a>
        {regions.map((r) => (
          <a key={r.region} href={`/events?region=${encodeURIComponent(r.region)}`} className={`badge ${region === r.region && !past ? 'badge-llm' : 'badge-public'}`}>📍{r.region} ({r.n})</a>
        ))}
        <a href="/events?past=1" className={`badge ${past ? 'badge-llm' : 'badge-public'}`} style={{ marginLeft: 'auto' }}>{en ? 'Past' : '往期'}</a>
      </div>

      {items.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', color: 'var(--text2)' }}>
          {past
            ? (en ? 'No past events.' : '暂无往期活动。')
            : (en ? <>No upcoming events yet. Add one with <code>node scripts/add-event.js sample</code> (or your own).</> : <>暂无即将开始的活动。运行 <code>node scripts/add-event.js sample</code> 添加示例，或用它录入真实活动。</>)}
        </div>
      ) : groups.map((g) => (
        <div key={g.key} style={{ marginBottom: 18 }}>
          <h2 className="section-title" style={{ fontSize: 15 }}>{g.label}</h2>
          {g.items.map((e) => {
            const [d, mm] = dayChip(e.start_at);
            return (
              <div key={e.id} className="rank-row" style={{ alignItems: 'stretch' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minWidth: 52, padding: '4px 8px', borderRight: '1px solid var(--border)', marginRight: 12 }}>
                  <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1 }}>{d}</div>
                  <div className="hint" style={{ fontSize: 11 }}>{mm}</div>
                </div>
                <div className="rank-main">
                  <div className="rank-title">{e.title}</div>
                  <div className="rank-sub">
                    {[e.host && `${en ? 'by ' : '主办：'}${e.host}`, e.region && `📍${e.region}`, e.venue, e.start_at && (en ? e.start_at : e.start_at.replace('T', ' '))].filter(Boolean).join(' · ')}
                  </div>
                  {e.description ? <div className="hint" style={{ marginTop: 3 }}>{e.description}</div> : null}
                  {e.tags && e.tags.length ? <div className="hint" style={{ marginTop: 2 }}>{e.tags.map((t) => `#${t}`).join(' ')}</div> : null}
                </div>
                <div className="rank-metrics">
                  {e.signup_url
                    ? <a className="btn" href={e.signup_url} target="_blank" rel="noopener noreferrer">{en ? 'Sign up ↗' : '报名 ↗'}</a>
                    : <span className="hint">{en ? 'TBD' : '待定'}</span>}
                </div>
              </div>
            );
          })}
        </div>
      ))}

      <p className="hint" style={{ marginTop: 12 }}>{en
        ? 'Want "see which people you follow are attending"? That comes after accounts are live.'
        : '想看"你关注的人去了哪些活动"？等账户体系验证上线后接入。'}</p>
    </div>
  );
}
