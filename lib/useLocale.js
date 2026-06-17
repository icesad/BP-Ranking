'use client';
import { useEffect, useState } from 'react';

// 客户端读取语言（cookie）。SSR/首帧返回 'zh'，挂载后若 cookie 为 en 则切换。
export function useLocale() {
  const [locale, setLocale] = useState('zh');
  useEffect(() => {
    try {
      if (document.cookie.split('; ').some((c) => c === 'lang=en')) setLocale('en');
    } catch {}
  }, []);
  return locale;
}
