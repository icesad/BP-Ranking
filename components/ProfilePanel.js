'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

const AXES = ['tech', 'product', 'business', 'aesthetic', 'vision', 'originality', 'execution', 'influence'];
const AX_LABEL = {
  tech: { zh: '技术力', en: 'Tech' }, product: { zh: '产品·痛点', en: 'Product' },
  business: { zh: '商业洞见', en: 'Business' }, aesthetic: { zh: '审美', en: 'Aesthetic' },
  vision: { zh: '视野·野心', en: 'Vision' }, originality: { zh: '创意·原创', en: 'Originality' },
  execution: { zh: '落地·完成', en: 'Execution' }, influence: { zh: '影响力·受众', en: 'Influence' },
};
const PLATFORMS = [['xiaohongshu', '小红书'], ['x', 'X/Twitter'], ['bilibili', 'B站'], ['github', 'GitHub'], ['site', '个人站'], ['other', '其他']];
const platLabel = (p) => (PLATFORMS.find((x) => x[0] === p)?.[1] || p);

function Radar({ dims, en }) {
  const size = 220, cx = size / 2, cy = size / 2, R = 78, N = AXES.length;
  const pt = (i, r) => { const a = -Math.PI / 2 + (i * 2 * Math.PI) / N; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; };
  const ring = (f) => AXES.map((_, i) => pt(i, R * f).join(',')).join(' ');
  const poly = AXES.map((d, i) => pt(i, R * (Math.max(0, Math.min(100, Number(dims?.[d]) || 0)) / 100)).join(',')).join(' ');
  return (
    <svg viewBox={`0 0 ${size} ${size}`} style={{ width: '100%', maxWidth: 260, display: 'block' }}>
      {[0.25, 0.5, 0.75, 1].map((f) => <polygon key={f} points={ring(f)} fill="none" stroke="var(--border)" strokeWidth="1" />)}
      {AXES.map((d, i) => { const [x, y] = pt(i, R); return <line key={d} x1={cx} y1={cy} x2={x} y2={y} stroke="var(--border)" strokeWidth="1" />; })}
      <polygon points={poly} fill="rgba(120,140,255,0.18)" stroke="var(--accent)" strokeWidth="1.5" />
      {AXES.map((d, i) => { const [x, y] = pt(i, R + 16); return <text key={d} x={x} y={y} fontSize="9" fill="var(--text2)" textAnchor="middle" dominantBaseline="middle">{AX_LABEL[d][en ? 'en' : 'zh']}</text>; })}
    </svg>
  );
}

