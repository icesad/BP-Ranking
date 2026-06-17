import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { sectorProjects, fmtMoney } from '@/lib/queries';
import { evidenceCount, SECTOR_LABELS, SECTOR_LABELS_EN, L } from '@/lib/engine';

export const dynamic = 'force-dynamic';

export default function SectorPage({ params }) {
  const locale = cookies().get('lang')?.value === 'en' ? 'en' : 'zh';
  const en = locale === 'en';
  const sector = params.sector;
  if (!SECTOR_LABELS[sector]) notFound();
  const label = L(SECTOR_LABELS, SECTOR_LABELS_EN, sector, locale);
  const rows = sectorProjects(sector);

  return (
    <div>
      <h1 className="page-title">🆚 {en ? `Sector Compare · ${label}` : `同赛道对比 · ${label}`}</h1>
      <p className="page-sub">{en ? `Side-by-side comparison of projects in “${label}”, by total investment. ` : `同属「${label}」赛道的项目横向对比，按累计虚拟注资排序。`}<Link href="/bp" style={{ color: 'var(--accent)' }}>{en ? '← Back to board' : '← 返回总榜'}</Link></p>

      {rows.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', color: 'var(--text2)' }}>{en ? 'No projects in this sector yet.' : '这个赛道还没有项目。'}</div>
      ) : (
        <div className="cmp-wrap">
          <table className="cmp-table">
            <thead>
              <tr><th>#</th><th>{en ? 'Project' : '项目'}</th><th>{en ? 'Track' : '赛道'}</th><th className="num">{en ? 'Invested' : '累计注资'}</th><th className="num">{en ? 'Avg' : '均分'}</th><th className="num">{en ? 'Investors' : '投资人'}</th><th className="num">{en ? 'Evidence' : '证据数'}</th></tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const isPublic = r.visibility === 'public';
                const ev = evidenceCount(`${r.summary} ${r.content}`);
                return (
                  <tr key={r.id}>
                    <td className="cmp-rank">{i + 1}</td>
                    <td>
                      {isPublic
                        ? <Link href={`/bp/${r.id}`} style={{ color: 'var(--text)', fontWeight: 600 }}>{r.title}</Link>
                        : <span style={{ color: 'var(--text2)' }}>{en ? '🔒 Anonymous' : '🔒 匿名项目'}</span>}
                      {isPublic && <div className="hint" style={{ marginTop: 2 }}>{r.founder}</div>}
                    </td>
                    <td><span className="badge badge-llm">{r.kind === 'demo' ? 'Demo' : 'BP'}</span></td>
                    <td className="num" style={{ color: 'var(--green)', fontWeight: 700 }}>{fmtMoney(r.total_invested, locale)}</td>
                    <td className="num">{r.avg_score ?? '-'}</td>
                    <td className="num">{r.investor_count}</td>
                    <td className="num">{r.kind === 'demo' ? '—' : ev}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="hint" style={{ marginTop: 10 }}>{en ? '“Evidence” = verifiable data points detected (numbers+units, %, years). BP only.' : '“证据数”= 系统识别到的可验证数据点（数字+单位、百分比、年份等），仅统计 BP。'}</p>
        </div>
      )}
    </div>
  );
}
