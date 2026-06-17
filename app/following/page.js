'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale } from '@/lib/useLocale';

const KEY = 'bpr_follows';

export default function FollowingPage() {
  const en = useLocale() === 'en';
  const [items, setItems] = useState(null); // null=加载中
  const [loggedIn, setLoggedIn] = useState(false);

  async function load() {
    let ids = [];
    let isIn = false;
    try {
      const me = await fetch('/api/me').then((r) => r.json());
      if (me.user) { isIn = true; const r = await fetch('/api/follow').then((x) => x.json()); ids = Array.isArray(r.ids) ? r.ids : []; }
    } catch {}
    setLoggedIn(isIn);
    if (!isIn) { try { ids = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch {} }
    if (ids.length === 0) { setItems([]); return; }
    try {
      const res = await fetch('/api/following', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      const data = await res.json();
      setItems(data.items || []);
    } catch { setItems([]); }
  }

  useEffect(() => { load(); }, []);

  async function unfollow(id) {
    if (loggedIn) {
      try { await fetch('/api/follow', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bpId: id }) }); } catch {}
    } else {
      let ids = [];
      try { ids = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch {}
      try { localStorage.setItem(KEY, JSON.stringify(ids.filter((x) => x !== id))); } catch {}
    }
    setItems((items || []).filter((it) => it.id !== id));
  }

  return (
    <div>
      <h1 className="page-title">★ {en ? 'Following' : '我的关注'}</h1>
      <p className="page-sub">{en ? 'Your saved projects, with their latest rank and moves (saved in this browser).' : '收藏的项目集中在这里，随时看它们的最新名次与涨跌（收藏存在本机浏览器）。'}</p>

      {items === null && <p className="hint">{en ? 'Loading…' : '加载中…'}</p>}

      {items !== null && items.length === 0 && (
        <div className="card" style={{ textAlign: 'center', color: 'var(--text2)' }}>
          {en ? <>Not following anything yet. Open a project on the <Link href="/bp" style={{ color: 'var(--accent)' }}>BP board</Link> and tap “☆ Follow”.</> : <>还没有关注任何项目。去 <Link href="/bp" style={{ color: 'var(--accent)' }}>BP 榜</Link> 点开一个项目，点「☆ 关注此项目」即可。</>}
        </div>
      )}

      {items !== null && items.length > 0 && items.map((it) => (
        <div key={it.id} className="rank-row" style={{ cursor: 'default' }}>
          <div className="rank-num">{it.rank ?? '-'}</div>
          <div className="rank-main">
            <div className="rank-title">
              <Link href={`/bp/${it.id}`} style={{ color: 'inherit' }}>{it.title}</Link>
              {it.lastChange && it.lastChange.delta !== 0 && (
                <span className={`rank-delta ${it.lastChange.delta > 0 ? 'rank-delta-up' : 'rank-delta-down'}`}>
                  {it.lastChange.delta > 0 ? '▲' : '▼'}{Math.abs(it.lastChange.delta)}
                </span>
              )}
            </div>
            <div className="rank-sub">{it.founder} · {it.kind === 'demo' ? 'Demo' : 'BP'}</div>
          </div>
          <div className="rank-metrics">
            <div className="rank-amount">{it.totalText}</div>
            <button className="btn btn-ghost" style={{ padding: '2px 10px', fontSize: 12 }} onClick={() => unfollow(it.id)}>{en ? 'Unfollow' : '取消关注'}</button>
          </div>
        </div>
      ))}
    </div>
  );
}
