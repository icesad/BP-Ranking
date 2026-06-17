'use client';
import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { t } from '@/lib/i18n';
import LanguageToggle from '@/components/LanguageToggle';

// 核心入口常驻；其余收进"更多"下拉，避免导航栏拥挤
const primaryLinks = [
  { href: '/demos', key: 'nav.demo' },
  { href: '/bp', key: 'nav.bp' },
  { href: '/feed', key: 'nav.feed' },
  { href: '/match', key: 'nav.match' },
];
const moreLinks = [
  { href: '/news', key: 'nav.news' },
  { href: '/events', key: 'nav.events' },
  { href: '/resources', key: 'nav.resources' },
  { href: '/sectors', key: 'nav.sectors' },
  { href: '/following', key: 'nav.following' },
  { href: '/portfolio', key: 'nav.portfolio' },
  { href: '/investors', key: 'nav.investors' },
];

export default function Nav({ locale = 'zh', user = null }) {
  const pathname = usePathname();
  const en = locale === 'en';
  const [moreOpen, setMoreOpen] = useState(false);
  const [morePos, setMorePos] = useState(null);
  const moreBtn = useRef(null);
  function toggleMore() {
    if (!moreOpen && moreBtn.current) {
      const r = moreBtn.current.getBoundingClientRect();
      setMorePos({ top: r.bottom + 6, left: r.left });
    }
    setMoreOpen((v) => !v);
  }
  // 详情页 /bp/[id] 为 BP 与 Demo 共用，按项目 kind 决定右上角入口
  const [detailKind, setDetailKind] = useState(null);
  useEffect(() => {
    const m = pathname.match(/^\/bp\/(\d+)$/);
    if (!m) { setDetailKind(null); return; }
    fetch(`/api/kind/${m[1]}`).then((r) => r.json()).then((d) => setDetailKind(d.kind || null)).catch(() => setDetailKind(null));
  }, [pathname]);
  const isBpCta = pathname === '/bp' || (/^\/bp\/\d+$/.test(pathname) && detailKind === 'bp');
  return (
    <nav className="nav">
      <div className="nav-inner">
        <Link href="/demos" className="logo"><span>Demo</span>-Ranking</Link>
        <div className="nav-links">
          {primaryLinks.map((l) => (
            <Link key={l.href} href={l.href} className={pathname === l.href ? 'active' : ''}>
              {t(locale, l.key)}
            </Link>
          ))}
          <button ref={moreBtn} type="button" onClick={toggleMore} className={moreLinks.some((l) => l.href === pathname) ? 'active' : ''}
            style={{ background: 'none', border: 0, color: 'var(--text2)', cursor: 'pointer', font: 'inherit', fontSize: 14, padding: '6px 12px', whiteSpace: 'nowrap', borderRadius: 8 }}>
            {en ? 'More ▾' : '更多 ▾'}
          </button>
        </div>
        {moreOpen && (
          <>
            <div onClick={() => setMoreOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 60 }} />
            <div style={{ position: 'fixed', top: morePos?.top || 56, left: morePos?.left || 16, background: 'var(--card,#161c2e)', border: '1px solid var(--border)', borderRadius: 10, padding: 6, minWidth: 140, zIndex: 61, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
              {moreLinks.map((l) => (
                <Link key={l.href} href={l.href} onClick={() => setMoreOpen(false)}
                  style={{ display: 'block', padding: '8px 12px', borderRadius: 6, color: pathname === l.href ? 'var(--accent)' : 'var(--text)', textDecoration: 'none', whiteSpace: 'nowrap' }}>
                  {t(locale, l.key)}
                </Link>
              ))}
            </div>
          </>
        )}
        <form action="/search" className="nav-search">
          <input type="text" name="q" placeholder={t(locale, 'nav.search')} aria-label="search" />
        </form>
        <LanguageToggle locale={locale} />
        <Link href={isBpCta ? '/upload' : '/upload-demo'} className="btn">{t(locale, isBpCta ? 'nav.upload' : 'nav.uploadDemo')}</Link>
        {user ? (
          <span className="nav-user" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Link href={`/u/${user.handle}`} title={user.name || user.handle} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {user.avatar ? <img src={user.avatar} alt="" width={24} height={24} style={{ borderRadius: '50%' }} /> : <span>👤</span>}
              <span className="hide-mobile">{user.handle}</span>
            </Link>
            {typeof user.points === 'number' ? <span className="hint" title={en ? 'Points' : '积分'} style={{ color: 'var(--gold)' }}>🪙{user.points}</span> : null}
            <a href="/api/auth/logout" className="hint" title={en ? 'Log out' : '退出'}>{en ? 'Log out' : '退出'}</a>
          </span>
        ) : (
          <a href="/api/auth/github" className="btn btn-ghost">{en ? 'Sign in' : '登录'}</a>
        )}
      </div>
    </nav>
  );
}
