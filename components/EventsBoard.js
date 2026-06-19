'use client';
import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';

// 对标 OnePilot 活动日历：列表(仅未过期, 正序) + 月历(含过期, 灰显, 可翻月) + 区域/类型筛选。深色主题、数据驱动。
// 方向6：报名(出席)后头像直接落在活动上 → 一眼看到搭子去了哪些活动，方便线下面基。
const MONTH_ZH = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
function parseDate(s) { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || ''); return m ? { y: +m[1], mo: +m[2], d: +m[3] } : null; }

// 头像叠放：最多显示 max 个，多余 +N
function AvatarStack({ people = [], size = 26, max = 6, en = false }) {
  if (!people.length) return null;
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      {shown.map((p, i) => (
        <a key={p.handle + i} href={`/u/${p.handle}`} title={p.name || p.handle}
          style={{ marginLeft: i ? -8 : 0, zIndex: shown.length - i, display: 'inline-flex' }}>
          <img src={p.avatar} alt={p.handle} width={size} height={size}
            style={{ borderRadius: '50%', border: '2px solid var(--card,#161c2e)', background: '#0e1422' }} />
        </a>
      ))}
      {extra > 0 ? <span className="hint" style={{ marginLeft: 6 }}>+{extra}</span> : null}
    </div>
  );
}

