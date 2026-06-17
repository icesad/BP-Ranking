import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { userByHandle, userProjects, fmtMoney, userPoints, userProfile, userSocials } from '@/lib/queries';
import { ARCHETYPE_LABELS, ARCHETYPE_LABELS_EN, L } from '@/lib/engine';
import { getSessionUser } from '@/lib/auth';
import ProfilePanel from '@/components/ProfilePanel';

export const dynamic = 'force-dynamic';

export default function ProfilePage({ params }) {
  const locale = cookies().get('lang')?.value === 'en' ? 'en' : 'zh';
  const en = locale === 'en';
  const user = userByHandle(params.handle);
  if (!user) notFound();
  const me = getSessionUser();
  const isMe = me && me.uid === user.id;
  const projects = userProjects(user.id);
  const totalInvested = projects.reduce((s, p) => s + (p.total_invested || 0), 0);
  const valued = projects.filter((p) => p.valN > 0);
  const profile = userProfile(user.id);
  const socials = userSocials(user.id);

  return (
    <div>
      <div className="card" style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        {user.avatar ? <img src={user.avatar} alt="" width={64} height={64} style={{ borderRadius: '50%' }} /> : <div style={{ fontSize: 48 }}>👤</div>}
        <div style={{ flex: 1, minWidth: 200 }}>
          <h1 className="page-title" style={{ marginBottom: 2 }}>{user.name || user.handle}</h1>
          <div className="hint">@{user.handle}{user.github_login ? <> · <a href={`https://github.com/${user.github_login}`} target="_blank" rel="noopener noreferrer">GitHub ↗</a></> : null}{isMe ? <> · <a href="/api/auth/logout">{en ? 'Log out' : '退出登录'}</a></> : null}</div>
          {user.bio ? <p className="hint" style={{ marginTop: 6 }}>{user.bio}</p> : null}
        </div>
      </div>

      <div className="stats-bar">
        <div className="stat"><b>{projects.length}</b><span>{en ? 'Projects' : '作品数'}</span></div>
        <div className="stat"><b>{valued.length}</b><span>{en ? 'Valued' : '已估值'}</span></div>
        <div className="stat"><b style={{ color: 'var(--green)' }}>{fmtMoney(totalInvested, locale)}</b><span>{en ? 'Total invested (virtual)' : '累计虚拟注资'}</span></div>
        {isMe ? <div className="stat"><b style={{ color: 'var(--gold)' }}>🪙 {userPoints(user.id)}</b><span>{en ? 'Points' : '积分余额'}</span></div> : null}
      </div>

      <ProfilePanel profile={profile} socials={socials} isMe={isMe} en={en} />

      <h2 className="section-title">{en ? 'Works' : 'TA 的作品'}</h2>
      {projects.length === 0 ? (
        <div className="card" style={{ color: 'var(--text2)', textAlign: 'center' }}>
          {isMe ? (en ? 'You have no works yet — submit a Demo or BP to claim it here.' : '你还没有作品——提交一个 Demo 或 BP，它就会归到这里。') : (en ? 'No public works yet.' : '暂无公开作品。')}
        </div>
      ) : projects.map((p) => {
        const pub = p.visibility === 'public';
        const title = pub ? p.title : (en ? '🔒 A mystery project (AI-only)' : '🔒 神秘项目（仅AI可见）');
        return (
          <div key={p.id} className="rank-row">
            <div className="rank-main">
              <div className="rank-title">
                {pub ? <Link href={`/bp/${p.id}`}>{title}</Link> : <span>{title}</span>}{' '}
                <span className={`badge ${p.kind === 'demo' ? 'badge-famous' : 'badge-llm'}`}>{p.kind === 'demo' ? 'Demo' : 'BP'}</span>
                {p.archetype && ARCHETYPE_LABELS[p.archetype] ? <span className="badge badge-public">{L(ARCHETYPE_LABELS, ARCHETYPE_LABELS_EN, p.archetype, locale)}</span> : null}
              </div>
              <div className="rank-sub">
                {p.valN > 0 ? <>{en ? 'Valuation ' : '估值 '}{fmtMoney(p.valLow, locale)}–{fmtMoney(p.valHigh, locale)}</> : (en ? 'Not valued yet' : '尚未估值')}
              </div>
            </div>
            <div className="rank-metrics">
              <div className="rank-amount" style={{ color: 'var(--green)' }}>{fmtMoney(p.total_invested, locale)}</div>
              <div className="rank-investors">{en ? 'invested' : '注资'}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
