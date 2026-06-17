import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { shareCardData, fmtMoney } from '@/lib/queries';
import { pName } from '@/lib/i18n';
import ShareCardActions from '@/components/ShareCardActions';

export const dynamic = 'force-dynamic';

export default function ShareCardPage({ params }) {
  const locale = cookies().get('lang')?.value === 'en' ? 'en' : 'zh';
  const en = locale === 'en';
  const d = shareCardData(Number(params.id));
  if (!d) notFound();
  const { bp, rank, boardSize, total, avg, investorCount, top, kind } = d;
  const boardName = kind === 'demo' ? (en ? 'Demo board' : 'Demo 榜') : (en ? 'BP board' : 'BP 榜');
  const isTop3 = rank && rank <= 3;
  const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '🏅';
  let topComment = top?.comment;
  if (en && top?.en) { try { topComment = JSON.parse(top.en)?.comment || topComment; } catch {} }
  let val = null; try { const v = JSON.parse(bp.val_summary || 'null'); if (v && v.n > 0) val = v; } catch {}

  const valTxt = (() => { try { const v = JSON.parse(bp.val_summary || 'null'); return v && v.n > 0 ? v : null; } catch { return null; } })();
  const shareText = en
    ? `My project "${bp.title}" ranks #${rank}/${boardSize} on Demo-Ranking's ${boardName}${valTxt ? `, valued by AI investors at ${fmtMoney(valTxt.low, 'en')}–${fmtMoney(valTxt.high, 'en')}` : ''}, with ${investorCount} AI investors investing ${fmtMoney(total, 'en')} (virtual). Come compete 👉`
    : `我的项目《${bp.title}》在 Demo-Ranking ${boardName}排名第 ${rank} / ${boardSize}${valTxt ? `，AI 投资人估值 ${fmtMoney(valTxt.low)}–${fmtMoney(valTxt.high)}` : ''}，获 ${investorCount} 位 AI 投资人累计注资 ${fmtMoney(total)}（虚拟）。来一战高下 👉`;

  return (
    <div style={{ maxWidth: 680, margin: '0 auto' }}>
      <h1 className="page-title">🎉 {en ? 'Share Card' : '战绩卡'}</h1>
      <p className="page-sub">{en ? 'Download the image to share, or copy the caption. ' : '下载图片分享到社交平台，或复制文案。'}<Link href={`/bp/${bp.id}`} style={{ color: 'var(--accent)' }}>{en ? '← Back to project' : '← 返回项目'}</Link></p>

      <div id="share-card" className="share-card">
        <div className="sc-top">
          <span className="sc-brand"><b>Demo</b>-Ranking</span>
          <span className="sc-board">{boardName}</span>
        </div>
        <div className="sc-rank">
          <span className="sc-medal">{medal}</span>
          <span className="sc-rankno">{en ? `#${rank ?? '-'}` : `第 ${rank ?? '-'} 名`}</span>
          {isTop3 && <span className="sc-badge">{en ? 'Top 3' : '榜单前三'}</span>}
        </div>
        <div className="sc-title">{bp.title}</div>
        <div className="sc-founder">{bp.founder} · {bp.sector || ''}</div>
        {val && (
          <div className="sc-val">{en ? 'Investor valuation' : '投资人估值'} <b>{fmtMoney(val.low, locale)} – {fmtMoney(val.high, locale)}</b></div>
        )}
        <div className="sc-stats">
          <div><b>{fmtMoney(total, locale)}</b><span>{en ? 'Total invested' : '累计虚拟注资'}</span></div>
          <div><b>{investorCount}</b><span>{en ? 'investors' : '位投资人注资'}</span></div>
          <div><b>{avg ?? '-'}</b><span>{en ? 'avg score' : '平均评分'}</span></div>
        </div>
        {top && topComment && (
          <div className="sc-quote">
            <span className="sc-quote-mark">“</span>{topComment}
            <div className="sc-quote-by">— {top.emoji} {pName(locale, top.slug, top.name)}（{en ? 'invested ' : '注资 '}{fmtMoney(top.amount, locale)}）</div>
          </div>
        )}
        <div className="sc-foot">{en ? 'In the AI era, what’s your demo really worth? 12 AI investors price it on Demo-Ranking.' : 'AI 时代，你的 Demo 到底值多少？上 Demo-Ranking，12 位 AI 投资人联网估值'}</div>
      </div>

      <ShareCardActions shareText={shareText} en={en} />
      <p className="hint" style={{ marginTop: 10 }}>{en ? 'Tip: if the download button doesn’t work, just screenshot the card above.' : '提示：若下载按钮无效，直接对上面的卡片截图保存即可。'}</p>
    </div>
  );
}
