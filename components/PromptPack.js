'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

// 提示词工程包（可复刻工具箱）：作者填 用的LLM/版本、技术栈标签、以及分条目的可复刻资产
// (CLAUDE.md / SKILL / 插件 / 提示词 / 工作流 / 配置)；买家先看清单，付费解锁全部内容。
const KIND_META = {
  claude_md: { zh: 'CLAUDE.md', en: 'CLAUDE.md', icon: '📋' },
  skill: { zh: 'Skill 技能', en: 'Skill', icon: '🛠' },
  plugin: { zh: '插件', en: 'Plugin', icon: '🔌' },
  prompt: { zh: '提示词', en: 'Prompt', icon: '💬' },
  workflow: { zh: '工作流', en: 'Workflow', icon: '🧭' },
  config: { zh: '配置/MCP', en: 'Config/MCP', icon: '⚙️' },
  other: { zh: '其他', en: 'Other', icon: '📦' },
};
const KIND_ORDER = ['claude_md', 'skill', 'plugin', 'prompt', 'workflow', 'config', 'other'];
const kindLabel = (k, en) => (KIND_META[k] ? `${KIND_META[k].icon} ${KIND_META[k][en ? 'en' : 'zh']}` : k);

function emptyForm(p) {
  return {
    title: p?.title || '', preview: p?.preview || '', body: p?.body || '',
    price: p?.price || 0, llm: p?.llm || '',
    stackText: (p?.stack || []).join(', '),
    assets: (p?.assets || []).map((a) => ({ kind: a.kind || 'other', title: a.title || '', content: a.content || '' })),
  };
}

