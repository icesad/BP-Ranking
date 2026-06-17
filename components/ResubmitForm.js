'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from '@/lib/useLocale';
import ScoringNote from '@/components/ScoringNote';

export default function ResubmitForm({ id, kind, title, summary, demoType, demoUrl = '', stage = 'idea', questions = [] }) {
  const router = useRouter();
  const en = useLocale() === 'en';
  const isDemo = kind === 'demo';
  const [dtype, setDtype] = useState(demoType || 'html');
  const [stg, setStg] = useState(stage || 'idea');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [revalue, setRevalue] = useState(false);
  const [answers, setAnswers] = useState(() => questions.map((q) => ({ investor_id: q.investor_id, q: q.question, a: q.answer || '' })));

  function setAnswer(i, val) {
    setAnswers((prev) => prev.map((x, idx) => (idx === i ? { ...x, a: val } : x)));
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    const fd = new FormData(e.target);
    if (file) fd.set('file', file);
    fd.set('answers', JSON.stringify(answers));
    setLoading(true);
    try {
      const res = await fetch(`/api/resubmit/${id}`, { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || (en ? 'Submit failed' : '提交失败'));
      router.push(`/bp/${id}${revalue ? '?revalue=1' : ''}`);
      router.refresh();
    } catch (err) { setError(err.message); setLoading(false); }
  }

  return (
    <form className="form card" onSubmit={onSubmit}>
      <ScoringNote compact en={en} />
      <label>{en ? 'Project name *' : '项目名称 *'}</label>
      <input type="text" name="title" required maxLength={60} defaultValue={title} />

      {!isDemo && (
        <>
          <label>{en ? 'Stage (update if you’ve progressed, e.g. idea → MVP)' : '项目阶段（可更新——比如已从想法做出了 MVP）'}</label>
          <input type="hidden" name="stage" value={stg} />
          <div className="radio-group" style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {(en ? [['idea', '💡 Idea/Pre-MVP'], ['mvp', '🛠 Has MVP'], ['revenue', '📈 Revenue']] : [['idea', '💡 想法/Pre-MVP'], ['mvp', '🛠 已有MVP'], ['revenue', '📈 有营收/增长']]).map(([v, lbl]) => (
              <div key={v} className={`radio-pill ${stg === v ? 'selected' : ''}`} onClick={() => setStg(v)} style={{ flex: 1, minWidth: 130 }}>
                <input type="radio" name="stage_r" value={v} checked={stg === v} readOnly />
                <div><b>{lbl}</b></div>
              </div>
            ))}
          </div>
        </>
      )}

      <label>{en ? 'Updated summary *' : '更新后的简介 *'}</label>
      <textarea name="summary" required maxLength={300} defaultValue={summary}
        placeholder={en ? 'What’s improved in this version: new data, progress, fixed weaknesses…' : '说清楚这一版有什么改进：新数据、新进展、补强的短板…'} />

      {isDemo ? (
        <>
          <label>{en ? 'Demo type' : 'Demo 形式'}</label>
          <div className="radio-group" style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {(en ? [['html', '🎮 HTML file'], ['url', '🔗 Live URL'], ['github', '🐙 GitHub']] : [['html', '🎮 HTML文件'], ['url', '🔗 在线链接'], ['github', '🐙 GitHub']]).map(([v, lbl]) => (
              <div key={v} className={`radio-pill ${dtype === v ? 'selected' : ''}`} onClick={() => setDtype(v)} style={{ flex: 1, minWidth: 120 }}>
                <input type="radio" name="demo_type" value={v} checked={dtype === v} readOnly />
                <div><b>{lbl}</b></div>
              </div>
            ))}
          </div>
          {dtype === 'html' ? (
            <>
              <label>{en ? 'New .html file (keeps old if empty)' : '新的 .html 文件（不选则沿用原文件）'}</label>
              <div className={`file-drop ${file ? 'has-file' : ''}`} onClick={() => document.getElementById('reFile').click()}>
                {file ? `✅ ${file.name}` : (en ? 'Click to choose a new .html file' : '点击选择新的 .html 文件')}
              </div>
              <input id="reFile" type="file" accept=".html,.htm" style={{ display: 'none' }}
                onChange={(e) => setFile(e.target.files[0] || null)} />
            </>
          ) : (
            <>
              <label>{(dtype === 'github' ? (en ? 'Repo URL' : '仓库链接') : (en ? 'Demo URL' : 'Demo 链接'))}{en ? ' (kept & re-fetched on submit; clear to keep old snapshot)' : '（默认预填原链接，提交时会重新抓取当前线上内容；清空则沿用旧快照）'}</label>
              <input type="url" name="url" placeholder="https://..." defaultValue={demoUrl} />
            </>
          )}
        </>
      ) : (
        <>
          <label>{en ? 'New BP file (.pptx, keeps old if empty)' : '新的 BP 文件（.pptx，不选则沿用原文件）'}</label>
          <div className={`file-drop ${file ? 'has-file' : ''}`} onClick={() => document.getElementById('reFile').click()}>
            {file ? `✅ ${file.name}` : (en ? 'Click to choose a new .pptx — AI re-reads it' : '点击选择新的 .pptx 文件，AI 将重新逐页阅读')}
          </div>
          <input id="reFile" type="file" accept=".pptx" style={{ display: 'none' }}
            onChange={(e) => setFile(e.target.files[0] || null)} />
        </>
      )}

      {questions.length > 0 && (
        <div className="qa-answer-block">
          <label>🎤 {en ? 'Respond to investor questions (optional; well-supported answers help)' : '回应投资人的提问（可选，但有理有据的回答会加分）'}</label>
          {questions.map((q, i) => (
            <div key={q.investor_id} className="qa-item">
              <div className="qa-q">{q.emoji} {q.name}: {q.question}</div>
              <textarea
                value={answers[i]?.a || ''}
                maxLength={300}
                placeholder={en ? 'Respond with specific data or facts…' : '用具体的数据或事实回应这个质疑…'}
                onChange={(e) => setAnswer(i, e.target.value)}
              />
            </div>
          ))}
        </div>
      )}

      <p className="hint">{en ? 'After submitting, investors re-score based on the new content (incl. your answers) and rebalance — your rank may rise or fall. Iterate seriously.' : '提交后投资人会基于新内容（含你的答复）重新打分并调整持仓，名次可能上升也可能下降，请认真迭代。'}</p>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, cursor: 'pointer' }}>
        <input type="checkbox" checked={revalue} onChange={(e) => setRevalue(e.target.checked)} style={{ width: 'auto' }} />
        <span>{en ? 'Also re-run the investor valuation after submit (web search + deep reasoning, ~1 min, ~¥0.07)' : '提交后立即重新估值（联网搜索 + 深度推理，约 1 分钟，约 ¥0.07）'}</span>
      </label>
      {error && <p className="error-msg">{error}</p>}
      <div style={{ marginTop: 22 }}>
        <button className="btn" type="submit" disabled={loading} style={{ width: '100%', padding: '12px' }}>
          {loading ? (en ? '12 investors re-evaluating… (a few seconds)' : '12位投资人正在重新评估…（约需几秒）') : (en ? 'Submit update, climb back 🚀' : '提交更新版，争取回升 🚀')}
        </button>
      </div>
    </form>
  );
}
