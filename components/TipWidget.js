'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

// 打赏：用积分支持作者（需登录、作品有作者、非本人）。
export default function TipWidget({ bpId, ownerHandle = '', ownerUserId = null, total = 0, count = 0, en = false }) {
  const [me, setMe] = useState(undefined); // undefined=加载中 null=未登录
  const [sum, setSum] = useState(total);
  const [n, setN] = useState(count);
  const [amt, setAmt] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  useEffect(() => { fetch('/api/me').then((r) => r.json()).then((d) => setMe(d.user)).catch(() => setMe(null)); }, []);

  const isOwner = me && ownerUserId && me.uid === ownerUserId;
  const hasOwner = !!ownerUserId;

  async function tip() {
    const a = Math.floor(Number(amt));
    if (!(a > 0)) { setMsg(en ? 'Enter points' : '请输入打赏积分'); return; }
    setBusy(true); setMsg('');
    try {
      const r = await fetch('/api/tip', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bpId, amount: a, message: msg }) }).then((x) => x.json());
      if (r.error) { setMsg('⚠️ ' + r.error); }
      else { setSum(r.total); setN((v) => v + 1); setAmt(''); setMe((u) => ({ ...u, points: r.balance })); setMsg(en ? '✅ Thanks for the tip!' : '✅ 打赏成功，感谢支持！'); router.refresh(); }
    } catch { setMsg(en ? 'Failed' : '打赏失败'); }
    setBusy(false);
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
        <h3 style={{ margin: 0 }}>💝 {en ? 'Tip the creator' : '打赏作者'}</h3>
        <span className="hint">{en ? 'Received ' : '累计打赏 '}<b style={{ color: 'var(--gold)' }}>{sum}</b> {en ? 'pts' : '积分'} · {n} {en ? 'tips' : '次'}</span>
      </div>
      {me === undefined ? null : !hasOwner ? (
        <p className="hint" style={{ marginTop: 8 }}>{en ? 'This work has no linked author account yet — tipping unavailable.' : '该作品暂未绑定作者账户，无法打赏。'}</p>
      ) : isOwner ? (
        <p className="hint" style={{ marginTop: 8 }}>{en ? 'This is your work. Tips from others appear here.' : '这是你的作品，他人的打赏会显示在这里。'}</p>
      ) : !me ? (
        <p className="hint" style={{ marginTop: 8 }}><a href="/api/auth/github" style={{ color: 'var(--accent)' }}>{en ? 'Sign in' : '登录'}</a> {en ? 'to tip with points.' : '后可用积分打赏。'}</p>
      ) : (
        <div style={{ marginTop: 10 }}>
          <div className="hint" style={{ marginBottom: 6 }}>{en ? 'Your balance: ' : '我的积分：'}<b>{me.points}</b></div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[10, 50, 100].map((v) => <button key={v} type="button" className="btn btn-ghost" style={{ padding: '4px 10px' }} onClick={() => setAmt(String(v))}>{v}</button>)}
            <input type="number" min="1" value={amt} placeholder={en ? 'points' : '积分'} onChange={(e) => setAmt(e.target.value)} style={{ width: 90 }} />
            <input type="text" value={msg.startsWith('✅') || msg.startsWith('⚠️') ? '' : msg} maxLength={140} placeholder={en ? 'message (optional)' : '留言(可选)'} onChange={(e) => setMsg(e.target.value)} style={{ flex: 1, minWidth: 120 }} />
            <button className="btn" onClick={tip} disabled={busy}>{busy ? '…' : (en ? 'Tip' : '打赏')}</button>
          </div>
        </div>
      )}
      {msg && (msg.startsWith('✅') || msg.startsWith('⚠️')) ? <p className="hint" style={{ marginTop: 6 }}>{msg}</p> : null}
    </div>
  );
}
