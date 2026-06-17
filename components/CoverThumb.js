import { COVER_PALETTES, coverFallback } from '@/lib/engine';

// 封面：优先用首屏截图(bp.shot)，否则用 LLM 设计的渐变+emoji+关键词。
export default function CoverThumb({ cover, bp, variant = 'thumb' }) {
  const banner = variant === 'banner';
  if (bp && bp.shot) {
    return (
      <div className={`cover ${banner ? 'cover-banner' : 'cover-thumb'} cover-shot`}
        style={{ backgroundImage: `url(/api/shot/${bp.id})` }} />
    );
  }
  let c = cover;
  if (typeof c === 'string') { try { c = JSON.parse(c); } catch { c = null; } }
  if (!c || !c.emoji) c = bp ? coverFallback(bp) : { emoji: '🚀', kw: '', palette: 'blue' };
  const [a, b] = COVER_PALETTES[c.palette] || COVER_PALETTES.blue;
  return (
    <div className={`cover ${banner ? 'cover-banner' : 'cover-thumb'}`}
      style={{ background: `linear-gradient(135deg, ${a}, ${b})` }}>
      <span className="cover-emoji">{c.emoji}</span>
      {c.kw ? <span className="cover-kw">{c.kw}</span> : null}
    </div>
  );
}
