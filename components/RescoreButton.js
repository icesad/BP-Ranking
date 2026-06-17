'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

// 一次性把所有存量项目切到新评分标准的入口。
export default function RescoreButton({ en = false }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  async function run() {
    if (!window.confirm(en ? 'Re-evaluate all existing projects with the new scoring and reallocate virtual capital. May take a while if there are many. Continue?' : '将用新评分标准重新评估所有存量项目，并据此重新分配虚拟资金。项目较多时可能耗时较久，确认继续？')) return;
    setLoading(true);
    setMsg('');
    try {
      const res = await fetch('/api/rescore');
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || (en ? 'failed' : '失败'));
      setMsg(en ? `✅ Re-evaluated ${d.rescored} projects, ${d.moves} moves` : `✅ 已重评 ${d.rescored} 个项目，调仓 ${d.moves} 次`);
      router.refresh();
    } catch (e) {
      setMsg((en ? 'Error: ' : '出错：') + e.message);
    }
    setLoading(false);
  }

  return (
    <div style={{ margin: '4px 0 12px' }}>
      <button className="btn btn-ghost" onClick={run} disabled={loading}>
        {loading ? (en ? 'Re-evaluating… (please wait, keep page open)' : '重评中…（请稍候，勿关页面）') : (en ? '🔄 Re-score all existing projects' : '🔄 全员重评存量项目（切换到新评分标准）')}
      </button>
      {msg && <span className="hint" style={{ marginLeft: 10 }}>{msg}</span>}
    </div>
  );
}
