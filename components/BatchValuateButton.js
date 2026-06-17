'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

// 批量估值：拉取未估值的公开 Demo 列表，逐个顺序调用估值接口，带进度/费用确认/停止。
export default function BatchValuateButton({ en = false }) {
  const router = useRouter();
  const [pending, setPending] = useState(null); // null=加载中；[]=无待估
  const [running, setRunning] = useState(false);
  const [prog, setProg] = useState({ done: 0, total: 0, cur: '' });
  const [msg, setMsg] = useState('');
  const stop = useState({ v: false })[0]; // 跨渲染稳定的停止标记

  async function load() {
    try {
      const res = await fetch('/api/value-batch');
      const d = await res.json();
      setPending(Array.isArray(d.pending) ? d.pending : []);
    } catch { setPending([]); }
  }
  useEffect(() => { load(); }, []);

  async function run() {
    if (!pending || pending.length === 0) return;
    const est = (pending.length * 0.07).toFixed(2);
    const sure = window.confirm(en
      ? `Value ${pending.length} un-valued demos one by one? Each uses web search + deep reasoning (~¥0.07), about ¥${est} total. It can take several minutes — keep this page open.`
      : `将对 ${pending.length} 个未估值的公开 Demo 逐个估值。每个会联网搜索 + 深度推理（约 ¥0.07），合计约 ¥${est}。可能需要几分钟，期间请保持页面打开。确定开始？`);
    if (!sure) return;
    stop.v = false;
    setMsg('');
    setRunning(true);
    const list = pending;
    let ok = 0, fail = 0;
    setProg({ done: 0, total: list.length, cur: '' });
    for (let i = 0; i < list.length; i++) {
      if (stop.v) break;
      const item = list[i];
      setProg({ done: i, total: list.length, cur: item.title });
      try {
        const res = await fetch('/api/value-batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: item.id }),
        });
        const d = await res.json();
        if (res.ok && d.ok && d.summary && d.summary.n > 0) ok++; else fail++;
      } catch { fail++; }
      setProg({ done: i + 1, total: list.length, cur: item.title });
    }
    // 估值跑完 → 触发一次全局调仓，让持仓按最新估值调整（低估加仓 / 高估减仓）
    let moves = 0;
    if (ok > 0) { try { const r = await fetch('/api/tick'); const d = await r.json(); moves = d.moves || 0; } catch {} }
    setRunning(false);
    const head = stop.v
      ? (en ? `Stopped. ${ok} valued, ${fail} failed.` : `已停止。成功 ${ok} 个，失败 ${fail} 个。`)
      : (en ? `Done: ${ok} valued, ${fail} failed.` : `完成：成功 ${ok} 个，失败 ${fail} 个。`);
    const tail = ok > 0 ? (en ? ` Holdings rebalanced (${moves} moves).` : ` 已按估值调仓（${moves} 笔变动）。`) : '';
    setMsg(head + tail);
    await load();
    router.refresh();
  }

  if (pending === null) return null; // 加载中
  if (running) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
        <span className="hint">{en ? `Valuing ${prog.done}/${prog.total}` : `估值中 ${prog.done}/${prog.total}`}{prog.cur ? ` · ${prog.cur}…` : ''}</span>
        <button className="btn btn-ghost" onClick={() => { stop.v = true; }}>{en ? 'Stop' : '停止'}</button>
      </span>
    );
  }
  if (pending.length === 0) {
    return <span className="hint">{msg || (en ? '✅ All public demos valued' : '✅ 公开 Demo 已全部估值')}</span>;
  }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      <button className="btn btn-ghost" onClick={run}>
        {en
          ? `⚡ Value all (${pending.length} left · ~¥${(pending.length * 0.07).toFixed(2)})`
          : `⚡ 批量估值（还有 ${pending.length} 个 · 约 ¥${(pending.length * 0.07).toFixed(2)}）`}
      </button>
      {msg && <span className="hint">{msg}</span>}
    </span>
  );
}
