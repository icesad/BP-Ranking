'use client';

export default function LanguageToggle({ locale }) {
  function set(l) {
    document.cookie = `lang=${l}; path=/; max-age=31536000`;
    location.reload();
  }
  return (
    <button className="btn btn-ghost lang-btn" onClick={() => set(locale === 'en' ? 'zh' : 'en')} title="切换语言 / Switch language">
      🌐 {locale === 'en' ? '中文' : 'English'}
    </button>
  );
}