export default function ProfilePanel({ profile = null, socials = [], isMe = false, en = false }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [editing, setEditing] = useState(false);
  const [rows, setRows] = useState(socials.length ? socials : [{ platform: 'xiaohongshu', url: '' }]);

  async function build() {
    setBusy(true); setMsg('');
    try {
      const r = await fetch('/api/profile/build', { method: 'POST' }).then((x) => x.json());
      if (r.error) setMsg('⚠️ ' + r.error);
      else { setMsg(en ? `✅ Done (based on ${r.basedOn} works)` : `✅ 已生成（基于 ${r.basedOn} 个作品）`); router.refresh(); }
    } catch { setMsg(en ? 'Failed' : '生成失败'); }
    setBusy(false);
  }
  async function saveSocials() {
    setBusy(true); setMsg('');
    try {
      const r = await fetch('/api/socials', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ socials: rows.filter((x) => x.url.trim()) }) }).then((x) => x.json());
      if (r.error) setMsg('⚠️ ' + r.error);
      else { setEditing(false); setMsg(en ? '✅ Saved (regenerate to refresh profile)' : '✅ 已保存（重新生成画像可纳入）'); router.refresh(); }
    } catch { setMsg(en ? 'Failed' : '保存失败'); }
    setBusy(false);
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
        <h3 style={{ margin: 0 }}>🧬 {en ? 'Profile (from works + social)' : '能力画像（基于作品 + 社媒）'}</h3>
        {profile ? <span className="hint">{en ? `based on ${profile.basedOn} works` : `基于 ${profile.basedOn} 个作品`}{profile.updatedAt ? ` · ${String(profile.updatedAt).slice(0, 10)}` : ''}</span> : null}
      </div>

      {profile ? (
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginTop: 8 }}>
          <div style={{ flex: '0 0 260px' }}><Radar dims={profile.dims} en={en} /></div>
          <div style={{ flex: '1 1 280px', minWidth: 240 }}>
            {profile.themes?.length ? <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>{profile.themes.map((t, i) => <span key={i} className="badge badge-llm">{t}</span>)}</div> : null}
            <p style={{ whiteSpace: 'pre-wrap', fontSize: 14 }}>{profile.summary}</p>
            {profile.social_summary ? <p className="hint" style={{ whiteSpace: 'pre-wrap' }}>📡 {en ? 'Social (unverified): ' : '社媒(未核实)：'}{profile.social_summary}</p> : null}
          </div>
        </div>
      ) : (
        <p className="hint" style={{ marginTop: 8 }}>{isMe ? (en ? 'No profile yet — generate one from your works (and social links if added).' : '还没有画像——基于你的作品（及已填社媒）生成一份。') : (en ? 'This user hasn’t generated a profile yet.' : '该用户还没有生成画像。')}</p>
      )}

      {/* 社媒链接展示 */}
      {socials.length > 0 && !editing ? (
        <div className="hint" style={{ marginTop: 8 }}>{en ? 'Links: ' : '社媒：'}{socials.map((s, i) => <span key={i}>{i > 0 ? ' · ' : ''}<a href={s.url} target="_blank" rel="noopener noreferrer nofollow">{platLabel(s.platform)} ↗</a></span>)} <span style={{ opacity: 0.6 }}>（{en ? 'unverified' : '未核实'}）</span></div>
      ) : null}

      {/* 本人控制 */}
      {isMe ? (
        <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
          {!editing ? (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn" onClick={build} disabled={busy}>{busy ? '…' : (profile ? (en ? 'Regenerate profile' : '重新生成画像') : (en ? 'Generate my profile' : '生成我的画像'))}</button>
              <button className="btn btn-ghost" onClick={() => { setRows(socials.length ? socials : [{ platform: 'xiaohongshu', url: '' }]); setEditing(true); }}>{en ? 'Manage social links' : '管理社媒链接'}</button>
            </div>
          ) : (
            <div>
              <div className="hint" style={{ marginBottom: 6 }}>{en ? 'Your social links (unverified, used as soft signal):' : '你的社媒链接（未核实，作为软信号喂画像）：'}</div>
              {rows.map((r, i) => (
                <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                  <select value={r.platform} onChange={(e) => setRows(rows.map((x, j) => j === i ? { ...x, platform: e.target.value } : x))}>
                    {PLATFORMS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                  <input type="url" value={r.url} placeholder="https://..." style={{ flex: 1 }} onChange={(e) => setRows(rows.map((x, j) => j === i ? { ...x, url: e.target.value } : x))} />
                  <button type="button" className="btn btn-ghost" style={{ padding: '2px 8px' }} onClick={() => setRows(rows.filter((_, j) => j !== i))}>✕</button>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="btn btn-ghost" onClick={() => setRows([...rows, { platform: 'other', url: '' }])}>+ {en ? 'Add' : '添加'}</button>
                <button className="btn" onClick={saveSocials} disabled={busy}>{busy ? '…' : (en ? 'Save links' : '保存')}</button>
                <button className="btn btn-ghost" onClick={() => setEditing(false)}>{en ? 'Cancel' : '取消'}</button>
              </div>
            </div>
          )}
          {msg ? <p className="hint" style={{ marginTop: 6 }}>{msg}</p> : null}
          <p className="hint" style={{ marginTop: 6, fontSize: 11 }}>{en ? 'Profile is inferred from your works (verifiable) + self-declared social public info (unverified). For reference only.' : '画像基于你的作品(可验证) + 自报社媒的公开信息(未核实)综合，仅供参考。'}</p>
        </div>
      ) : null}
    </div>
  );
}