export default function EventsBoard({ events = [], today = '', en = false, attendees = {}, myIds = [], loggedIn = false, me = null }) {
  const router = useRouter();
  const [view, setView] = useState('list');
  const [region, setRegion] = useState('');
  const [cat, setCat] = useState('');
  // 本地态：出席名单 + 我报名的集合（乐观更新，再 refresh 与服务端对齐）
  const [att, setAtt] = useState(() => ({ ...attendees }));
  const [mine, setMine] = useState(() => new Set(myIds));
  const [busy, setBusy] = useState(null);

  async function toggle(eid) {
    if (!loggedIn) { router.push('/api/auth/github'); return; }
    if (busy) return;
    setBusy(eid);
    const going = mine.has(eid);
    // 乐观更新
    setMine((s) => { const n = new Set(s); going ? n.delete(eid) : n.add(eid); return n; });
    setAtt((m) => {
      const list = (m[eid] || []).filter((p) => p.handle !== (me && me.handle));
      const next = going ? list : (me ? [...list, { handle: me.handle, name: me.name, avatar: me.avatar }] : list);
      return { ...m, [eid]: next };
    });
    try {
      const r = await fetch('/api/events/attend', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventId: eid }) });
      if (!r.ok) throw new Error('fail');
      router.refresh();
    } catch { /* 失败则回滚靠 refresh */ router.refresh(); }
    finally { setBusy(null); }
  }
  const td = today || new Date().toISOString().slice(0, 10);
  const tdM = useMemo(() => { const p = parseDate(td); return p ? { y: p.y, mo: p.mo } : { y: new Date().getFullYear(), mo: new Date().getMonth() + 1 }; }, [td]);
  const [calM, setCalM] = useState(tdM);

  const regions = useMemo(() => [...new Set(events.map((e) => e.region).filter(Boolean))], [events]);
  const cats = useMemo(() => [...new Set(events.map((e) => e.category).filter(Boolean))], [events]);
  const byFilter = (e) => (!region || e.region === region) && (!cat || e.category === cat);

  // 列表：仅未过期（无日期视为未定，保留），按时间正序
  const listItems = useMemo(() => events.filter((e) => byFilter(e) && (!e.start_at || e.start_at >= td))
    .sort((a, b) => (a.start_at || '9999').localeCompare(b.start_at || '9999')), [events, region, cat, td]);

  // 日历：当前 calM 月的全部活动（含过期）
  const calCells = useMemo(() => {
    const { y, mo } = calM;
    const startW = (new Date(y, mo - 1, 1).getDay() + 6) % 7;
    const days = new Date(y, mo, 0).getDate();
    const byDay = {};
    for (const e of events) { if (!byFilter(e)) continue; const p = parseDate(e.start_at); if (p && p.y === y && p.mo === mo) (byDay[p.d] = byDay[p.d] || []).push(e); }
    const cells = [];
    for (let i = 0; i < startW; i++) cells.push(null);
    for (let d = 1; d <= days; d++) cells.push({ d, ymd: `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`, evts: byDay[d] || [] });
    while (cells.length % 7) cells.push(null);
    return cells;
  }, [events, region, cat, calM]);

  const shiftMonth = (delta) => setCalM((m) => { let y = m.y, mo = m.mo + delta; if (mo < 1) { mo = 12; y--; } if (mo > 12) { mo = 1; y++; } return { y, mo }; });

  const Select = ({ value, onChange, allLabel, opts }) => (
    <select value={value} onChange={(e) => onChange(e.target.value)} style={{ width: '100%', background: 'var(--bg2,#0e1422)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', fontSize: 14 }}>
      <option value="">{allLabel}</option>
      {opts.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );

  return (
    <div>
      <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
          {['list', 'cal'].map((v) => (
            <button key={v} onClick={() => setView(v)} style={{ padding: '9px 0', border: 0, cursor: 'pointer', fontSize: 14, fontFamily: 'inherit', background: view === v ? 'var(--accent)' : 'transparent', color: view === v ? '#fff' : 'var(--text2)' }}>
              {v === 'list' ? (en ? 'List' : '列表') : (en ? 'Calendar' : '日历')}
            </button>
          ))}
        </div>
        <Select value={region} onChange={setRegion} allLabel={en ? 'All regions' : '全部区域'} opts={regions} />
        <Select value={cat} onChange={setCat} allLabel={en ? 'All types' : '全部类型'} opts={cats} />
      </div>

      {view === 'list' ? (
        listItems.length === 0 ? <div className="card" style={{ textAlign: 'center', color: 'var(--text2)' }}>{en ? 'No upcoming events.' : '暂无未过期的活动。'}</div> : (
          <div style={{ display: 'grid', gap: 12 }}>
            {listItems.map((e) => {
              const p = parseDate(e.start_at);
              return (
                <article key={e.id} className="card" style={{ display: 'grid', gap: 16, gridTemplateColumns: '92px 1fr auto', alignItems: 'center' }}>
                  <div style={{ border: '1px solid var(--accent)', borderRadius: 10, padding: '10px 6px', textAlign: 'center' }}>
                    <div className="hint" style={{ letterSpacing: '.1em' }}>{p ? MONTH_ZH[p.mo - 1] : '待定'}</div>
                    <div style={{ fontSize: 34, fontWeight: 700, lineHeight: 1 }}>{p ? String(p.d).padStart(2, '0') : '—'}</div>
                  </div>
                  <div>
                    <div className="hint" style={{ letterSpacing: '.06em' }}>{[e.region, e.category, e.price].filter(Boolean).join(' · ') || '—'}</div>
                    <h3 style={{ margin: '4px 0', fontSize: 18 }}>{e.title}</h3>
                    {e.description ? <p className="hint" style={{ lineHeight: 1.6 }}>{e.description}</p> : null}
                    <div className="hint" style={{ marginTop: 6 }}>{[e.time_text, e.venue, e.host].filter(Boolean).join(' / ')}</div>
                    {(att[e.id] && att[e.id].length) ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                        <AvatarStack people={att[e.id]} en={en} />
                        <span className="hint">{att[e.id].length} {en ? 'going' : '人去'}{mine.has(e.id) ? (en ? ' · incl. you' : ' · 含你') : ''}</span>
                      </div>
                    ) : null}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'stretch' }}>
                    <button onClick={() => toggle(e.id)} disabled={busy === e.id}
                      className={mine.has(e.id) ? 'btn btn-ghost' : 'btn'}
                      style={{ whiteSpace: 'nowrap', cursor: 'pointer' }}>
                      {mine.has(e.id) ? (en ? '✓ Going' : '✓ 我去') : (en ? '+ I’m going' : '+ 我去')}
                    </button>
                    {e.signup_url ? <a className="btn btn-ghost" href={e.signup_url} target="_blank" rel="noopener noreferrer" style={{ whiteSpace: 'nowrap' }}>{en ? 'Sign up ↗' : '官方报名 ↗'}</a> : null}
                  </div>
                </article>
              );
            })}
          </div>
        )
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
            <div>
              <div className="hint" style={{ letterSpacing: '.2em' }}>MONTH VIEW</div>
              <h3 style={{ margin: '2px 0 0' }}>{calM.y} 年 {calM.mo} 月</h3>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn btn-ghost" style={{ padding: '4px 12px' }} onClick={() => shiftMonth(-1)}>‹ {en ? 'Prev' : '上月'}</button>
              <button className="btn btn-ghost" style={{ padding: '4px 12px' }} onClick={() => setCalM(tdM)}>{en ? 'Today' : '本月'}</button>
              <button className="btn btn-ghost" style={{ padding: '4px 12px' }} onClick={() => shiftMonth(1)}>{en ? 'Next' : '下月'} ›</button>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', borderBottom: '1px solid var(--border)', textAlign: 'center' }}>
            {WEEK.map((w) => <div key={w} className="hint" style={{ padding: '8px 4px', letterSpacing: '.12em' }}>{w}</div>)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)' }}>
            {calCells.map((c, i) => (
              <div key={i} style={{ minHeight: 92, borderBottom: '1px solid var(--border)', borderRight: (i % 7 === 6) ? 0 : '1px solid var(--border)', padding: 6, background: c ? (c.ymd === td ? 'rgba(120,140,255,0.08)' : 'transparent') : 'rgba(255,255,255,0.02)' }}>
                {c ? <>
                  <div className="hint">{c.d}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
                    {c.evts.map((e) => {
                      const past = e.start_at && e.start_at < td;
                      const label = (e.title.length > 16 ? e.title.slice(0, 16) + '…' : e.title);
                      const ppl = att[e.id] || [];
                      const inner = <><div style={{ fontSize: 11, fontWeight: 600, lineHeight: 1.2 }}>{label}</div>{e.time_text ? <div className="hint" style={{ fontSize: 10 }}>{e.time_text}</div> : null}{ppl.length ? <div style={{ marginTop: 3 }}><AvatarStack people={ppl} size={18} max={5} en={en} /></div> : null}</>;
                      const baseStyle = { border: `1px solid ${past ? 'var(--border)' : 'var(--accent)'}`, borderRadius: 5, padding: '2px 4px', opacity: past ? 0.5 : 1 };
                      // 过期：灰显、不可报名（纯展示，让用户知道错过了）；未过期：可点报名
                      return past || !e.signup_url
                        ? <div key={e.id} title={past ? (en ? 'ended' : '已结束') : ''} style={{ ...baseStyle, color: 'var(--text2)' }}>{inner}</div>
                        : <a key={e.id} href={e.signup_url} target="_blank" rel="noopener noreferrer" style={{ ...baseStyle, color: 'var(--text)', textDecoration: 'none' }}>{inner}</a>;
                    })}
                  </div>
                </> : null}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
