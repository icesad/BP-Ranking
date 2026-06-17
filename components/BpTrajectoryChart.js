'use client';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

function fmt(n) {
  if (Math.abs(n) >= 100000000) return (n / 100000000).toFixed(1) + '亿';
  if (Math.abs(n) >= 10000) return (n / 10000).toFixed(0) + '万';
  return String(n);
}

export default function BpTrajectoryChart({ data }) {
  if (!data || data.length < 2) {
    return <p className="hint">注资记录还太少，画不出走势——多经历几次调仓 / 重新参战后再来看。</p>;
  }
  return (
    <div style={{ width: '100%', height: 240 }}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="gbp" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#34d399" stopOpacity={0.5} />
              <stop offset="100%" stopColor="#34d399" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#252c3d" strokeDasharray="3 3" />
          <XAxis dataKey="date" stroke="#9aa4b8" fontSize={11} />
          <YAxis tickFormatter={fmt} stroke="#9aa4b8" fontSize={11} width={50} />
          <Tooltip
            formatter={(v) => [fmt(v), '累计注资']}
            contentStyle={{ background: '#161b27', border: '1px solid #252c3d', borderRadius: 10, color: '#e8ecf4' }}
          />
          <Area type="monotone" dataKey="total" stroke="#34d399" strokeWidth={2} fill="url(#gbp)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
