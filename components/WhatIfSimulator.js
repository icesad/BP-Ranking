'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

// 改进建议（诚实版）：每条锚定一个评分卡弱项，说清"补什么证据能把这维提上去"，
// 用定性潜力(低/中/高)而非编造的估值百分比。勾选后只展示"会补强哪些维度"，不预测具体金额。
const DIM_LABEL = {
  feature: { zh: '功能', en: 'Feature' }, differentiation: { zh: '差异化', en: 'Differentiate' },
  avoid: { zh: '避开竞品', en: 'Avoid' }, visual: { zh: '视觉', en: 'Visual' },
  ux: { zh: '操作动线', en: 'UX' }, growth: { zh: '增长', en: 'Growth' },
  coldstart: { zh: '冷启动', en: 'Cold-start' }, tech: { zh: '技术', en: 'Tech' }, moat: { zh: '护城河', en: 'Moat' },
};
const EFFORT_EN = { 低: 'Low', 中: 'Med', 高: 'High' };
const RDIMS = ['completeness', 'validation', 'commercial', 'maintainability', 'market', 'moat'];
const RDIM_LABEL = {
  completeness: { zh: '完成度', en: 'Complete' }, validation: { zh: '验证', en: 'Validation' },
  commercial: { zh: '商业化', en: 'Commercial' }, maintainability: { zh: '可维护', en: 'Maintain' },
  market: { zh: '市场', en: 'Market' }, moat: { zh: '壁垒', en: 'Moat' },
};
const POT_COLOR = { 高: 'var(--green)', 中: 'var(--accent)', 低: 'var(--text2)' };
const POT_EN = { 低: 'Low', 中: 'Med', 高: 'High' };

function fmt(n) {
  const a = Math.abs(n);
  if (a >= 1e8) return (n / 1e8).toFixed(2) + '亿';
  if (a >= 1e4) return (n / 1e4).toFixed(1) + '万';
  return Math.round(n).toLocaleString();
}

// 六维雷达（纯 SVG）。highlight=被选中建议主要补强的维度集合 → 高亮其轴标签
function Radar({ rubric, en, highlight }) {
  if (!rubric) return null;
  const size = 200, cx = size / 2, cy = size / 2, R = 72;
  const pt = (i, r) => { const a = -Math.PI / 2 + (i * 2 * Math.PI) / 6; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; };
  const ring = (f) => RDIMS.map((_, i) => pt(i, R * f).join(',')).join(' ');
  const scores = RDIMS.map((d) => Math.max(0, Math.min(100, Number(rubric[d]?.score) || 0)));
  const poly = scores.map((s, i) => pt(i, R * (s / 100)).join(',')).join(' ');
  return (
    <svg viewBox={`0 0 ${size} ${size}`} style={{ width: '100%', maxWidth: 240, display: 'block', margin: '0 auto' }}>
      {[0.25, 0.5, 0.75, 1].map((f) => <polygon key={f} points={ring(f)} fill="none" stroke="var(--border)" strokeWidth="1" />)}
      {RDIMS.map((d, i) => { const [x, y] = pt(i, R); return <line key={d} x1={cx} y1={cy} x2={x} y2={y} stroke="var(--border)" strokeWidth="1" />; })}
      <polygon points={poly} fill="rgba(120,140,255,0.18)" stroke="var(--accent)" strokeWidth="1.5" />
      {RDIMS.map((d, i) => {
        const [x, y] = pt(i, R + 14); const on = highlight?.has(d);
        return <text key={d} x={x} y={y} fontSize="9" fontWeight={on ? 700 : 400} fill={on ? 'var(--green)' : 'var(--text2)'} textAnchor="middle" dominantBaseline="middle">{RDIM_LABEL[d][en ? 'en' : 'zh']}{on ? ' ↑' : ''}</text>;
      })}
    </svg>
  );
}

