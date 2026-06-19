'use client';
import { useRouter } from 'next/navigation';

// 全局城市切换：切换后 OPC指南/资讯/活动/资源对接 等城市专属内容随之变化（cookie: city）。
export default function CityToggle({ cities = ['上海'], current = '上海' }) {
  const router = useRouter();
  function pick(c) {
    document.cookie = `city=${encodeURIComponent(c)};path=/;max-age=${3600 * 24 * 365};samesite=lax`;
    router.refresh();
  }
  return (
    <select value={current} onChange={(e) => pick(e.target.value)} title="切换城市"
      style={{ background: 'transparent', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 8, padding: '5px 8px', fontSize: 13, cursor: 'pointer' }}>
      {cities.map((c) => <option key={c} value={c} style={{ color: '#111' }}>📍 {c}</option>)}
    </select>
  );
}
