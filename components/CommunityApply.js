'use client';
import { useState } from 'react';

// 社区报名页表单：填入驻意向 + 联系方式 → 提交。未登录引导登录；已申请过则预填。
export default function CommunityApply({ communityId, applied = false, loggedIn = false, en = false }) {
  const [note, setNote] = useState('');
  const [contact, setContact] = useState('');
  const [state, setState] = useState(applied ? 'done0' : 'idle'); // idle | sending | done | done0(已申请过) | login

  async function submit() {
    if (!loggedIn) { setState('login'); return; }
    setState('sending');
    try {
      const r = await fetch('/api/communities/apply', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ communityId, note, contact }) });
      if (r.status === 401) { setState('login'); return; }
      if (!r.ok) throw new Error('fail');
      setState('done');
    } catch { setState('idle'); alert(en ? 'Failed, please retry.' : '提交失败，请重试。'); }
  }

  if (state === 'login') {
    return (
      <div className="card">
        <p>{en ? 'Please sign in to apply to join.' : '报名入驻需要先登录。'}</p>
        <a className="btn" href="/api/auth/github" style={{ display: 'inline-block', marginTop: 8 }}>{en ? 'Sign in with GitHub' : 'GitHub 登录'}</a>
      </div>
    );
  }
  if (state === 'done') {
    return (
      <div className="card">
        <h3 style={{ marginTop: 0 }}>✅ {en ? 'Application submitted' : '入驻意向已提交'}</h3>
        <p className="hint">{en ? 'The community / operator can follow up via your profile. Re-submit anytime to update.' : '社区 / 运营方可通过你的主页联系你。需要修改可随时再次提交。'}</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>📝 {en ? 'Apply to join' : '报名入驻'}</h3>
      {state === 'done0' ? <div className="hint" style={{ marginBottom: 8, color: 'var(--accent)' }}>{en ? 'You already applied — submit again to update.' : '你已申请过，可再次提交以更新意向。'}</div> : null}
      <label className="hint" style={{ display: 'block', marginBottom: 4 }}>{en ? 'Your intro / what you need (optional)' : '入驻意向 / 你的项目与需求（选填）'}</label>
      <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={4}
        placeholder={en ? 'e.g. solo AI tool dev, need a desk + early-stage peers' : '例：独立 AI 工具开发者，想要工位 + 早期同行交流'}
        style={{ width: '100%', background: 'var(--bg2,#0e1422)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', fontSize: 14, resize: 'vertical' }} />
      <label className="hint" style={{ display: 'block', margin: '12px 0 4px' }}>{en ? 'Contact (optional; your profile is used by default)' : '联系方式（选填，默认走你的主页）'}</label>
      <input value={contact} onChange={(e) => setContact(e.target.value)}
        placeholder={en ? 'WeChat / email / phone' : '微信 / 邮箱 / 电话'}
        style={{ width: '100%', background: 'var(--bg2,#0e1422)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', fontSize: 14 }} />
      <button className="btn" onClick={submit} disabled={state === 'sending'} style={{ marginTop: 14, width: '100%', cursor: 'pointer' }}>
        {state === 'sending' ? (en ? 'Submitting…' : '提交中…') : (en ? 'Submit application' : '提交报名')}
      </button>
    </div>
  );
}
