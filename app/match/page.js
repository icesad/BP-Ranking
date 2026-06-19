import Link from 'next/link';
import { cookies } from 'next/headers';
import { getSessionUser } from '@/lib/auth';
import { matchCandidates } from '@/lib/queries';
import { avatarDataUri } from '@/lib/avatar';

export const dynamic = 'force-dynamic';

export default function MatchPage({ searchParams }) {
  const en = cookies().get('lang')?.value === 'en';
  const u = getSessionUser();
  const mode = searchParams?.mode === 'complement' ? 'complement' : 'similar';

  if (!u) {
    return (
      <div>
        <h1 className="page-title">🤝 {en ? 'Find buddies' : '找搭子'}</h1>
        <div className="card" style={{ textAlign: 'center', color: 'var(--text2)' }}>
          <a href="/api/auth/github" style={{ color: 'var(--accent)' }}>{en ? 'Sign in' : '登录'}</a> {en ? 'to find profile-matched buddies.' : '后按画像匹配找契合的搭子。'}
        </div>
      </div>
    );
  }

  const res = matchCandidates(u.uid, mode);

  return (
    <div>
      <h1 className="page-title">🤝 {en ? 'Find buddies' : '找搭子'}</h1>
      <p className="page-sub">{en ? 'Matched by your ability profile. For reference; connect via their profile links.' : '按你的能力画像匹配。仅供参考——通过对方主页的社媒链接建立联系。'}</p>

      {!res.ok ? (
        <div className="card" style={{ textAlign: 'center', color: 'var(--text2)' }}>
          {en ? <>Generate your profile first on <Link href={`/u/${u.handle}`} style={{ color: 'var(--accent)' }}>your page</Link>.</> : <>请先到 <Link href={`/u/${u.handle}`} style={{ color: 'var(--accent)' }}>个人主页</Link> 生成你的画像，才能匹配。</>}
        </div>
      ) : (
        <>
          <div className="filter-row" style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <a href="/match" className={`badge ${mode === 'similar' ? 'badge-llm' : 'badge-public'}`}>{en ? 'Similar (kindred)' : '志同道合'}</a>
            <a href="/match?mode=complement" className={`badge ${mode === 'complement' ? 'badge-llm' : 'badge-public'}`}>{en ? 'Complementary' : '能力互补'}</a>
          </div>

          {res.items.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', color: 'var(--text2)' }}>
              {en ? 'No other users with profiles yet. Invite friends to generate theirs!' : '还没有其他生成了画像的用户。等更多人生成画像后这里就有匹配了。'}
            </div>
          ) : res.items.map((m) => (
            <div key={m.handle} className="rank-row">
              <div className="rank-main" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <img src={m.avatar || avatarDataUri(m.handle)} alt="" width={36} height={36} style={{ borderRadius: '50%' }} />
                <div>
                  <div className="rank-title"><Link href={`/u/${m.handle}`}>{m.name || m.handle}</Link> <span className="hint">@{m.handle}</span></div>
                  <div className="rank-sub">{m.reason}</div>
                </div>
              </div>
              <div className="rank-metrics">
                <div className="rank-amount" style={{ color: 'var(--accent)' }}>{m.pct}%</div>
                <div className="rank-investors"><Link href={`/u/${m.handle}`}>{en ? 'view / connect' : '查看 / 联系'}</Link></div>
              </div>
            </div>
          ))}
          <p className="hint" style={{ marginTop: 12 }}>{en ? 'Same-gender buddy/teammate matching only; profiles are public. Dating-style matching is intentionally not built.' : '仅做找搭子/队友匹配，基于公开画像；相亲类匹配有意不做（实名/隐私/安全成本高）。'}</p>
        </>
      )}
    </div>
  );
}
