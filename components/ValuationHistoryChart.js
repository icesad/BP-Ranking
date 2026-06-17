'use client';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

function fmt(n, en, rate = 7.2) {
  if (en) {
    const usd = n / (rate || 7.2);
    if (Math.abs(usd) >= 1e9) return '$' + (usd / 1e9).toFixed(1) + 'B';
    if (Math.abs(usd) >= 1e6) return '$' + (usd / 1e6).toFixed(1) + 'M';
    if (Math.abs(usd) >= 1e3) return '$' + (usd / 1e3).toFixed(0) + 'K';
    return '$' + Math.round(usd);
  }
  if (Math.abs(n) >= 1e8) return (n / 1e8).toFixed(1) + '亿';
  if (Math.abs(n) >= 1e4) return (n / 1e4).toFixed(0) + '万';
  return String(Math.round(n));
}

export default function ValuationHistoryChart({ data, en = false, rate = 7.2 }) {
  if (!data || data.length < 2) return null;
  return (
    <div style={{ width: '100%', height: 200, marginTop: 10 }}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="vband" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fbbf24" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#fbbf24" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#252c3d" strokeDasharray="3 3" />
          <XAxis dataKey="date" stroke="#9aa4b8" fontSize={11} />
          <YAxis tickFormatter={(n) => fmt(n, en, rate)} stroke="#9aa4b8" fontSize={11} width={56} />
          <Tooltip
            formatter={(v, name) => [fmt(v, en, rate), name === 'high' ? (en ? 'High' : '上限') : (en ? 'Low' : '下限')]}
            contentStyle={{ background: '#161b27', border: '1px solid #252c3d', borderRadius: 10, color: '#e8ecf4' }}
          />
          <Area type="monotone" dataKey="high" stroke="#fbbf24" strokeWidth={2} fill="url(#vband)" />
          <Area type="monotone" dataKey="low" stroke="#f59e0b" strokeWidth={2} fill="none" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