export default function PromptPack({ bpId, isOwnerOfBp = false, initial = null, en = false }) {
  const router = useRouter();
  const [me, setMe] = useState(undefined);
  const [pack, setPack] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(emptyForm(initial));
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { fetch('/api/me').then((r) => r.json()).then((d) => setMe(d.user)).catch(() => setMe(null)); }, []);

  function startEdit() { setForm(emptyForm(pack)); setEditing(true); setMsg(''); }
  function setAsset(i, patch) { setForm((f) => ({ ...f, assets: f.assets.map((a, j) => (j === i ? { ...a, ...patch } : a)) })); }
  function addAsset() { setForm((f) => ({ ...f, assets: [...f.assets, { kind: 'claude_md', title: '', content: '' }] })); }
  function delAsset(i) { setForm((f) => ({ ...f, assets: f.assets.filter((_, j) => j !== i) })); }

  async function save() {
    if (!form.body.trim() && form.assets.length === 0) { setMsg(en ? 'Add an overview or at least one asset' : '请填写总览或至少一个资产'); return; }
    setBusy(true); setMsg('');
    const payload = {
      title: form.title, preview: form.preview, body: form.body, price: form.price, llm: form.llm,
      stack: form.stackText.split(/[,，\s]+/).map((s) => s.trim()).filter(Boolean),
      assets: form.assets.filter((a) => a.title || a.content),
    };
    try {
      const r = await fetch(`/api/pack/${bpId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).then((x) => x.json());
      if (r.error) setMsg('⚠️ ' + r.error);
      else { setPack(r.pack); setEditing(false); setMsg(en ? '✅ Saved' : '✅ 已保存'); router.refresh(); }
    } catch { setMsg(en ? 'Failed' : '保存失败'); }
    setBusy(false);
  }
  async function buy() {
    setBusy(true); setMsg('');
    try {
      const r = await fetch(`/api/pack/${bpId}/buy`, { method: 'POST' }).then((x) => x.json());
      if (r.error) setMsg('⚠️ ' + r.error);
      else { setPack(r.pack); setMe((u) => u ? { ...u, points: r.balance } : u); setMsg(en ? '✅ Unlocked' : '✅ 已解锁'); router.refresh(); }
    } catch { setMsg(en ? 'Failed' : '购买失败'); }
    setBusy(false);
  }

  const Meta = ({ p }) => (
    <>
      {p.llm ? <div className="hint" style={{ marginTop: 4 }}>🧠 {en ? 'Built with ' : '所用 LLM：'}<b>{p.llm}</b></div> : null}
      {p.stack && p.stack.length ? <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '6px 0' }}>{p.stack.map((s, i) => <span key={i} className="badge badge-public">{s}</span>)}</div> : null}
    </>
  );
  const Manifest = ({ list }) => list && list.length ? (
    <div style={{ marginTop: 8 }}>
      <div className="hint" style={{ marginBottom: 4 }}>{en ? 'Includes (unlock to view full):' : '包含内容（解锁后可看全文）：'}</div>
      {list.map((a, i) => <div key={i} className="hint" style={{ paddingLeft: 6 }}>{kindLabel(a.kind, en)} · {a.title || '—'}</div>)}
    </div>
  ) : null;

  const editor = (
    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <input type="text" value={form.title} maxLength={80} placeholder={en ? 'Pack title' : '标题，如「我是怎么用 AI 做出它的」'} onChange={(e) => setForm({ ...form, title: e.target.value })} />
      <input type="text" value={form.llm} maxLength={60} placeholder={en ? 'LLM & version, e.g. Claude Opus 4.8' : '用的 LLM 及版本，如 Claude Opus 4.8 / DeepSeek-R1'} onChange={(e) => setForm({ ...form, llm: e.target.value })} />
      <input type="text" value={form.stackText} placeholder={en ? 'Stack tags (comma sep): Cursor, Tavily MCP…' : '技术栈标签(逗号分隔)：Cursor, Claude Code, Tavily MCP…'} onChange={(e) => setForm({ ...form, stackText: e.target.value })} />
      <textarea value={form.preview} maxLength={800} placeholder={en ? 'Free preview (everyone sees)' : '免费预览（人人可见，勾起购买欲）'} style={{ height: 50 }} onChange={(e) => setForm({ ...form, preview: e.target.value })} />
      <textarea value={form.body} maxLength={20000} placeholder={en ? 'Overview / how you built it (paid)' : '总览：整体怎么做出来的（付费正文）'} style={{ height: 90 }} onChange={(e) => setForm({ ...form, body: e.target.value })} />

      <div className="hint" style={{ marginTop: 4 }}>{en ? 'Replicable assets (unlocked on purchase):' : '可复刻资产（购买后解锁全文）：'}</div>
      {form.assets.map((a, i) => (
        <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <select value={a.kind} onChange={(e) => setAsset(i, { kind: e.target.value })}>
              {KIND_ORDER.map((k) => <option key={k} value={k}>{KIND_META[k][en ? 'en' : 'zh']}</option>)}
            </select>
            <input type="text" value={a.title} maxLength={80} placeholder={en ? 'asset title, e.g. CLAUDE.md' : '条目标题，如 CLAUDE.md / 自测 skill'} style={{ flex: 1 }} onChange={(e) => setAsset(i, { title: e.target.value })} />
            <button type="button" className="btn btn-ghost" style={{ padding: '2px 8px' }} onClick={() => delAsset(i)}>✕</button>
          </div>
          <textarea value={a.content} maxLength={20000} placeholder={en ? 'full content (file text / prompt / config)' : '完整内容（文件原文 / 提示词 / 配置）'} style={{ height: 80, fontFamily: 'ui-monospace,Consolas,monospace', fontSize: 12 }} onChange={(e) => setAsset(i, { content: e.target.value })} />
        </div>
      ))}
      <button type="button" className="btn btn-ghost" style={{ alignSelf: 'flex-start' }} onClick={addAsset}>+ {en ? 'Add asset' : '添加资产'}</button>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 4 }}>
        <label className="hint">{en ? 'Price (points, 0=free): ' : '定价（积分，0=免费）：'}</label>
        <input type="number" min="0" value={form.price} style={{ width: 100 }} onChange={(e) => setForm({ ...form, price: e.target.value })} />
        <button className="btn" onClick={save} disabled={busy}>{busy ? '…' : (en ? 'Save' : '保存')}</button>
        {pack ? <button className="btn btn-ghost" onClick={() => setEditing(false)}>{en ? 'Cancel' : '取消'}</button> : null}
      </div>
    </div>
  );

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
        <h3 style={{ margin: 0 }}>🧩 {en ? 'Build kit & prompts' : '作者的提示词工程 / 复刻工具箱'}</h3>
        {pack && pack.buyers > 0 ? <span className="hint">{pack.buyers} {en ? 'buyers' : '人已购'}</span> : null}
      </div>

      {isOwnerOfBp ? (
        editing || !pack ? editor : (
          <div style={{ marginTop: 8 }}>
            <div className="rank-title">{pack.title || (en ? 'Untitled' : '未命名')}</div>
            <Meta p={pack} />
            <p className="hint" style={{ whiteSpace: 'pre-wrap' }}>{pack.preview}</p>
            <Manifest list={pack.assetList} />
            <div className="hint" style={{ marginTop: 6 }}>{en ? 'Price ' : '定价 '}{pack.price > 0 ? `${pack.price} ${en ? 'pts' : '积分'}` : (en ? 'Free' : '免费')} · {pack.buyers} {en ? 'sold' : '人购买'}</div>
            <button className="btn btn-ghost" style={{ marginTop: 8 }} onClick={startEdit}>{en ? 'Edit' : '编辑'}</button>
          </div>
        )
      ) : !pack ? (
        <p className="hint" style={{ marginTop: 8 }}>{en ? 'The author hasn’t shared a build kit for this project.' : '作者还没有为这个作品分享复刻工具箱。'}</p>
      ) : (
        <div style={{ marginTop: 8 }}>
          <div className="rank-title">{pack.title || (en ? 'Build kit' : '复刻工具箱')}</div>
          <Meta p={pack} />
          <p className="hint" style={{ whiteSpace: 'pre-wrap' }}>{pack.preview}</p>
          {pack.unlocked ? (
            <div style={{ marginTop: 8 }}>
              {pack.body ? <div style={{ padding: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: 8, whiteSpace: 'pre-wrap', fontSize: 14, marginBottom: 10 }}>{pack.body}</div> : null}
              {pack.assets.map((a, i) => (
                <div key={i} style={{ marginBottom: 10 }}>
                  <div className="rank-sub" style={{ fontWeight: 600 }}>{kindLabel(a.kind, en)} · {a.title}</div>
                  <pre style={{ margin: '4px 0 0', padding: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: 8, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 12, fontFamily: 'ui-monospace,Consolas,monospace' }}>{a.content}</pre>
                </div>
              ))}
            </div>
          ) : (
            <>
              <Manifest list={pack.assetList} />
              <div style={{ marginTop: 10 }}>
                {me === undefined ? null : !me ? (
                  <p className="hint"><a href="/api/auth/github" style={{ color: 'var(--accent)' }}>{en ? 'Sign in' : '登录'}</a> {en ? `to unlock for ${pack.price} pts.` : `后用 ${pack.price} 积分解锁全部。`}</p>
                ) : (
                  <>
                    <div className="hint" style={{ marginBottom: 6 }}>{en ? 'Your balance: ' : '我的积分：'}<b>{me.points}</b></div>
                    <button className="btn" onClick={buy} disabled={busy}>{busy ? '…' : (en ? `Unlock all for ${pack.price} pts` : `${pack.price} 积分解锁全部`)}</button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      )}
      {msg ? <p className="hint" style={{ marginTop: 6 }}>{msg}</p> : null}
    </div>
  );
}
