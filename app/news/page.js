import Link from 'next/link';
import { cookies } from 'next/headers';
import { newsList, newsRegions } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export default function NewsPage({ searchParams }) {
  const en = cookies().get('lang')?.value === 'en';
  const city = cookies().get('city')?.value || '上海';
  const region = (searchParams?.region || '').toString();
  const items = newsList({ city, region, limit: 60 });
  const regions = newsRegions(city);

  return (
    <div>
      <h1 className="page-title">📰 {en ? 'Vibe Coder News' : 'Vibe Coder 资讯'}</h1>
      <p className="page-sub">{en
        ? 'Latest from the vibecoding / indie-hacker world. Every item links to its source.'
        : 'vibecoding / 独立开发圈的最新动态。每条都带来源链接，点进去看原文。'}
        {' '}<Link href="/events" style={{ color: 'var(--accent)' }}>📅 {en ? 'Events' : '活动日历'}</Link></p>

      {regions.length > 0 && (
        <div className="filter-row" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          <a href="/news" className={`badge ${!region ? 'badge-llm' : 'badge-public'}`}>{en ? 'All' : '全部'}</a>
          {regions.map((r) => (
            <a key={r.region} href={`/news?region=${encodeURIComponent(r.region)}`} className={`badge ${region === r.region ? 'badge-llm' : 'badge-public'}`}>{r.region} ({r.n})</a>
          ))}
        </div>
      )}

      {items.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', color: 'var(--text2)' }}>
          {en
            ? <>No news yet. Populate it by running <code>node scripts/import-news.js</code> (fetches & sources recent items via Tavily).</>
            : <>还没有资讯。运行 <code>node scripts/import-news.js</code> 抓取最新动态（Tavily 联网、带来源）即可填充。</>}
        </div>
      ) : items.map((n) => (
        <div key={n.id} className="rank-row">
          <div className="rank-main">
            <div className="rank-title">
              {n.source_url
                ? <a href={n.source_url} target="_blank" rel="noopener noreferrer">{n.title}</a>
                : <span>{n.title}</span>}
            </div>
            {n.summary ? <div className="rank-sub">{n.summary}</div> : null}
            <div className="hint" style={{ marginTop: 4 }}>
              {n.source_name ? n.source_name : (n.source_url ? new URL(n.source_url).hostname.replace(/^www\./, '') : '')}
              {n.published_at ? ` · ${n.published_at}` : ''}
              {n.region ? ` · 📍${n.region}` : ''}
              {n.tags && n.tags.length ? ' · ' + n.tags.map((t) => `#${t}`).join(' ') : ''}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
