'use client';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';

function fmt(n) {
  if (Math.abs(n) >= 100000000) return (n / 100000000).toFixed(1) + '亿';
  return (n / 10000).toFixed(0) + '万';
}

const NAMES = { bp: 'BP赛道已投', demo: 'Demo赛道已投' };

export default function TrajectoryChart({ data }) {
  if (!data?.length) return <p className="hint">暂无持仓变化记录</p>;
  return (
    <div style={{ width: '100%', height: 280 }}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4f8cff" stopOpacity={0.5} />
              <stop offset="100%" stopColor="#4f8cff" stopOpacity={0.05} />
            </linearGradient>
            <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.5} />
              <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#252c3d" strokeDasharray="3 3" />
          <XAxis dataKey="date" stroke="#9aa4b8" fontSize={11} />
          <YAxis tickFormatter={fmt} stroke="#9aa4b8" fontSize={11} width={50} />
          <Tooltip
            formatter={(v, name) => [fmt(v), NAMES[name] || name]}
            contentStyle={{ background: '#161b27', border: '1px solid #252c3d', borderRadius: 10, color: '#e8ecf4' }}
          />
          <Legend formatter={(v) => NAMES[v] || v} wrapperStyle={{ fontSize: 12 }} />
          <Area type="stepAfter" dataKey="bp" stroke="#4f8cff" strokeWidth={2} fill="url(#g1)" />
          <Area type="stepAfter" dataKey="demo" stroke="#8b5cf6" strokeWidth={2} fill="url(#g2)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
