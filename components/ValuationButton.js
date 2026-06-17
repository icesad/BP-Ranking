'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

export default function ValuationButton({ bpId, en = false, hasVal = false, stale = false, autoRevalue = false }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const autoRan = useRef(false);

  // 重新参战时若勾选了"立即重新估值"，跳回详情页后自动触发一次（仅一次）
  useEffect(() => {
    if (autoRevalue && !autoRan.current) { autoRan.current = true; run(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRevalue]);

  async function run(force) {
    setLoading(true); setMsg('');
    try {
      const res = await fetch(`/api/value/${bpId}${force ? '?force=1' : ''}`, { method: 'POST' });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || (en ? 'failed' : '失败'));
      if (d.skipped) setMsg(en ? '✅ Content unchanged — reused last result (no cost)' : '✅ 内容未变，已沿用上次结果（未消耗）');
      else {
        const nn = d.summary?.n ?? 0;
        if (nn > 0) setMsg(en ? `✅ ${nn} valuations generated` : `✅ 已生成 ${nn} 家估值`);
        else setMsg(en ? '⚠️ No valuations this time (model busy/timeout), please retry' : '⚠️ 本次未成功（模型超时/繁忙），请重试');
      }
      router.refresh();
    } catch (e) { setMsg((en ? 'Error: ' : '出错：') + e.message); }
    setLoading(false);
  }

  const label = !hasVal
    ? (en ? '🔮 Get investor valuations' : '🔮 生成投资人估值')
    : stale
      ? (en ? '🔄 Content updated · re-value' : '🔄 内容已更新 · 重新估值')
      : (en ? '🔄 Re-value' : '🔄 重新估值');

  return (
    <span style={{ display: 'inline-flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
      <button className="btn" onClick={() => run(false)} disabled={loading}>
        {loading ? (en ? 'Valuing… (web search + deep reasoning, ~1–2 min)' : '估值中…（联网+深度推理，约 1–2 分钟）') : label}
      </button>
      {hasVal && !stale && !loading && (
        <button className="btn btn-ghost" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => run(true)} title={en ? 'Force re-run (costs one run)' : '强制重算（会消耗一次）'}>
          {en ? '⚡ Force re-run' : '⚡ 强制重算'}
        </button>
      )}
      {msg && <span className="hint">{msg}</span>}
    </span>
  );
}
