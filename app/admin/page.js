import { cookies } from 'next/headers';
import { siteMetrics } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export default function AdminPage() {
  const en = cookies().get('lang')?.value === 'en';
  const m = siteMetrics();
  const maxC = Math.max(1, ...m.daily.map((d) => d.c));

  return (
    <div>
      <h1 className="page-title">📊 {en ? 'Ops Dashboard' : '运营看板'}</h1>
      <p className="page-sub">{en ? 'Anonymous visit analytics (deduped by browser). North-star metric: 7-day return rate.' : '匿名访问埋点统计（按浏览器去重）。核心北极星指标：七日复访率。'}</p>

      <h2 className="section-title">{en ? 'Retention' : '留存'}</h2>
      <div className="stats-bar">
        <div className="stat"><b style={{ color: 'var(--accent)' }}>{m.sevenRate}%</b><span>{en ? '7-day return rate' : '七日复访率'}</span></div>
        <div className="stat"><b>{m.retRate}%</b><span>{en ? 'Overall return rate' : '整体复访率'}</span></div>
        <div className="stat"><b>{m.visitors}</b><span>{en ? 'Total visitors' : '累计访客'}</span></div>
        <div className="stat"><b>{m.returning}</b><span>{en ? 'Returning visitors' : '有复访的访客'}</span></div>
      </div>

      <h2 className="section-title">{en ? 'Activity & Content' : '活跃 & 内容'}</h2>
      <div className="stats-bar">
        <div className="stat"><b>{m.visits7}</b><span>{en ? 'Visits last 7d (person·day)' : '近7天访问(人·天)'}</span></div>
        <div className="stat"><b>{m.uploads7}</b><span>{en ? 'New projects last 7d' : '近7天新增项目'}</span></div>
        <div className="stat"><b>{m.bpN}</b><span>{en ? 'Total BPs' : 'BP 总数'}</span></div>
        <div className="stat"><b>{m.demoN}</b><span>{en ? 'Total Demos' : 'Demo 总数'}</span></div>
      </div>

      <h2 className="section-title">{en ? 'Daily visits (last 14 days)' : '近 14 天每日访问'}</h2>
      {m.daily.length === 0 ? (
        <p className="hint">{en ? 'No visit data yet. Browse the site a few times (and come back on another day) to accumulate.' : '还没有访问数据。先正常浏览几次站点（换天再来）即可积累。'}</p>
      ) : (
        <div className="card">
          {m.daily.slice().reverse().map((d) => (
            <div key={d.day} className="bar-row">
              <span className="bar-day">{d.day.slice(5)}</span>
              <span className="bar-track"><span className="bar-fill" style={{ width: `${Math.round((d.c / maxC) * 100)}%` }} /></span>
              <span className="bar-val">{d.c}</span>
            </div>
          ))}
        </div>
      )}

      <p className="hint" style={{ marginTop: 16 }}>
        {en ? 'Note: 7-day return rate = share of visitors who return within 7 days of first visit. Anonymous local ID; clearing browser data counts as a new visitor.' : '说明：七日复访率 = 首次访问后 7 天内再次访问的访客占比。埋点为本地匿名 ID，清除浏览器数据会被视为新访客。'}
      </p>
    </div>
  );
}
