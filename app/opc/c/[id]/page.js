import Link from 'next/link';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { communityById, communityApplicantCount, myCommunityApplications } from '@/lib/queries';
import { getSessionUser } from '@/lib/auth';
import CommunityApply from '@/components/CommunityApply';

export const dynamic = 'force-dynamic';

export default function CommunityPage({ params }) {
  const en = cookies().get('lang')?.value === 'en';
  const id = Number(params.id);
  const cm = communityById(id);
  if (!cm) notFound();
  const u = getSessionUser();
  const applicants = communityApplicantCount(id);
  const applied = u ? myCommunityApplications(u.uid).includes(id) : false;
  const href = (cm.link || '').split(' ')[0];
  // 诚实标注链接类型：现有 link 多为新闻/资料，不是官方主页 → 按域名判断措辞，不假装有官网
  const SRC_HOSTS = ['csdn.net', '21jingji.com', '36kr.com', 'hangzhou.com.cn', 'hznews', 'hzsc.com.cn', 'zhihu.com', 'zjintel.com', 'qianzhan.com', 'sohu.com', 'weixin', 'mp.weixin'];
  let hrefHost = '';
  try { hrefHost = href ? new URL(href).hostname : ''; } catch {}
  const isSource = href && SRC_HOSTS.some((h) => hrefHost.includes(h));
  const linkLabel = en ? (isSource ? 'Related coverage / info ↗' : 'Official / details ↗') : (isSource ? '相关报道 / 资料 ↗' : '官方主页 / 详情 ↗');
  // 地图定位：用名称+区+城市搜索，帮用户找到实地
  const mapUrl = `https://www.amap.com/search?query=${encodeURIComponent(`${cm.region || ''}${cm.name} ${cm.city || ''}`.trim())}`;

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <p className="hint" style={{ marginBottom: 10 }}>
        <Link href="/opc" style={{ color: 'var(--accent)' }}>← {en ? 'OPC Hub' : 'OPC 资源中心'}</Link> · 📍{cm.city || ''}
      </p>

      <div className="card" style={{ marginBottom: 16 }}>
        <h1 className="page-title" style={{ margin: '0 0 6px' }}>{cm.name}</h1>
        <div className="hint" style={{ marginBottom: 10 }}>📍{cm.region || ''}{cm.type ? ` · ${cm.type}` : ''}{applicants ? ` · ${applicants} ${en ? 'applied' : '人已报名'}` : ''}</div>
        {cm.description ? <p style={{ lineHeight: 1.7 }}>{cm.description}</p> : null}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
          {href ? <a className="btn btn-ghost" href={href} target="_blank" rel="noopener noreferrer">{linkLabel}</a> : null}
          <a className="btn btn-ghost" href={mapUrl} target="_blank" rel="noopener noreferrer">📍 {en ? 'View on map' : '在高德地图查看位置'}</a>
        </div>
        {href && isSource ? <p className="hint" style={{ marginTop: 8 }}>{en ? 'Note: link is related coverage, not an official site.' : '说明：上方链接为相关报道/资料，非该社区官方主页。'}</p> : null}
      </div>

      <CommunityApply communityId={id} applied={applied} loggedIn={!!u} en={en} />

      <p className="hint" style={{ marginTop: 14 }}>{en
        ? 'Your application is shared with the community/operator for offline follow-up; it’s not a binding contract.'
        : '报名仅作入驻意向登记，供社区/运营方线下对接，非正式合同。'}</p>
    </div>
  );
}
