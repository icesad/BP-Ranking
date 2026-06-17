'use client';
import { useEffect } from 'react';

// 项目级第一方信号埋点：view(浏览) / play(首次真实交互，仅 demo) / dwell(停留时长，离开时上报)。
// 复用全站访客 id（bpr_vid）；后端按 visitor/day/kind 去重，喂估值用去重信号 → 刷量基本无收益。
export default function SignalTracker({ bpId, isDemo = false }) {
  useEffect(() => {
    if (!bpId) return;
    let v;
    try {
      v = localStorage.getItem('bpr_vid');
      if (!v) { v = Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem('bpr_vid', v); }
    } catch { return; }

    const start = Date.now();
    const post = (kind, dwell) => {
      try {
        const body = JSON.stringify({ v, bp: bpId, kind, dwell });
        fetch('/api/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {});
      } catch {}
    };
    // 浏览
    post('view', 0);

    // 首次真实交互记一次 play（仅 demo——用户真的去玩了/操作了）
    let played = false;
    const onInteract = () => {
      if (played) return; played = true;
      post('play', 0);
      window.removeEventListener('pointerdown', onInteract);
      window.removeEventListener('keydown', onInteract);
    };
    if (isDemo) {
      window.addEventListener('pointerdown', onInteract);
      window.addEventListener('keydown', onInteract);
    }

    // 离开/隐藏时上报停留时长（sendBeacon 更可靠）
    let sent = false;
    const flush = () => {
      if (sent) return; sent = true;
      const dwell = Date.now() - start;
      try {
        const blob = new Blob([JSON.stringify({ v, bp: bpId, kind: 'view', dwell })], { type: 'application/json' });
        if (navigator.sendBeacon) navigator.sendBeacon('/api/track', blob);
        else post('view', dwell);
      } catch {}
    };
    const onHide = () => { if (document.visibilityState === 'hidden') flush(); };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', flush);

    return () => {
      window.removeEventListener('pointerdown', onInteract);
      window.removeEventListener('keydown', onInteract);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, [bpId, isDemo]);
  return null;
}
