import Link from 'next/link';
import { cookies } from 'next/headers';
import { investorsList, investorPerformance, fmtMoney } from '@/lib/queries';
import { pName, pStyle } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

export default function InvestorsPage() {
  const locale = cookies().get('lang')?.value === 'en' ? 'en' : 'zh';
  const en = locale === 'en';
  const invs = investorsList();
  const llm = invs.filter((v) => v.type === 'llm');
  const famous = invs.filter((v) => v.type === 'famous');
  const perf = investorPerformance();
  const medal = (i) => (i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`);

  const Card = (v) => (
    <Link href={`/investors/${v.slug}`} key={v.id} className="card inv-card">
      <div className="inv-head">
        <div className="inv-avatar">{v.emoji}</div>
        <div>
          <div className="inv-name">{pName(locale, v.slug, v.name)} {v.real_llm ? <span className="badge badge-real">{en ? 'Live LLM' : '真实LLM'}</span> : null}</div>
          <div className="inv-style">{pStyle(locale, v.slug, v.style)}</div>
        </div>
      </div>
      <div className="inv-stats">
        <div>{en ? 'BP' : 'BP已投'}<b>{fmtMoney(v.invested, locale)}</b></div>
        <div>{en ? 'Demo' : 'Demo已投'}<b>{fmtMoney(v.demo_invested, locale)}</b></div>
        <div>{en ? 'Positions' : '持仓'}<b>{v.positions + v.demo_positions}{en ? '' : ' 个'}</b></div>
      </div>
    </Link>
  );

  return (
    <div>
      <h1 className="page-title">{en ? 'AI Investors' : '虚拟投资人'}</h1>
      <p className="page-sub">{en ? 'Each investor holds ~$14M virtual capital. Click to see position history and the reasoning behind every move.' : '每位投资人持有 1 亿虚拟资金，点击查看持仓变化轨迹与每一次调仓的判断理由'}</p>

      <h2 className="section-title">🏆 {en ? 'Sharpest Investors' : '最准投资人榜'} <span className="hint">{en ? 'Ranked by capital-weighted avg score of holdings' : '按持仓质量分排序（资金加权的所投项目均分）'}</span></h2>
      <div className="cmp-wrap">
        <table className="cmp-table">
          <thead><tr><th>#</th><th>{en ? 'Investor' : '投资人'}</th><th className="num">{en ? 'Quality' : '持仓质量分'}</th><th className="num">{en ? 'Hit rate' : '命中率'}</th><th className="num">{en ? 'Positions' : '持仓数'}</th><th className="num">{en ? 'BP invested' : 'BP已投'}</th></tr></thead>
          <tbody>
            {perf.map((v, i) => (
              <tr key={v.id}>
                <td className="cmp-rank">{medal(i)}</td>
                <td><Link href={`/investors/${v.slug}`} style={{ color: 'var(--text)', fontWeight: 600 }}>{v.emoji} {pName(locale, v.slug, v.name)}</Link></td>
                <td className="num" style={{ color: 'var(--accent)', fontWeight: 700 }}>{v.quality || '-'}</td>
                <td className="num">{v.hitRate}%</td>
                <td className="num">{v.positions}</td>
                <td className="num">{fmtMoney(v.deployed, locale)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="hint" style={{ marginTop: 8 }}>{en ? 'Hit rate = share of capital in top-30% BP-board projects. Higher quality = capital placed on higher-scoring projects.' : '命中率 = 投在「BP榜前 30%」项目里的资金占比。质量分越高，代表把钱押在评分越高的项目上。'}</p>
      </div>

      <h2 className="section-title">🧠 {en ? 'LLM Investors' : 'LLM 投资人'}</h2>
      <div className="grid">{llm.map(Card)}</div>

      <h2 className="section-title">🎭 {en ? 'Famous-investor style agents' : '知名投资人风格智能体'} <span className="hint">{en ? 'Public-style simulations only; not the actual people’s views' : '仅为公开风格的模拟，不代表本人观点'}</span></h2>
      <div className="grid">{famous.map(Card)}</div>
    </div>
  );
}
