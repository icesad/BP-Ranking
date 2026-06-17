'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const TYPE_OPTS = {
  zh: [['raised', '获得融资'], ['acquired', '被收购'], ['revenue', '达成营收/MRR'], ['users', '用户数里程碑'], ['shutdown', '已停运'], ['other', '其他']],
  en: [['raised', 'Raised funding'], ['acquired', 'Acquired'], ['revenue', 'Revenue / MRR'], ['users', 'Users milestone'], ['shutdown', 'Shut down'], ['other', 'Other']],
};
const TYPE_LABEL = {
  raised: { zh: '融资', en: 'Raised' }, acquired: { zh: '被收购', en: 'Acquired' }, revenue: { zh: '营收', en: 'Revenue' },
  users: { zh: '用户', en: 'Users' }, shutdown: { zh: '停运', en: 'Shut down' }, other: { zh: '其他', en: 'Other' },
};

export default function OutcomeReporter({ bpId, en = false, outcomes = [], auto = null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState('raised');
  const [amount, setAmount] = useState('');
  const [cur, setCur] = useState(en ? 'USD' : 'CNY'); // 英文默认美元，中文默认人民币
  const [rate, setRate] = useState(7.2);
  const [date, setDate] = useState('');
  const [url, setUrl] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    fetch('/api/fxrate').then((r) => r.json()).then((d) => { if (d && d.rate > 0) setRate(d.rate); }).catch(() => {});
  }, []);

  const moneyType = ['raised', 'acquired', 'revenue'].includes(type);
  const amountCny = moneyType && amount ? Math.round(Number(amount) * (cur === 'USD' ? rate : 1)) : null;

  // 切换币种：把已填金额按当前汇率直接换算成新币种的数值
  function changeCur(next) {
    if (next === cur) return;
    const v = Number(amount);
    if (amount && v > 0 && rate > 0) {
      let nv = next === 'USD' ? v / rate : v * rate; // CNY→USD 除以汇率；USD→CNY 乘以汇率
      nv = next === 'USD' ? Math.round(nv * 100) / 100 : Math.round(nv);
      setAmount(String(nv));
    }
    setCur(next);
  }

  // 切换币种时，按当前汇率把已填金额即时换算成新币种的等值数字
  function changeCur(next) {
    if (next === cur) return;
    if (amount && Number(amount) > 0 && rate > 0) {
      const cny = cur === 'USD' ? Number(amount) * rate : Number(amount);
      const val = next === 'USD' ? cny / rate : cny;
      setAmount(String(Math.round(val)));
    }
    setCur(next);
  }

  // 用可比库自动核查信息预填：默认人民币，把信息源里的美元先按汇率折成人民币填上
  function openWithAuto() {
    setType('raised');
    setUrl(auto?.url || '');
    setNote(auto?.funding || '');
    setDate(auto?.at || '');
    if (en) { setCur('USD'); setAmount(auto?.amount_usd > 0 ? String(auto.amount_usd) : ''); }
    else { setCur('CNY'); setAmount(auto?.amount_usd > 0 && rate > 0 ? String(Math.round(auto.amount_usd * rate)) : ''); }
    setOpen(true);
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setMsg('');
    try {
      const finalAmount = moneyType ? (amount ? amountCny : null) : (amount ? Number(amount) : null);
      const res = await fetch(`/api/outcome/${bpId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, amount: finalAmount, occurred_at: date, source_url: url, note }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || (en ? 'failed' : '提交失败'));
      setAmount(''); setUrl(''); setNote(''); setDate(''); setCur(en ? 'USD' : 'CNY'); setOpen(false);
      setMsg(en ? '✅ Recorded. Thanks for closing the loop!' : '✅ 已记录，谢谢你回填真实结果！');
      router.refresh();
    } catch (err) { setMsg((en ? 'Failed: ' : '提交失败：') + err.message); }
    setBusy(false);
  }

  return (
    <div style={{ marginTop: 14, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 12 }}>
      <div style={{ fontWeight: 600, marginBottom: 6 }}>📌 {en ? 'Real outcomes' : '真实进展'}</div>

      {auto && auto.funding && (
        <div className="hint" style={{ padding: '7px 9px', background: 'rgba(255,255,255,0.04)', borderRadius: 6, marginBottom: 8 }}>
          🔎 {en ? 'Auto-found in the comparables library' : '可比库已自动核查到该项目的公开信息'}：{auto.funding}
          {auto.url ? <> （<a href={auto.url} target="_blank" rel="noopener noreferrer">{en ? 'source' : '来源'}</a>）</> : null}
          {' '}<a href="#" onClick={(e) => { e.preventDefault(); openWithAuto(); }} style={{ color: 'var(--accent)' }}>{en ? 'use to prefill →' : '用它预填 →'}</a>
        </div>
      )}

      {outcomes.length > 0 ? (
        <div style={{ marginBottom: 8 }}>
          {outcomes.map((o) => (
            <div key={o.id} className="hint" style={{ padding: '2px 0' }}>
              {o.occurred_at} · {(en ? TYPE_LABEL[o.type]?.en : TYPE_LABEL[o.type]?.zh) || o.type}
              {o.amount ? ` ¥${Number(o.amount).toLocaleString()}` : ''}
              {o.note ? ` · ${o.note}` : ''}
              {o.source_url ? <> · <a href={o.source_url} target="_blank" rel="noopener noreferrer">{en ? 'source' : '来源'}</a></> : null}
            </div>
          ))}
        </div>
      ) : (
        <div className="hint" style={{ marginBottom: 8 }}>{en ? 'No real outcome reported yet.' : '还没有真实进展记录。'}</div>
      )}

      {!open ? (
        <button className="btn btn-ghost" onClick={() => setOpen(true)}>{en ? 'Report a real outcome' : '报告真实进展（融资 / 收购 / 营收…）'}</button>
      ) : (
        <form onSubmit={submit} className="card" style={{ padding: 12, marginTop: 6 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <select value={type} onChange={(e) => setType(e.target.value)}>
              {(en ? TYPE_OPTS.en : TYPE_OPTS.zh).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <input type="text" value={date} onChange={(e) => setDate(e.target.value)} placeholder={en ? 'Date e.g. 2026-04' : '日期 例：2026-04'} style={{ width: 150 }} />
          </div>

          {moneyType ? (
            <div style={{ marginTop: 10 }}>
              <label style={{ display: 'block', marginBottom: 4 }}>{en ? 'Amount' : '金额'}</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <select value={cur} onChange={(e) => changeCur(e.target.value)}>
                  <option value="CNY">{en ? '¥ RMB (CNY)' : '¥ 人民币（元）'}</option>
                  <option value="USD">{en ? '$ US dollar (USD)' : '$ 美元（USD）'}</option>
                </select>
                <span style={{ display: 'inline-flex', alignItems: 'stretch' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', padding: '0 10px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.18)', borderRight: 'none', borderRadius: '6px 0 0 6px', fontWeight: 600 }}>{cur === 'USD' ? 'US$' : '¥'}</span>
                  <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={en ? 'e.g. 30000000' : '例：30000000'} style={{ width: 180, borderRadius: '0 6px 6px 0' }} />
                </span>
                <span className="hint">{cur === 'USD' ? (en ? 'enter the amount in US dollars' : '请填「美元」金额') : (en ? 'enter the amount in RMB' : '请填「人民币」金额')}</span>
              </div>
              <div className="hint" style={{ marginTop: 6 }}>
                {en ? `Rate 1 USD ≈ ¥${rate}` : `当前汇率 1 美元 ≈ ¥${rate}`}
                {cur === 'USD'
                  ? ` · ${amountCny ? (en ? `will be stored as ¥${amountCny.toLocaleString()}` : `将统一折算为 ¥${amountCny.toLocaleString()} 入库`) : (en ? 'auto-converted to ¥ on save' : '提交时自动折算为人民币入库')}`
                  : ` · ${en ? 'stored in ¥' : '以人民币入库'}`}
              </div>
            </div>
          ) : (
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={en ? 'Count, optional (e.g. users)' : '数量（可选，如用户数）'} style={{ width: 220, marginTop: 10 }} />
          )}
          <input type="text" value={url} onChange={(e) => setUrl(e.target.value)} placeholder={en ? 'Source link (recommended, for verification)' : '来源链接（强烈建议填，便于核实）'} style={{ width: '100%', marginTop: 8 }} />
          <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder={en ? 'Note (optional)' : '备注（可选）'} style={{ width: '100%', marginTop: 8 }} />
          <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
            <button className="btn" type="submit" disabled={busy}>{busy ? (en ? 'Submitting…' : '提交中…') : (en ? 'Submit' : '提交')}</button>
            <button className="btn btn-ghost" type="button" onClick={() => setOpen(false)}>{en ? 'Cancel' : '取消'}</button>
          </div>
        </form>
      )}

      {msg && <div className="hint" style={{ marginTop: 6 }}>{msg}</div>}
      <div className="hint" style={{ opacity: 0.7, marginTop: 8 }}>
        {en ? 'Real outcomes anchor valuations and build the calibration record over time. ' : '真实进展会沉淀为校准记录，让估值随时间越来越可信。'}
        <a href="/calibration" style={{ color: 'var(--accent)' }}>{en ? 'See calibration →' : '看校准记录 →'}</a>
      </div>
    </div>
  );
}
