'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale } from '@/lib/useLocale';
import { loadPF, savePF, PF_START as START } from '@/lib/portfolioClient';

function fmtZh(n) {
  if (Math.abs(n) >= 100000000) return (n / 100000000).toFixed(2) + '亿';
  if (Math.abs(n) >= 10000) return (n / 10000).toFixed(0) + '万';
  return String(Math.round(n));
}
function fmtEn(n, rate = 7.2) {
  const usd = n / (rate || 7.2);
  const v = Math.abs(usd);
  if (v >= 1e9) return '$' + (usd / 1e9).toFixed(2) + 'B';
  if (v >= 1e6) return '$' + (usd / 1e6).toFixed(2) + 'M';
  if (v >= 1e3) return '$' + (usd / 1e3).toFixed(1) + 'K';
  return '$' + Math.round(usd);
}

export default function PortfolioPage() {
  const en = useLocale() === 'en';
  const [rate, setRate] = useState(7.2);
  const fmt = (n) => (en ? fmtEn(n, rate) : fmtZh(n));
  const [pf, setPf] = useState(null);
  const [prices, setPrices] = useState({});

  async function load() {
    fetch('/api/fxrate').then((r) => r.json()).then((d) => { if (d && d.rate > 0) setRate(d.rate); }).catch(() => {});
    const p = await loadPF();
    setPf(p);
    if (p.positions.length) {
      try {
        const res = await fetch('/api/prices', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: p.positions.map((x) => x.bp_id) }) });
        const d = await res.json();
        setPrices(d.prices || {});
      } catch {}
    }
  }
  useEffect(() => { load(); }, []);

  function sell(bpId) {
    const cur = pf;
    const pos = cur.positions.find((x) => x.bp_id === bpId);
    const P = Math.max((prices[bpId]?.price) || 0, 10000000);
    const np = { fund: cur.fund + (pos ? pos.shares * P : 0), positions: cur.positions.filter((x) => x.bp_id !== bpId) };
    setPf(np); savePF(np);
  }
  function reset() {
    if (!window.confirm(en ? `Reset your paper account to the initial ${fmtEn(START, rate)}?` : '确定重置你的模拟盘到初始 1 亿？')) return;
    const np = { fund: START, positions: [] };
    setPf(np); savePF(np);
  }

  if (!pf) return <p className="hint">{en ? 'Loading…' : '加载中…'}</p>;

  const posVal = pf.positions.reduce((s, x) => s + x.shares * Math.max((prices[x.bp_id]?.price) || 0, 10000000), 0);
  const totalVal = pf.fund + posVal;
  const ret = Math.round(((totalVal - START) / START) * 1000) / 10;

  return (
    <div>
      <h1 className="page-title">📊 {en ? 'My Portfolio' : '我的投资组合'}</h1>
      <p className="page-sub">{en ? 'Your personal paper account (in this browser). Price = the project’s current total investment, moving with AI investors and the market.' : '你的个人模拟盘（存在本机浏览器）。市价 = 项目当前累计注资，随 AI 投资人与市场波动变化。'}</p>

      <div className="stats-bar">
        <div className="stat"><b>{fmt(totalVal)}</b><span>{en ? 'Total assets' : '总资产'}</span></div>
        <div className="stat"><b>{fmt(pf.fund)}</b><span>{en ? 'Cash' : '可用现金'}</span></div>
        <div className="stat"><b>{fmt(posVal)}</b><span>{en ? 'Holdings value' : '持仓市值'}</span></div>
        <div className="stat"><b style={{ color: ret >= 0 ? 'var(--green)' : 'var(--red)' }}>{ret >= 0 ? '+' : ''}{ret}%</b><span>{en ? 'Total return' : '总收益率'}</span></div>
      </div>

      {pf.positions.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', color: 'var(--text2)' }}>
          {en ? <>No positions yet. Open a project on the <Link href="/bp" style={{ color: 'var(--accent)' }}>BP board</Link> and “Buy”.</> : <>还没有持仓。去 <Link href="/bp" style={{ color: 'var(--accent)' }}>BP 榜</Link> 点开项目，用「买入」建仓。</>}
        </div>
      ) : (
        <div className="cmp-wrap">
          <table className="cmp-table">
            <thead><tr><th>{en ? 'Project' : '项目'}</th><th className="num">{en ? 'Cost' : '成本'}</th><th className="num">{en ? 'Value' : '现市值'}</th><th className="num">{en ? 'P&L' : '盈亏'}</th><th></th></tr></thead>
            <tbody>
              {pf.positions.map((x) => {
                const P = Math.max((prices[x.bp_id]?.price) || 0, 10000000);
                const val = x.shares * P;
                const pl = val - x.cost;
                return (
                  <tr key={x.bp_id}>
                    <td><Link href={`/bp/${x.bp_id}`} style={{ color: 'var(--text)', fontWeight: 600 }}>{prices[x.bp_id]?.title || x.title}</Link></td>
                    <td className="num">{fmt(x.cost)}</td>
                    <td className="num">{fmt(val)}</td>
                    <td className="num" style={{ color: pl >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 700 }}>{pl >= 0 ? '+' : ''}{fmt(pl)}</td>
                    <td className="num"><button className="btn btn-ghost" style={{ padding: '2px 10px', fontSize: 12 }} onClick={() => sell(x.bp_id)}>{en ? 'Sell' : '卖出'}</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        <button className="btn btn-ghost" onClick={reset}>↺ {en ? 'Reset account' : '重置模拟盘'}</button>
      </div>
    </div>
  );
}
