'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from '@/lib/useLocale';
import ScoringNote from '@/components/ScoringNote';

export default function UploadDemoPage() {
  const router = useRouter();
  const en = useLocale() === 'en';
  const [demoType, setDemoType] = useState('html');
  const [file, setFile] = useState(null);
  const [visibility, setVisibility] = useState('public');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    const fd = new FormData(e.target);
    fd.set('demo_type', demoType);
    fd.set('visibility', visibility);
    if (demoType === 'html') {
      if (!file) { setError(en ? 'Please choose an .html file' : '请选择 .html 文件'); return; }
      fd.set('file', file);
    }
    if (demoType === 'shots') {
      if (!file) { setError(en ? 'Please upload a screenshot' : '请上传一张截图'); return; }
      fd.set('file', file);
    }
    setLoading(true);
    try {
      const res = await fetch('/api/upload-demo', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || (en ? 'Submit failed' : '提交失败'));
      router.push(`/bp/${data.id}`);
    } catch (err) { setError(err.message); setLoading(false); }
  }

  const typeOptions = en
    ? [
      { v: 'html', t: '🎮 Upload HTML file', d: 'A single-file demo you just vibe-coded; playable inline, AI reads your source.' },
      { v: 'url', t: '🔗 Live URL', d: 'A deployed demo (Lovable/Bolt/Replit/Vercel…); AI fetches the page, plus a screenshot cover.' },
      { v: 'github', t: '🐙 GitHub repo', d: 'A repo link; AI reads README + stars/activity/stack as real signals.' },
      { v: 'shots', t: '🖼 Screenshot + description', d: 'No link? Upload a screenshot and describe it. AI judges your description (text model can’t read the image); the screenshot is the cover.' },
    ]
    : [
      { v: 'html', t: '🎮 上传HTML文件', d: '刚vibecoding完的单文件Demo，上传后可直接在线试玩，AI会阅读你的源代码' },
      { v: 'url', t: '🔗 在线网址', d: '已部署的Demo（Lovable/Bolt/Replit/Vercel等），AI抓取页面内容，并自动截首屏作封面' },
      { v: 'github', t: '🐙 GitHub仓库', d: '提交仓库链接，AI读取README + star/活跃度/技术栈等真实信号' },
      { v: 'shots', t: '🖼 截图+描述', d: '没有链接也能交：上传一张截图并写清描述，AI按你的描述评估（文本模型不读图），截图用作封面展示' },
    ];

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <h1 className="page-title">{en ? 'Submit your Demo' : '提交你的 Demo'}</h1>
      <p className="page-sub">{en ? 'Separate Demo pool: each of the 12 investors holds another ~$14M, for things that are actually built.' : 'Demo赛道独立资金池：12位投资人每人另备1亿虚拟资金，专投"做出来了"的项目'}</p>

      <ScoringNote compact en={en} />

      <form className="form card" onSubmit={onSubmit}>
        <label>{en ? 'Demo name *' : 'Demo 名称 *'}</label>
        <input type="text" name="title" required maxLength={60} placeholder={en ? 'e.g. Minimal Snake · 30-min build' : '例：极简贪吃蛇 · 30分钟vibecoding产物'} />

        <label>{en ? 'Developer / team *' : '开发者 / 团队名 *'}</label>
        <input type="text" name="founder" required maxLength={30} placeholder={en ? 'Your name or team' : '你的名字或团队名'} />

        <label>{en ? 'One-line intro *' : '一句话介绍 *'}</label>
        <textarea name="summary" required maxLength={300} placeholder={en ? 'What does it do? What problem? Any interesting tech?' : '这个Demo做什么？解决什么问题？用了什么有意思的技术？'} />

        <label>{en ? 'Submission type *' : '提交方式 *'}</label>
        <div className="radio-group" style={{ flexDirection: 'column' }}>
          {typeOptions.map((o) => (
            <div key={o.v} className={`radio-pill ${demoType === o.v ? 'selected' : ''}`} onClick={() => setDemoType(o.v)} style={{ minWidth: 'auto' }}>
              <input type="radio" checked={demoType === o.v} readOnly />
              <div><b>{o.t}</b><p>{o.d}</p></div>
            </div>
          ))}
        </div>

        {demoType === 'html' && (
          <>
            <label>{en ? 'HTML file *' : 'HTML 文件 *'}</label>
            <div className={`file-drop ${file ? 'has-file' : ''}`} onClick={() => document.getElementById('fileInput').click()}>
              {file ? `✅ ${file.name}` : (en ? 'Click to choose an .html file (max 5MB)' : '点击选择 .html 文件（最大5MB）')}
            </div>
            <input id="fileInput" type="file" accept=".html,.htm" style={{ display: 'none' }} onChange={(e) => setFile(e.target.files[0] || null)} />
            <p className="hint">{en ? 'Your demo will be hosted here and playable inline on its page for everyone.' : '提交后你的Demo会被托管在本站，详情页内嵌试玩区，所有人都能直接玩到'}</p>
          </>
        )}
        {demoType === 'url' && (
          <>
            <label>{en ? 'Demo URL *' : 'Demo 网址 *'}</label>
            <input type="text" name="url" placeholder="https://your-demo.vercel.app" required />
          </>
        )}
        {demoType === 'shots' && (
          <>
            <label>{en ? 'Screenshot *' : '截图 *'}</label>
            <div className={`file-drop ${file ? 'has-file' : ''}`} onClick={() => document.getElementById('shotInput').click()}>
              {file ? `✅ ${file.name}` : (en ? 'Click to choose an image (png/jpg/webp, max 8MB)' : '点击选择图片（png/jpg/webp，最大8MB）')}
            </div>
            <input id="shotInput" type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => setFile(e.target.files[0] || null)} />
            <p className="hint">{en ? 'AI evaluates by your description above; the screenshot is shown as the cover. Write a detailed description!' : 'AI 按你上面的描述来评估，截图用作封面展示。请把描述写详细！'}</p>
          </>
        )}
        {demoType === 'github' && (
          <>
            <label>{en ? 'GitHub repo URL *' : 'GitHub 仓库链接 *'}</label>
            <input type="text" name="url" placeholder="https://github.com/you/your-repo" required />
          </>
        )}

        <label>{en ? 'Visibility *' : '可见权限 *'}</label>
        <div className="radio-group">
          <div className={`radio-pill ${visibility === 'public' ? 'selected' : ''}`} onClick={() => setVisibility('public')}>
            <input type="radio" checked={visibility === 'public'} readOnly />
            <div><b>{en ? '🌍 Public' : '🌍 所有用户可见'}</b><p>{en ? 'Anyone can play and watch.' : 'Demo可被所有人试玩与围观'}</p></div>
          </div>
          <div className={`radio-pill ${visibility === 'ai_only' ? 'selected' : ''}`} onClick={() => setVisibility('ai_only')}>
            <input type="radio" checked={visibility === 'ai_only'} readOnly />
            <div><b>{en ? '🔒 AI-only' : '🔒 仅 AI 可见'}</b><p>{en ? 'Only investors try it; competes anonymously.' : '只有虚拟投资人能体验，榜上匿名参战'}</p></div>
          </div>
        </div>

        {error && <p className="error-msg">{error}</p>}
        <div style={{ marginTop: 22 }}>
          <button className="btn" type="submit" disabled={loading} style={{ width: '100%', padding: '12px' }}>
            {loading ? (en ? '12 investors are trying your demo…' : '12位投资人正在试用你的Demo…') : (en ? 'Submit Demo, let AI play 🎮' : '提交 Demo，让 AI 玩玩看 🎮')}
          </button>
        </div>
      </form>
    </div>
  );
}
