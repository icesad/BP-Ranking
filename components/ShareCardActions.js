'use client';
import { useState } from 'react';

// 把 #share-card 截成图片下载；以及复制一段分享文案。
export default function ShareCardActions({ shareText, en = false }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  function loadH2C() {
    return new Promise((resolve, reject) => {
      if (window.html2canvas) return resolve(window.html2canvas);
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
      s.onload = () => resolve(window.html2canvas);
      s.onerror = () => reject(new Error(en ? 'Image library failed to load (needs internet)' : '图片库加载失败（需要联网）'));
      document.body.appendChild(s);
    });
  }

  async function download() {
    setBusy(true); setMsg('');
    try {
      const h2c = await loadH2C();
      const el = document.getElementById('share-card');
      const canvas = await h2c(el, { backgroundColor: null, scale: 2, useCORS: true });
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = 'Demo-Ranking-card.png';
      a.click();
      setMsg(en ? '✅ Image downloaded' : '✅ 已下载图片');
    } catch (e) {
      setMsg((en ? 'Download failed: ' : '下载失败：') + e.message + (en ? ' (you can also screenshot it)' : '（也可直接截图保存）'));
    }
    setBusy(false);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(shareText);
      setMsg(en ? '✅ Caption copied' : '✅ 文案已复制');
    } catch {
      setMsg(en ? 'Copy failed, please select the text manually' : '复制失败，请手动选择文案复制');
    }
  }

  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 16 }}>
      <button className="btn" onClick={download} disabled={busy}>{busy ? (en ? 'Generating…' : '生成中…') : (en ? '⬇️ Download image' : '⬇️ 下载战绩图片')}</button>
      <button className="btn btn-ghost" onClick={copy}>{en ? '📋 Copy caption' : '📋 复制分享文案'}</button>
      {msg && <span className="hint">{msg}</span>}
    </div>
  );
}
