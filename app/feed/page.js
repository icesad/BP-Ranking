import Link from 'next/link';
import { cookies } from 'next/headers';
import { getDb } from '@/lib/db';
import { recentNotifications } from '@/lib/ranks';
import RescoreButton from '@/components/RescoreButton';

export const dynamic = 'force-dynamic';

const META = {
  rank_up: { icon: '📈', cls: 'feed-up', verb: '排名上升', verbEn: 'Rank up' },
  rank_down: { icon: '📉', cls: 'feed-down', verb: '排名下滑', verbEn: 'Rank down' },
  new_entry: { icon: '🆕', cls: 'feed-new', verb: '新项目登场', verbEn: 'New entry' },
  re_entry: { icon: '⚔️', cls: 'feed-re', verb: '重新参战', verbEn: 'Re-entered' },
};

export default function FeedPage() {
  const en = cookies().get('lang')?.value === 'en';
  const db = getDb();
  const items = recentNotifications(db, 80);
  const titleOf = (n) => (n.visibility === 'ai_only' ? (en ? '🔒 A mystery project (AI-only)' : '🔒 一份神秘的项目（仅AI可见）') : n.title);

  return (
    <div>
      <h1 className="page-title">📣 {en ? 'Live Feed' : '实时动态'} <Link href="/weekly" style={{ fontSize: 14, color: 'var(--accent)' }}>· 📰 {en ? 'This week →' : '本周风云 →'}</Link></h1>
      <p className="page-sub">{en ? 'Rebalances, rank moves and re-entries show up here. Come back to see if your project got passed.' : '投资人调仓、排名涨跌与重新参战，都会出现在这里。常回来看看你的项目有没有被超越。'}</p>

      <RescoreButton en={en} />

      {items.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', color: 'var(--text2)' }}>
          {en ? <>No activity yet. Upload a project, or hit <code>/api/tick</code> to trigger a rebalance.</> : <>还没有动态。上传一个项目，或访问 <code>/api/tick</code> 触发一次全局调仓试试。</>}
        </div>
      ) : (
        <div className="feed-list">
          {items.map((n) => {
            const m = META[n.type] || META.new_entry;
            const isPublic = n.visibility === 'public';
            const t = titleOf(n);
            const kindTag = n.kind === 'demo' ? (en ? 'Demo' : 'Demo榜') : (en ? 'BP' : 'BP榜');
            const detail = (n.type === 'rank_up' || n.type === 'rank_down')
              ? (en ? `#${n.rank_from} → #${n.rank_to}` : `第 ${n.rank_from} 名 → 第 ${n.rank_to} 名`)
              : n.type === 're_entry'
                ? (en ? `re-entered${n.rank_from && n.rank_to ? `, #${n.rank_from} → #${n.rank_to}` : ''}` : (n.body || `重新参战${n.rank_from && n.rank_to ? `，第 ${n.rank_from} → ${n.rank_to} 名` : ''}`))
                : (en ? `first listed at #${n.rank_to}` : (n.body || `首次上榜第 ${n.rank_to} 名`));
            const inner = (
              <>
                <div className={`feed-icon ${m.cls}`}>{m.icon}</div>
                <div className="feed-main">
                  <div className="feed-title">{t} <span className="badge badge-llm">{kindTag}</span></div>
                  <div className="feed-detail">{en ? m.verbEn : m.verb} · {detail}</div>
                </div>
                <div className="feed-time">{(n.created_at || '').slice(5, 16)}</div>
              </>
            );
            return isPublic
              ? <Link key={n.id} href={`/bp/${n.bp_id}`} className="feed-row">{inner}</Link>
              : <div key={n.id} className="feed-row" style={{ opacity: 0.7 }}>{inner}</div>;
          })}
        </div>
      )}
    </div>
  );
}
