import Link from 'next/link';
import { cookies } from 'next/headers';
import { searchProjects, fmtMoney } from '@/lib/queries';
import { SECTOR_LABELS, SECTOR_LABELS_EN, L } from '@/lib/engine';

export const dynamic = 'force-dynamic';

export default function SearchPage({ searchParams }) {
  const locale = cookies().get('lang')?.value === 'en' ? 'en' : 'zh';
  const en = locale === 'en';
  const q = (searchParams?.q || '').toString();
  const rows = q.trim() ? searchProjects(q) : [];

  return (
    <div>
      <h1 className="page-title">🔎 {en ? 'Search' : '搜索'}</h1>
      <form action="/search" className="search-page-form">
        <input type="text" name="q" defaultValue={q} placeholder={en ? 'Project / founder / sector / tag…' : '项目名 / 创始人 / 赛道 / 标签…'} autoFocus />
        <button className="btn" type="submit">{en ? 'Search' : '搜索'}</button>
      </form>

      {q.trim() === '' ? (
        <p className="hint">{en ? 'Enter a keyword to search public projects.' : '输入关键词搜索公开项目。'}</p>
      ) : rows.length === 0 ? (
        <p className="hint">{en ? `No projects match “${q}”.` : `没有找到与「${q}」相关的项目。`}</p>
      ) : (
        <>
          <p className="page-sub">{en ? `${rows.length} results for “${q}”` : `「${q}」找到 ${rows.length} 个项目`}</p>
          {rows.map((r) => (
            <Link href={`/bp/${r.id}`} key={r.id} className="rank-row">
              <div className="rank-main">
                <div className="rank-title">
                  {r.title} <span className="badge badge-llm">{r.kind === 'demo' ? 'Demo' : 'BP'}</span>
                  {r.sector && SECTOR_LABELS[r.sector] ? <span className="badge badge-famous">{L(SECTOR_LABELS, SECTOR_LABELS_EN, r.sector, locale)}</span> : null}
                </div>
                <div className="rank-sub">{r.founder} · {r.summary}</div>
              </div>
              <div className="rank-metrics">
                <div className="rank-amount">{fmtMoney(r.total_invested, locale)}</div>
              </div>
            </Link>
          ))}
        </>
      )}
    </div>
  );
}
