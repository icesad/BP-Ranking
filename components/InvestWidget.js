'use client';
import { useState, useEffect } from 'react';
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

// price = 项目当前“市价”（= 累计注资，含一个下限避免除零）
export default function InvestWidget({ bpId, title, price, valLow = 0, valHigh = 0, rate = 7.2 }) {
  const en = useLocale() === 'en';
  const fmt = (n) => (en ? fmtEn(n, rate) : fmtZh(n));
  const P = Math.max(Number(price) || 0, 10000000);
  const hasVal = valLow > 0 || valHigh > 0;
  const mid = (valLow + valHigh) / 2;
  const verdict = !hasVal ? '' : P < valLow ? (en ? 'below valuation — possibly undervalued' : '低于估值区间 · 可能被低估')
    : P > valHigh ? (en ? 'above valuation — possibly overvalued' : '高于估值区间 · 可能偏贵')
      : (en ? 'within the valuation range' : '处于估值区间内');
  const [pf, setPf] = useState(null);
  const [amt, setAmt] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => { let a = true; loadPF().then((p) => { if (a) setPf(p); }); return () => { a = false; }; }, []);
  if (!pf) return null;

  const pos = pf.positions.find((x) => x.bp_id === bpId);
  const curVal = pos ? pos.shares * P : 0;
  const pl = pos ? curVal - pos.cost : 0;

  function buy() {
    const raw = Number(amt);
    if (!raw || raw <= 0) { setMsg(en ? 'Enter an amount' : '请输入买入金额'); return; }
    const a = Math.round(raw * (en ? rate : 1)); // 英文按美元输入，自动折成人民币入账
    if (a > pf.fund) { setMsg(en ? 'Insufficient balance' : '虚拟余额不足'); return; }
    const positions = pf.positions.slice();
    const i = positions.findIndex((x) => x.bp_id === bpId);
    const shares = a / P;
    if (i >= 0) positions[i] = { ...positions[i], shares: positions[i].shares + shares, cost: positions[i].cost + a };
    else positions.push({ bp_id: bpId, title, shares, cost: a });
    const np = { fund: pf.fund - a, positions };
    setPf(np); savePF(np); setAmt(''); setMsg(`✅ ${en ? 'Bought' : '买入'} ${fmt(a)}`);
  }
  function sellAll() {
    if (!pos) return;
    const val = pos.shares * P;
    const np = { fund: pf.fund + val, positions: pf.positions.filter((x) => x.bp_id !== bpId) };
    setPf(np); savePF(np); setMsg(en ? `✅ Sold, +${fmt(val)} (P&L ${pl >= 0 ? '+' : ''}${fmt(pl)})` : `✅ 卖出，回收 ${fmt(val)}（盈亏 ${pl >= 0 ? '+' : ''}${fmt(pl)}）`);
  }

  return (
    <div className="iw">
      <div className="iw-row">
        <span>{en ? 'My balance: ' : '我的虚拟余额：'}<b>{fmt(pf.fund)}</b></span>
        <a href="/portfolio" className="hint" style={{ color: 'var(--accent)' }}>{en ? 'My portfolio →' : '我的投资组合 →'}</a>
      </div>
      {hasVal && (
        <div className="iw-pos" style={{ borderLeft: '2px solid var(--gold)' }}>
          {en ? 'Reference · ' : '参考 · '}{en ? 'market price' : '当前市价'} <b>{fmt(P)}</b> · {en ? 'investor valuation' : '投资人估值'} <b style={{ color: 'var(--gold)' }}>{fmt(valLow)}–{fmt(valHigh)}</b> <span className="hint">（{verdict}）</span>
        </div>
      )}
      {pos && (
        <div className="iw-pos">
          {en ? 'Value ' : '持有市值 '}<b>{fmt(curVal)}</b> · {en ? 'cost' : '成本'} {fmt(pos.cost)} · {en ? 'P&L' : '盈亏'} <b style={{ color: pl >= 0 ? 'var(--green)' : 'var(--red)' }}>{pl >= 0 ? '+' : ''}{fmt(pl)}</b>
        </div>
      )}
      <div className="iw-actions">
        <input type="number" value={amt} min="0" placeholder={en ? 'Buy amount ($)' : '买入金额(元)'} onChange={(e) => setAmt(e.target.value)} />
        <button className="btn" onClick={buy}>{en ? 'Buy' : '买入'}</button>
        {pos && <button className="btn btn-ghost" onClick={sellAll}>{en ? 'Sell all' : '全部卖出'}</button>}
      </div>
      {msg && <p className="hint" style={{ marginTop: 6 }}>{msg}</p>}
      <p className="hint" style={{ marginTop: 4 }}>{en ? 'Price moves with the 12 AI investors’ combined investment (incl. market swings). This is your personal paper account, stored in this browser.' : '市价随 12 位 AI 投资人的集体注资（含市场波动）变化；这是你个人的模拟盘，存在本机浏览器。'}</p>
    </div>
  );
}
