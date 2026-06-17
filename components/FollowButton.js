'use client';
import { useEffect, useState } from 'react';

const KEY = 'bpr_follows';
function readLocal() { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } }
function writeLocal(arr) { try { localStorage.setItem(KEY, JSON.stringify(arr)); } catch {} }

// 登录后关注存账户(服务端)；未登录回退本机 localStorage。
export default function FollowButton({ bpId }) {
  const [followed, setFollowed] = useState(false);
  const [loggedIn, setLoggedIn] = useState(null); // null=未知

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const me = await fetch('/api/me').then((r) => r.json());
        if (!alive) return;
        if (me.user) {
          setLoggedIn(true);
          const { ids } = await fetch('/api/follow').then((r) => r.json());
          if (alive) setFollowed(Array.isArray(ids) && ids.includes(bpId));
        } else {
          setLoggedIn(false);
          setFollowed(readLocal().includes(bpId));
        }
      } catch { if (alive) { setLoggedIn(false); setFollowed(readLocal().includes(bpId)); } }
    })();
    return () => { alive = false; };
  }, [bpId]);

  async function toggle() {
    if (loggedIn) {
      try {
        const r = await fetch('/api/follow', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bpId }) }).then((x) => x.json());
        setFollowed(!!r.followed);
      } catch {}
    } else {
      const cur = readLocal();
      const next = cur.includes(bpId) ? cur.filter((x) => x !== bpId) : [...cur, bpId];
      writeLocal(next);
      setFollowed(next.includes(bpId));
    }
  }

  return (
    <button type="button" className={`btn ${followed ? '' : 'btn-ghost'}`} onClick={toggle}>
      {followed ? '★ 已关注' : '☆ 关注此项目'}
    </button>
  );
}
