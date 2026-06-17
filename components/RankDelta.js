// 排名涨跌角标：delta>0 上升，<0 下滑，0/空 不显示
export default function RankDelta({ delta }) {
  if (!delta) return null;
  const up = delta > 0;
  return (
    <span className={`rank-delta ${up ? 'rank-delta-up' : 'rank-delta-down'}`} title="近7天排名变化">
      {up ? '▲' : '▼'}{Math.abs(delta)}
    </span>
  );
}
