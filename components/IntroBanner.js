'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { t } from '@/lib/i18n';

const KEY = 'bpr_intro_seen';

export default function IntroBanner({ locale = 'zh' }) {
  const [show, setShow] = useState(false);
  useEffect(() => { try { if (!localStorage.getItem(KEY)) setShow(true); } catch {} }, []);
  if (!show) return null;
  function close() { try { localStorage.setItem(KEY, '1'); } catch {} setShow(false); }
  return (
    <div className="intro-banner">
      <button className="intro-close" onClick={close} aria-label="关闭 / close">×</button>
      <b>{t(locale, 'intro.title')}</b>
      <p>{t(locale, 'intro.body')}</p>
      <div className="intro-actions">
        <Link href="/upload" className="btn" onClick={close}>{t(locale, 'intro.cta1')}</Link>
        <Link href="/demos" className="btn btn-ghost" onClick={close}>{t(locale, 'intro.cta2')}</Link>
      </div>
    </div>
  );
}
