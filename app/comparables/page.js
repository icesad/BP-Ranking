import Link from 'next/link';
import { cookies } from 'next/headers';
import { comparablesOverview } from '@/lib/queries';
import { SECTOR_LABELS, SECTOR_LABELS_EN, L } from '@/lib/engine';

export const dynamic = 'force-dynamic';

const TIER = {
  star: { zh: '明星', en: 'Star' }, popular: { zh: '热门', en: 'Popular' },
  traction: { zh: '有起色', en: 'Traction' }, toy: { zh: '玩具级', en: 'Toy' },
};

export default function ComparablesPage() {
  const locale = cookies().get('lang')?.value === 'en' ? 'en' : 'zh';
  const en = locale === 'en';
  const { total, funded, sectorCount, sectors } = comparablesOverview();

  return (
    <div>
      <h1 className="page-title">📚 {en ? 'Comparables Library' : '可比项目库'}</h1>
      <p className="page-sub">{en
        ? 'Real projects (GitHub signals + verified funding) used as valuation anchors — not a leaderboard. When valuing your demo, same-sector comparables are fed to the AI investors. '
        : '真实项目（GitHub 客观信号 + 已核实融资）作为估值锚点——这不是排行榜。估值时会自动取同赛道的可比项目喂给 AI 投资人。'}
        <Link href="/demos" style={{ color: 'var(--accent)' }}>{en ? '← Demos' : '← 返回 Demo 榜'}</Link></p>

      {total === 0 ? (
        <div className="card" style={{ textAlign: 'center', color: 'var(--text2)' }}>
          {en
            ? <>Empty for now. Build it with <code>node scripts/import-comparables.js &quot;topic:ai stars:&gt;800&quot; 40</code>, then add funding via <code>node scripts/enrich-comparables.js 30</code>.</>
            : <>还是空的。先建库：<code>node scripts/import-comparables.js &quot;topic:ai stars:&gt;800&quot; 40</code>，再核查融资：<code>node scripts/enrich-comparables.js 30</code>。</>}
        </div>
      ) : (
        <>
          <div className="stats-bar">
            <div className="stat"><b>{total}</b><span>{en ? 'Comparables' : '可比项目'}</span></div>
            <div className="stat"><b>{funded}</b><span>{en ? 'With real funding 💰' : '有真金白银锚点 💰'}</span></div>
            <div className="stat"><b>{sectorCount}</b><span>{en ? 'Sectors' : '覆盖赛道'}</span></div>
          </div>

          {sectors.map((s) => (
            <div key={s.sector} style={{ marginBottom: 22 }}>
              <h2 className="section-title">
                {SECTOR_LABELS[s.sector] ? L(SECTOR_LABELS, SECTOR_LABELS_EN, s.sector, locale) : (s.sector || (en ? 'Other' : '其他'))}
                <span className="hint"> · {s.count}{en ? '' : ' 个'}{s.funded > 0 ? ` · 💰 ${s.funded}` : ''}</span>
              </h2>
              {s.items.map((c) => (
                <div key={c.id} className="rank-row">
                  <div className="rank-main">
                    <div className="rank-title">
                      <a href={c.url} target="_blank" rel="noopener noreferrer">{c.name}</a>{' '}
                      <span className="badge badge-llm">{(en ? TIER[c.tier]?.en : TIER[c.tier]?.zh) || c.tier}</span>
                      {c.archived ? <span className="badge badge-ai">{en ? 'archived' : '已停更'}</span> : null}
                    </div>
                    <div className="rank-sub">
                      {c.language || '—'} · ⭐{c.stars} · fork {c.forks}
                      {c.funding ? <> · 💰 {c.funding}{c.funding_url ? <> （<a href={c.funding_url} target="_blank" rel="noopener noreferrer">{en ? 'source' : '来源'}</a>）</> : null}</> : null}
                    </div>
                  </div>
                </div>
              ))}
              {s.more > 0 && <p className="hint">{en ? `+${s.more} more in this sector` : `该赛道还有 +${s.more} 个`}</p>}
            </div>
          ))}
          <p className="hint">{en
            ? 'Funding is auto-checked from web search with required sources; coverage is naturally low (most OSS repos have none). Spot-check the source links.'
            : '融资信息由联网搜索 + 强制来源自动核查，命中率天然偏低（多数开源项目没有融资）。建议照来源链接抽查准确性。'}</p>
        </>
      )}
    </div>
  );
}
