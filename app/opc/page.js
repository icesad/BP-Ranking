import Link from 'next/link';
import { cookies } from 'next/headers';
import { NAV_CATEGORIES, navLinksByCategory, communitiesList, newsList, eventsList } from '@/lib/queries';
import CommunityMap from '@/components/CommunityMap';

export const dynamic = 'force-dynamic';

const CAT_ICON = { register: '🏢', accounting: '📒', policy: '📜', office: '🏠', legal: '⚖️', finance: '🏦', marketing: '🎨', tools: '🧰', community: '👥' };

export default function OpcPage() {
  const en = cookies().get('lang')?.value === 'en';
  const city = cookies().get('city')?.value || '上海';
  const groups = navLinksByCategory(city);
  const communities = communitiesList(city);
  const upcoming = eventsList({ city, past: false, limit: 4 });
  const recentNews = newsList({ city, limit: 4 });
  const amapKey = process.env.AMAP_KEY || '';
  const amapSecret = process.env.AMAP_SECRET || '';
  // 渲染数据里出现的所有分类（预设的在前、按固定顺序，其余 OnePilot 自带分类追加在后）
  const known = Object.keys(NAV_CATEGORIES).filter((c) => groups[c]?.length);
  const extra = Object.keys(groups).filter((c) => !(c in NAV_CATEGORIES));
  const cats = [...known, ...extra];
  const catLabel = (c) => NAV_CATEGORIES[c] || c;

  return (
    <div>
      <h1 className="page-title">🧭 {en ? 'OPC Hub' : '一人公司 / OPC 资源中心'} <span style={{ color: 'var(--accent)' }}>· 📍{city}</span></h1>
      <p className="page-sub">{en
        ? 'Everything a solo vibe coder needs to run a company: registration, tax, policies, office, legal, tools, communities — plus events & news.'
        : '一人公司/独立开发者把公司跑起来需要的一切：注册、记账、政策、办公、法务、工具、社群——加上活动与资讯。'}</p>

      {/* 快捷入口 */}
      <div className="stats-bar">
        <Link href="/events" className="stat" style={{ textDecoration: 'none' }}><b>📅</b><span>{en ? 'Events' : '活动日历'}</span></Link>
        <Link href="/news" className="stat" style={{ textDecoration: 'none' }}><b>📰</b><span>{en ? 'News' : '圈内资讯'}</span></Link>
        <Link href="/resources" className="stat" style={{ textDecoration: 'none' }}><b>🤝</b><span>{en ? 'Match' : '资源对接'}</span></Link>
        <Link href="/match" className="stat" style={{ textDecoration: 'none' }}><b>🧑‍🤝‍🧑</b><span>{en ? 'Buddies' : '找搭子'}</span></Link>
      </div>

      {/* 社区地图（置顶，随城市切换；有高德 key 即显示该城市地图） */}
      <h2 className="section-title">🗺️ {en ? `${city} OPC map` : `${city} · OPC 社区地图`} <span className="hint">{communities.length}</span></h2>
      <div style={{ marginBottom: 16 }}><CommunityMap communities={communities} amapKey={amapKey} amapSecret={amapSecret} city={city} en={en} /></div>

      {/* 资源导航 */}
      {cats.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', color: 'var(--text2)' }}>
          {en ? <>No resources yet. Run <code>node scripts/seed-opc.js</code> to add starter Shanghai OPC resources.</> : <>还没有资源。运行 <code>node scripts/seed-opc.js</code> 灌入上海 OPC 起始资源（可编辑）。</>}
        </div>
      ) : cats.map((c) => (
        <div key={c} className="card" style={{ marginBottom: 12 }}>
          <h3 style={{ margin: '0 0 8px' }}>{CAT_ICON[c] || '🔗'} {catLabel(c)}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 10 }}>
            {groups[c].map((l) => (
              <a key={l.id} href={(l.url || '#').split(' ')[0]} target="_blank" rel="noopener noreferrer" style={{ display: 'block', padding: 10, border: '1px solid var(--border)', borderRadius: 10, textDecoration: 'none' }}>
                <div style={{ fontWeight: 600 }}>{l.title} {l.official ? <span className="badge badge-real">{en ? 'official' : '官方'}</span> : null}{l.region ? <span className="hint"> · {l.region}</span> : null}</div>
                {l.description ? <div className="hint" style={{ marginTop: 3 }}>{l.description}</div> : null}
              </a>
            ))}
          </div>
        </div>
      ))}

      {/* 社区分布：按区分组（对标 OnePilot 按区罗列 OPC 社区） */}
      <h2 className="section-title">👥 {en ? 'OPC Communities by district' : 'OPC 社区分布（按区）'} <span className="hint">{communities.length}</span></h2>
      {communities.length === 0 ? (
        <div className="card" style={{ color: 'var(--text2)' }}>{en ? 'No communities yet.' : '暂无社区，运行 import-opc-json 或 seed-opc 录入。'}</div>
      ) : Object.entries(communities.reduce((g, cm) => { (g[cm.region || '其他'] = g[cm.region || '其他'] || []).push(cm); return g; }, {})).map(([reg, list]) => (
        <div key={reg} id={`region-${reg}`} className="card" style={{ marginBottom: 12, scrollMarginTop: 70 }}>
          <h3 style={{ margin: '0 0 8px' }}>📍 {reg} <span className="hint">{list.length}</span></h3>
          {list.map((cm) => (
            <div key={cm.id} style={{ padding: '8px 0', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
              <div>
                <div className="rank-title" style={{ fontSize: 15 }}><Link href={`/opc/c/${cm.id}`}>{cm.name}</Link> {cm.type ? <span className="badge badge-public">{cm.type}</span> : null}</div>
                {cm.description ? <div className="hint" style={{ marginTop: 2 }}>{cm.description}</div> : null}
              </div>
              <Link href={`/opc/c/${cm.id}`} className="btn btn-ghost" style={{ flex: '0 0 auto', whiteSpace: 'nowrap', padding: '4px 10px' }}>{en ? 'Join →' : '报名入驻 →'}</Link>
            </div>
          ))}
        </div>
      ))}

      {/* 最近活动 / 资讯 摘要 */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 16 }}>
        <div style={{ flex: '1 1 280px' }}>
          <h2 className="section-title">📅 {en ? 'Upcoming events' : '近期活动'} <Link href="/events" className="hint">{en ? 'all →' : '全部 →'}</Link></h2>
          {upcoming.length ? upcoming.map((e) => <div key={e.id} className="hint" style={{ padding: '4px 0' }}>{e.start_at || (en ? 'TBD' : '待定')} · {e.title}{e.region ? ` · 📍${e.region}` : ''}</div>) : <div className="hint">{en ? 'none' : '暂无'}</div>}
        </div>
        <div style={{ flex: '1 1 280px' }}>
          <h2 className="section-title">📰 {en ? 'Latest news' : '最新资讯'} <Link href="/news" className="hint">{en ? 'all →' : '全部 →'}</Link></h2>
          {recentNews.length ? recentNews.map((n) => <div key={n.id} className="hint" style={{ padding: '4px 0' }}>{n.source_url ? <a href={n.source_url} target="_blank" rel="noopener noreferrer">{n.title}</a> : n.title}</div>) : <div className="hint">{en ? 'none' : '暂无'}</div>}
        </div>
      </div>

      <p className="hint" style={{ marginTop: 14 }}>{en ? 'Curated directory; official links go to government/portal sites. Some entries are examples — edit via seed-opc.' : '精选目录；标“官方”的指向政府/政务门户。部分为示例条目，可用 seed-opc 编辑。'}</p>
    </div>
  );
}
