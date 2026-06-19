'use client';
import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { t } from '@/lib/i18n';
import LanguageToggle from '@/components/LanguageToggle';
import CityToggle from '@/components/CityToggle';

// 核心入口常驻；其余收进"更多"下拉，避免导航栏拥挤
const primaryLinks = [
  { href: '/demos', key: 'nav.demo' },
  { href: '/bp', key: 'nav.bp' },
  { href: '/feed', key: 'nav.feed' },
  { href: '/match', key: 'nav.match' },
];
// 城市专属（随顶部城市切换而变）
const cityLinks = [
  { href: '/opc', key: 'nav.opc' },
  { href: '/news', key: 'nav.news' },
  { href: '/events', key: 'nav.events' },
  { href: '/resources', key: 'nav.resources' },
];
// 全站（与城市无关）
const globalLinks = [
  { href: '/sectors', key: 'nav.sectors' },
  { href: '/following', key: 'nav.following' },
  { href: '/portfolio', key: 'nav.portfolio' },
  { href: '/investors', key: 'nav.investors' },
];
const moreLinks = [...cityLinks, ...globalLinks];

export default function Nav({ locale = 'zh', user = null, city = '上海', cities = ['上海'] }) {
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
        </div>
        <button ref={moreBtn} type="button" onClick={toggleMore} className={moreLinks.some((l) => l.href === pathname) ? 'active' : ''}
          style={{ flex: '0 0 auto', background: 'none', border: '1px solid var(--border)', color: 'var(--text2)', cursor: 'pointer', font: 'inherit', fontSize: 14, padding: '6px 12px', whiteSpace: 'nowrap', borderRadius: 8 }}>
          {en ? 'More ▾' : '更多 ▾'}
        </button>
        {moreOpen && (
          <>
            <div onClick={() => setMoreOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 60 }} />
            <div style={{ position: 'fixed', top: morePos?.top || 56, left: morePos?.left || 16, background: 'var(--card,#161c2e)', border: '1px solid var(--border)', borderRadius: 10, padding: 6, minWidth: 180, zIndex: 61, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
              <div style={{ padding: '4px 12px', fontSize: 11, color: 'var(--accent)', letterSpacing: '.05em' }}>📍 {city} · {en ? 'local (changes by city)' : '本地（随城市切换）'}</div>
              {cityLinks.map((l) => (
                <Link key={l.href} href={l.href} onClick={() => setMoreOpen(false)}
                  style={{ display: 'block', padding: '8px 12px', borderRadius: 6, color: pathname === l.href ? 'var(--accent)' : 'var(--text)', textDecoration: 'none', whiteSpace: 'nowrap' }}>
                  {t(locale, l.key)}
                </Link>
              ))}
              <div style={{ borderTop: '1px solid var(--border)', margin: '6px 0' }} />
              <div style={{ padding: '4px 12px', fontSize: 11, color: 'var(--text2)', letterSpacing: '.05em' }}>{en ? 'site-wide' : '全站'}</div>
              {globalLinks.map((l) => (
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
        <CityToggle cities={cities} current={city} />
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
