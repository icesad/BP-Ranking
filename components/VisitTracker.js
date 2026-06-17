'use client';
import { useEffect } from 'react';

// 匿名访客埋点：本地生成稳定ID，每次进站上报一次（后端按天去重）。
export default function VisitTracker() {
  useEffect(() => {
    try {
      let v = localStorage.getItem('bpr_vid');
      if (!v) {
        v = Math.random().toString(36).slice(2) + Date.now().toString(36);
        localStorage.setItem('bpr_vid', v);
      }
      fetch('/api/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ v }),
      }).catch(() => {});
    } catch {}
  }, []);
  return null;
}
