import Link from 'next/link';
import { cookies } from 'next/headers';
import { sectorsOverview, fmtMoney } from '@/lib/queries';
import { SECTOR_LABELS, SECTOR_LABELS_EN, L } from '@/lib/engine';

export const dynamic = 'force-dynamic';

export default function SectorsPage() {
  const locale = cookies().get('lang')?.value === 'en' ? 'en' : 'zh';
  const en = locale === 'en';
  const rows = sectorsOverview();
  const maxTotal = Math.max(1, ...rows.map((r) => r.total));

  return (
    <div>
      <h1 className="page-title">🗺 {en ? 'Sectors Overview' : '赛道总览'}</h1>
      <p className="page-sub">{en ? 'Project count, total virtual investment and current champion per industry. Click any sector for a side-by-side comparison.' : '各行业的参战数量、累计虚拟注资与当前冠军。点进任意赛道看横向对比。'}</p>

      {rows.length === 0 ? (
        <p className="hint">{en ? 'No projects yet.' : '还没有项目。'}</p>
      ) : (
        <div className="sectors-grid">
          {rows.map((r) => (
            <Link key={r.sector} href={`/sector/${r.sector}`} className="card sector-card">
              <div className="sector-head">
                <b>{L(SECTOR_LABELS, SECTOR_LABELS_EN, r.sector, locale)}</b>
                <span className="hint">{en ? `${r.cnt} projects` : `${r.cnt} 个项目`}</span>
              </div>
              <div className="sector-bar"><span style={{ width: `${Math.round((r.total / maxTotal) * 100)}%` }} /></div>
              <div className="sector-total">{en ? 'Invested ' : '累计注资 '}{fmtMoney(r.total, locale)}</div>
              <div className="sector-champ">🏆 {r.champion ? r.champion.title : (en ? '(no public champion)' : '（暂无公开冠军）')}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
