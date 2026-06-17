'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

// 发布需求 / 自荐资源（登录后可用）。types: {key:label}
export default function ResourceForms({ tab = 'needs', types = {}, en = false }) {
  const router = useRouter();
  const [me, setMe] = useState(undefined);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const keys = Object.keys(types);
  const [f, setF] = useState({ type: keys[0] || 'other', title: '', detail: '', region: '', contact: '' });

  useEffect(() => { fetch('/api/me').then((r) => r.json()).then((d) => setMe(d.user)).catch(() => setMe(null)); }, []);

  async function submit() {
    setBusy(true); setMsg('');
    const url = tab === 'resources' ? '/api/resources' : '/api/needs';
    const body = tab === 'resources'
      ? { type: f.type, title: f.title, detail: f.detail, region: f.region, contact: f.contact }
      : { type: f.type, detail: f.detail, region: f.region };
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then((x) => x.json());
      if (r.error) setMsg('⚠️ ' + r.error);
      else { setMsg(en ? '✅ Posted' : '✅ 已发布'); setOpen(false); setF({ ...f, title: '', detail: '', region: '', contact: '' }); router.refresh(); }
    } catch { setMsg(en ? 'Failed' : '发布失败'); }
    setBusy(false);
  }

  if (me === undefined) return null;
  if (!me) return <p className="hint" style={{ marginBottom: 12 }}><a href="/api/auth/github" style={{ color: 'var(--accent)' }}>{en ? 'Sign in' : '登录'}</a> {en ? 'to post.' : '后可发布需求 / 自荐资源。'}</p>;

  return (
    <div style={{ marginBottom: 14 }}>
      {!open ? (
        <button className="btn" onClick={() => setOpen(true)}>{tab === 'resources' ? (en ? '+ Offer a resource' : '+ 自荐为资源/服务方') : (en ? '+ Post a need' : '+ 发布需求')}</button>
      ) : (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
            {keys.map((k) => <option key={k} value={k}>{types[k]}</option>)}
          </select>
          {tab === 'resources' && <input type="text" value={f.title} maxLength={80} placeholder={en ? 'Title, e.g. “ICP filing agent (Shanghai)”' : '标题，如「代办 ICP 备案（上海）」'} onChange={(e) => setF({ ...f, title: e.target.value })} />}
          <textarea value={f.detail} maxLength={500} placeholder={tab === 'resources' ? (en ? 'What you offer' : '你能提供什么、范围、案例…') : (en ? 'What you need help with' : '你卡在哪、需要什么帮助…')} style={{ height: 70 }} onChange={(e) => setF({ ...f, detail: e.target.value })} />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input type="text" value={f.region} maxLength={30} placeholder={en ? 'Region (optional)' : '地区(可选)'} style={{ width: 140 }} onChange={(e) => setF({ ...f, region: e.target.value })} />
            {tab === 'resources' && <input type="text" value={f.contact} maxLength={120} placeholder={en ? 'Contact (optional; profile links also work)' : '联系方式(可选，也可走主页社媒)'} style={{ flex: 1, minWidth: 160 }} onChange={(e) => setF({ ...f, contact: e.target.value })} />}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={submit} disabled={busy}>{busy ? '…' : (en ? 'Post' : '发布')}</button>
            <button className="btn btn-ghost" onClick={() => setOpen(false)}>{en ? 'Cancel' : '取消'}</button>
          </div>
        </div>
      )}
      {msg ? <p className="hint" style={{ marginTop: 6 }}>{msg}</p> : null}
    </div>
  );
}