export default function WhatIfSimulator({ bpId, low, high, suggestions = [], rubric = null, en = false }) {
  const router = useRouter();
  const [list, setList] = useState(suggestions);
  const [checked, setChecked] = useState({});
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  async function generate() {
    setLoading(true); setErr('');
    try {
      const res = await fetch(`/api/suggest/${bpId}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) { setErr(data.error || (en ? 'Failed' : '生成失败')); return; }
      setList(data.suggestions || []); setChecked({});
      router.refresh(); // 首次生成会补算并存入 rubric → 刷新服务端数据让雷达图即时出现
    } catch { setErr(en ? 'Network error' : '网络错误'); }
    finally { setLoading(false); }
  }

  const sel = list.filter((s) => checked[s.id]);
  // 被选中建议主要补强的弱项维度（计数）
  const dimCount = {};
  for (const s of sel) { if (s.rubric_dim) dimCount[s.rubric_dim] = (dimCount[s.rubric_dim] || 0) + 1; }
  const highlight = new Set(Object.keys(dimCount));

  return (
    <details className="val-ev" open>
      <summary>🛠 {en ? 'Improvement suggestions (scorecard-based)' : '改进建议（基于评分卡弱项）'}</summary>

      {list.length === 0 ? (
        <div style={{ padding: '6px 0' }}>
          <p className="hint">{en ? 'Concrete actions targeting your weakest scorecard dimensions — each says what verifiable evidence would actually lift it.' : '针对评分卡里最弱的几个维度给出具体动作，每条说明"补什么可核实证据才能真正把它提上去"。'}</p>
          <button className="btn" onClick={generate} disabled={loading}>{loading ? (en ? 'Generating…' : '生成中…') : (en ? 'Generate suggestions' : '生成改进建议')}</button>
          {err ? <p className="hint" style={{ color: 'var(--red)' }}>{err}</p> : null}
        </div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ flex: '1 1 300px', minWidth: 280 }}>
            {list.map((s) => {
              const dl = DIM_LABEL[s.dim] || { zh: s.dim, en: s.dim };
              const rl = RDIM_LABEL[s.rubric_dim];
              return (
                <label key={s.id} style={{ display: 'block', padding: '8px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <input type="checkbox" checked={!!checked[s.id]} onChange={(e) => setChecked({ ...checked, [s.id]: e.target.checked })} />
                    <span className="badge badge-llm">{dl[en ? 'en' : 'zh']}</span>
                    {rl ? <span className="hint">→ {rl[en ? 'en' : 'zh']}</span> : null}
                    <b style={{ fontSize: 14 }}>{en ? (s.en?.title || s.title) : s.title}</b>
                    <span style={{ marginLeft: 'auto', fontSize: 12, color: POT_COLOR[s.potential] || 'var(--text2)' }}>{en ? `Potential ${POT_EN[s.potential] || s.potential}` : `潜力${s.potential}`}</span>
                  </div>
                  <div className="hint" style={{ paddingLeft: 22 }}>{en ? (s.en?.detail || s.detail) : s.detail}</div>
                  {(s.evidence_needed || s.en?.evidence_needed) ? (
                    <div className="hint" style={{ paddingLeft: 22, marginTop: 2 }}>🎯 {en ? 'Proof needed: ' : '需补证据：'}{en ? (s.en?.evidence_needed || s.evidence_needed) : s.evidence_needed}</div>
                  ) : null}
                  <div className="hint" style={{ paddingLeft: 22 }}>{en ? 'effort' : '工作量'} {en ? (EFFORT_EN[s.effort] || s.effort) : s.effort}
                    {s.evidence_url ? <> · <a href={s.evidence_url} target="_blank" rel="noopener noreferrer">{en ? 'ref' : '参考'}</a></> : null}</div>
                </label>
              );
            })}
            <button className="btn btn-ghost" onClick={generate} disabled={loading} style={{ marginTop: 8 }}>{loading ? '…' : (en ? 'Regenerate' : '重新生成建议')}</button>
            {err ? <p className="hint" style={{ color: 'var(--red)' }}>{err}</p> : null}
          </div>

          <div style={{ flex: '1 1 220px', minWidth: 200 }}>
            <Radar rubric={rubric} en={en} highlight={highlight} />
            <div style={{ textAlign: 'center', marginTop: 8 }}>
              <div className="hint">{en ? 'Current valuation' : '当前估值'}</div>
              <div className="val-range" style={{ fontSize: 16 }}>{fmt(low)} – {fmt(high)}</div>
              {sel.length > 0 ? (
                <div className="hint" style={{ marginTop: 8, color: 'var(--green)' }}>
                  {en ? `Adopting ${sel.length} mainly strengthens: ` : `采纳 ${sel.length} 条主要补强：`}
                  {Object.entries(dimCount).map(([d, c]) => `${RDIM_LABEL[d]?.[en ? 'en' : 'zh'] || d}${c > 1 ? `×${c}` : ''}`).join('、')}
                </div>
              ) : (
                <p className="hint" style={{ marginTop: 8, fontSize: 11 }}>{en ? 'Check suggestions to see which weak dimensions they target.' : '勾选建议，看它们主要补强哪些弱项维度。'}</p>
              )}
            </div>
            <p className="hint" style={{ marginTop: 8, fontSize: 11 }}>{en ? 'No fabricated % uplift: real valuation change only comes after you ship the improvement and re-value with verifiable evidence.' : '不预测百分比：真实估值变化只会在改进上线、并用可核实证据重新估值后体现。'}</p>
          </div>
        </div>
      )}
    </details>
  );
}
