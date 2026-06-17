import Link from 'next/link';
import { cookies } from 'next/headers';
import { controversialBoard, consensusLevel } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export default function ControversialPage() {
  const en = cookies().get('lang')?.value === 'en';
  const rows = controversialBoard(30);

  return (
    <div>
      <h1 className="page-title">🔥 {en ? 'Controversial' : '争议榜'}</h1>
      <p className="page-sub">{en ? 'Projects the 12 investors disagree on most — some pile in, some pass. Ranked by score spread.' : '12 位投资人分歧最大的项目——有人重仓、有人看衰，往往最有意思。按评分区间排序。'}</p>

      {rows.length === 0 ? (
        <p className="hint">{en ? 'Not enough evaluation data yet.' : '还没有足够的评估数据。'}</p>
      ) : rows.map((r, i) => {
        const isPublic = r.visibility === 'public';
        const cons = consensusLevel(r.spread);
        const inner = (
          <>
            <div className="rank-num">{i + 1}</div>
            <div className="rank-main">
              <div className="rank-title">
                {isPublic ? r.title : (en ? '🔒 A mystery BP (AI-only)' : '🔒 一份神秘的BP（仅AI可见）')}{' '}
                <span className={`badge ${cons.cls}`}>{en ? cons.labelEn : cons.label}</span>
              </div>
              <div className="rank-sub">{isPublic ? r.founder : (en ? 'Anonymous' : '匿名参战')} · {en ? 'range' : '评分区间'} {r.lo}–{r.hi}（{en ? 'avg' : '均分'} {r.avg}）</div>
            </div>
            <div className="rank-metrics">
              <div className="rank-amount" style={{ color: 'var(--gold)' }}>{en ? 'spread' : '分歧'} {r.spread}</div>
              <div className="rank-investors">{en ? `high ${r.hi} / low ${r.lo}` : `最高 ${r.hi} / 最低 ${r.lo}`}</div>
            </div>
          </>
        );
        return isPublic
          ? <Link href={`/bp/${r.id}`} key={r.id} className="rank-row">{inner}</Link>
          : <div key={r.id} className="rank-row" style={{ opacity: 0.75 }}>{inner}</div>;
      })}
    </div>
  );
}
