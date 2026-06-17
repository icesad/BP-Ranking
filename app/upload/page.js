'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from '@/lib/useLocale';
import ScoringNote from '@/components/ScoringNote';
import GoodBpExample from '@/components/GoodBpExample';

export default function UploadPage() {
  const router = useRouter();
  const en = useLocale() === 'en';
  const [file, setFile] = useState(null);
  const [visibility, setVisibility] = useState('public');
  const [stage, setStage] = useState('idea');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [extracted, setExtracted] = useState(null);
  const [extracting, setExtracting] = useState(false);

  async function onPreview() {
    if (!file) return;
    setError('');
    setExtracting(true);
    try {
      const fd = new FormData();
      fd.set('file', file);
      const res = await fetch('/api/extract', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || (en ? 'Parse failed' : '解析失败'));
      setExtracted(data.content || '');
    } catch (err) { setError(err.message); }
    setExtracting(false);
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    const fd = new FormData(e.target);
    if (file) fd.set('file', file);
    setLoading(true);
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || (en ? 'Upload failed' : '上传失败'));
      router.push(`/bp/${data.id}`);
    } catch (err) { setError(err.message); setLoading(false); }
  }

  const stageOpts = en
    ? [['idea', '💡 Idea / Pre-MVP', 'No product yet — insight & plan'], ['mvp', '🛠 Has MVP', 'Built it — UX & early feedback'], ['revenue', '📈 Revenue / Growth', 'Has data — unit economics & growth']]
    : [['idea', '💡 想法 / Pre-MVP', '还没产品，看洞察与计划'], ['mvp', '🛠 已有 MVP', '做出来了，看体验与早期反馈'], ['revenue', '📈 有营收 / 增长', '有数据，看单位经济与增长']];

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <h1 className="page-title">{en ? 'Submit your BP' : '上传你的 BP'}</h1>
      <p className="page-sub">{en ? 'Once submitted, 12 AI investors read it and decide whether to invest virtual capital.' : '提交后，12 位虚拟投资人将立即阅读并决定是否注入虚拟资金'}</p>

      <ScoringNote en={en} />
      <GoodBpExample en={en} />

      <form className="form card" onSubmit={onSubmit}>
        <label>{en ? 'Project name *' : '项目名称 *'}</label>
        <input type="text" name="title" required maxLength={60} placeholder={en ? 'e.g. Lingxi · AI primary-care diagnosis' : '例：灵犀智诊 · AI基层医疗诊断助手'} />

        <label>{en ? 'Founder / team *' : '创始人 / 团队名 *'}</label>
        <input type="text" name="founder" required maxLength={30} placeholder={en ? 'Your name or team' : '你的名字或团队名'} />

        <label>{en ? 'Stage * (investors judge by stage-appropriate standards)' : '项目阶段 *（投资人会按你所处阶段用合理标准评估）'}</label>
        <input type="hidden" name="stage" value={stage} />
        <div className="radio-group" style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {stageOpts.map(([v, lbl, d]) => (
            <div key={v} className={`radio-pill ${stage === v ? 'selected' : ''}`} onClick={() => setStage(v)} style={{ flex: 1, minWidth: 150 }}>
              <input type="radio" name="stage_r" value={v} checked={stage === v} readOnly />
              <div><b>{lbl}</b><p>{d}</p></div>
            </div>
          ))}
        </div>

        <label>{en ? 'One-line summary *' : '一句话简介 *'}</label>
        <textarea name="summary" required maxLength={300} placeholder={en ? 'In 2-3 sentences: what, for whom, and what stage you’re at' : '用2-3句话说清楚：做什么、为谁做、现在处于什么阶段'} />

        <label>{en ? 'BP file (.pptx, optional)' : 'BP 文件（.pptx，可选）'}</label>
        <div className={`file-drop ${file ? 'has-file' : ''}`} onClick={() => document.getElementById('fileInput').click()}>
          {file ? `✅ ${file.name}` : (en ? 'Click to choose a .pptx — AI reads every slide' : '点击选择 .pptx 文件，AI将逐页阅读全部内容')}
        </div>
        <input id="fileInput" type="file" accept=".pptx" style={{ display: 'none' }}
          onChange={(e) => { setFile(e.target.files[0] || null); setExtracted(null); }} />
        {file && (
          <div style={{ marginTop: 8 }}>
            <button type="button" className="btn btn-ghost" onClick={onPreview} disabled={extracting}>
              {extracting ? (en ? 'Parsing…' : '解析中…') : (en ? '🔍 Preview what AI reads' : '🔍 预览 AI 读到的正文')}
            </button>
          </div>
        )}
        {extracted !== null && (
          <div className="extract-box">
            <div className="extract-head">
              {en ? `Text AI read from this PPT (${extracted.length} chars)` : `AI 从这份 PPT 读到的文字（共 ${extracted.length} 字）`}
              {extracted.length < 60 && <span className="extract-warn"> {en ? '⚠️ Very little text — likely an image/scanned PPT; add key data in the summary' : '⚠️ 文字很少，可能是图片/扫描版 PPT，建议在简介里补充关键数据'}</span>}
            </div>
            <pre className="extract-body">{extracted || (en ? '(no text parsed)' : '（没有解析到任何文字）')}</pre>
            <p className="hint">{en ? 'If it looks right, submit. If something’s missing, add the key data to the summary above.' : '确认无误就直接提交；解析有遗漏的话，把关键数据补进上面的“一句话简介”里再提交。'}</p>
          </div>
        )}
        <p className="hint">{en ? 'You can compete without a file, but the more specific and verifiable (market data, metrics, unit economics, real traction), the better. Founder background is not scored.' : '不上传文件也可以参战，但内容越具体、越有可验证的数据与事实，评估越准确（市场数据、业务指标、单位经济模型、真实进展最受重视；团队背景不计分）'}</p>

        <label>{en ? 'Visibility *' : '可见权限 *'}</label>
        <div className="radio-group">
          <div className={`radio-pill ${visibility === 'public' ? 'selected' : ''}`} onClick={() => setVisibility('public')}>
            <input type="radio" name="visibility" value="public" checked={visibility === 'public'} readOnly />
            <div><b>{en ? '🌍 Public' : '🌍 所有用户可见'}</b><p>{en ? 'Content and reports shown publicly for everyone to see.' : 'BP内容与评估报告公开展示，接受全网围观与切磋'}</p></div>
          </div>
          <div className={`radio-pill ${visibility === 'ai_only' ? 'selected' : ''}`} onClick={() => setVisibility('ai_only')}>
            <input type="radio" name="visibility" value="ai_only" checked={visibility === 'ai_only'} readOnly />
            <div><b>{en ? '🔒 AI-only' : '🔒 仅 AI 可见'}</b><p>{en ? 'Only investors read it; competes anonymously on the board.' : '只有虚拟投资人能阅读内容，排行榜上匿名参战'}</p></div>
          </div>
        </div>

        {error && <p className="error-msg">{error}</p>}
        <div style={{ marginTop: 22 }}>
          <button className="btn" type="submit" disabled={loading} style={{ width: '100%', padding: '12px' }}>
            {loading ? (en ? '12 investors are reading your BP… (a few seconds)' : '12位投资人正在阅读你的BP…（约需几秒）') : (en ? 'Submit & compete 🚀' : '提交，一战高下 🚀')}
          </button>
        </div>
      </form>
    </div>
  );
}
