import Link from 'next/link';
import { cookies } from 'next/headers';
import { NEED_TYPES, needsList, resourcesList, resourceCounts } from '@/lib/queries';
import ResourceForms from '@/components/ResourceForms';

export const dynamic = 'force-dynamic';

export default function ResourcesPage({ searchParams }) {
  const en = cookies().get('lang')?.value === 'en';
  const city = cookies().get('city')?.value || '上海';
  const tab = searchParams?.tab === 'resources' ? 'resources' : 'needs';
  const type = (searchParams?.type || '').toString();
  const items = tab === 'resources' ? resourcesList({ city, type }) : needsList({ city, type });
  const rcounts = resourceCounts(city);
  const Tn = (k) => NEED_TYPES[k] || k;
  const qs = (o) => '?' + new URLSearchParams({ tab, ...(type ? { type } : {}), ...o }).toString();

  return (
    <div>
      <h1 className="page-title">🤝 {en ? 'Resource matching' : '资源对接'}</h1>
      <p className="page-sub">{en
        ? 'Only good at building? Post what you’re stuck on (ICP filing, launch, cold-start, funding…) and find people who can help.'
        : '只擅长做产品、卡在备案/上线/冷启动/发行/找投资？在这里发需求，或自荐为资源方，互相对接。'}</p>

      <div className="filter-row" style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <Link href={`?tab=needs${type ? `&type=${type}` : ''}`} className={`badge ${tab === 'needs' ? 'badge-llm' : 'badge-public'}`}>{en ? 'Needs board' : '需求广场'}</Link>
        <Link href={`?tab=resources${type ? `&type=${type}` : ''}`} className={`badge ${tab === 'resources' ? 'badge-llm' : 'badge-public'}`}>{en ? 'Resources' : '资源库'}</Link>
      </div>

      <div className="filter-row" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        <Link href={`?tab=${tab}`} className={`badge ${!type ? 'badge-llm' : 'badge-public'}`}>{en ? 'All' : '全部'}</Link>
        {Object.keys(NEED_TYPES).map((k) => (
          <Link key={k} href={`?tab=${tab}&type=${k}`} className={`badge ${type === k ? 'badge-llm' : 'badge-public'}`}>{NEED_TYPES[k]}{tab === 'resources' && rcounts[k] ? ` (${rcounts[k]})` : ''}</Link>
        ))}
      </div>

      <ResourceForms tab={tab} types={NEED_TYPES} en={en} />

      {items.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', color: 'var(--text2)' }}>
          {tab === 'resources' ? (en ? 'No resources listed yet — be the first to offer one.' : '还没有资源方，欢迎自荐第一个。') : (en ? 'No open needs yet — post the first one.' : '还没有需求，来发第一条。')}
        </div>
      ) : tab === 'needs' ? items.map((n) => (
        <div key={n.id} className="rank-row">
          <div className="rank-main">
            <div className="rank-title"><span className="badge badge-llm">{Tn(n.type)}</span> {n.detail}</div>
            <div className="rank-sub">
              <Link href={`/u/${n.handle}`}>@{n.handle}</Link>
              {n.bp_id && n.bp_title ? <> · {en ? 'for' : '关于'} <Link href={`/bp/${n.bp_id}`}>{n.bp_title}</Link></> : null}
              {n.region ? ` · 📍${n.region}` : ''}
            </div>
          </div>
          <div className="rank-metrics">
            <Link href={`?tab=resources&type=${n.type}`} className="hint">{en ? `${n.match_resources} resources` : `匹配资源 ${n.match_resources}`}</Link>
          </div>
        </div>
      )) : items.map((r) => (
        <div key={r.id} className="rank-row">
          <div className="rank-main">
            <div className="rank-title"><span className="badge badge-public">{Tn(r.type)}</span> {r.title} {r.verified ? <span className="badge badge-real">{en ? 'verified' : '已核实'}</span> : null}</div>
            <div className="rank-sub">{r.detail}{r.region ? ` · 📍${r.region}` : ''}</div>
          </div>
          <div className="rank-metrics">
            {r.handle ? <Link href={`/u/${r.handle}`} className="hint">@{r.handle}</Link> : null}
            {r.contact ? <div className="hint">{r.contact}</div> : null}
          </div>
        </div>
      ))}

      <p className="hint" style={{ marginTop: 12 }}>{en ? 'Connect via the other party’s profile (their social links) or listed contact. Resources are self-listed & unverified unless marked.' : '通过对方主页(社媒链接)或所留联系方式对接。资源多为自荐、未核实(标“已核实”除外)。'}</p>
    </div>
  );
}
