'use client';
import { useEffect, useRef, useState, useMemo } from 'react';

// OPC 社区地图：有高德 key → 真地图(按城市/区打点)；无 key → 按区概览。深色主题。
// 城市中心（地图默认中心 + 兜底）
const CITY_CENTER = { 上海: [121.47, 31.23], 杭州: [120.15, 30.27] };
// 各区中心近似坐标（区名跨城市不重复，合表即可；编码失败时按区兜底）
const DISTRICT_CENTER = {
  // 上海
  黄浦区: [121.49, 31.23], 徐汇区: [121.43, 31.18], 长宁区: [121.42, 31.22], 静安区: [121.45, 31.23],
  普陀区: [121.40, 31.25], 虹口区: [121.50, 31.27], 杨浦区: [121.52, 31.27], 浦东新区: [121.55, 31.22],
  闵行区: [121.38, 31.11], 宝山区: [121.49, 31.40], 嘉定区: [121.27, 31.38], 金山区: [121.34, 30.74],
  松江区: [121.22, 31.03], 青浦区: [121.12, 31.15], 奉贤区: [121.47, 30.92], 崇明区: [121.40, 31.62],
  临港新片区: [121.92, 30.90],
  // 杭州
  上城区: [120.21, 30.24], 拱墅区: [120.13, 30.31], 西湖区: [120.13, 30.24], 滨江区: [120.21, 30.20],
  萧山区: [120.26, 30.18], 余杭区: [119.98, 30.28], 临平区: [120.30, 30.42], 钱塘区: [120.55, 30.40],
  富阳区: [119.96, 30.05], 临安区: [119.72, 30.23],
};
// 每个城市包含哪些区（用于直接标注区名，不依赖任何服务）
const CITY_DISTRICTS = {
  上海: ['黄浦区', '徐汇区', '长宁区', '静安区', '普陀区', '虹口区', '杨浦区', '浦东新区', '闵行区', '宝山区', '嘉定区', '金山区', '松江区', '青浦区', '奉贤区', '崇明区', '临港新片区'],
  杭州: ['上城区', '拱墅区', '西湖区', '滨江区', '萧山区', '余杭区', '临平区', '钱塘区', '富阳区', '临安区'],
};

function loadAMap(key, secret) {
  return new Promise((resolve, reject) => {
    if (window.AMap) return resolve(window.AMap);
    if (secret) window._AMapSecurityConfig = { securityJsCode: secret }; // 高德 v2 需在加载前设置
    const s = document.createElement('script');
    s.src = `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(key)}`;
    s.async = true;
    s.onload = () => (window.AMap ? resolve(window.AMap) : reject(new Error('AMap not ready')));
    s.onerror = () => reject(new Error('script load failed'));
    document.head.appendChild(s);
  });
}

export default function CommunityMap({ communities = [], amapKey = '', amapSecret = '', city = '上海', en = false }) {
  const elRef = useRef(null);
  const [failed, setFailed] = useState(false);

  // 按区分组
  const byRegion = useMemo(() => {
    const g = {};
    for (const c of communities) { const r = c.region || '其他'; (g[r] = g[r] || []).push(c); }
    return g;
  }, [communities]);
  const regionsSorted = useMemo(() => Object.entries(byRegion).sort((a, b) => b[1].length - a[1].length), [byRegion]);
  useEffect(() => {
    if (!amapKey || !elRef.current) return;
    let map;
    loadAMap(amapKey, amapSecret).then((AMap) => {
      const cityCenter = CITY_CENTER[city] || [121.47, 31.23];
      // 官方暗色样式：矢量叠加(区界线/文字)颜色正常；只留底色，不要道路/POI → 干净不失焦
      map = new AMap.Map(elRef.current, { zoom: 10, center: cityCenter, viewMode: '2D', mapStyle: 'amap://styles/dark' });
      try { map.setFeatures(['bg']); } catch {}

      // 区名：直接用内置各区中心坐标标注（不依赖任何服务，必出）
      (CITY_DISTRICTS[city] || []).forEach((dn) => {
        const c = DISTRICT_CENTER[dn];
        if (!c) return;
        try { new AMap.Text({ text: dn, position: c, map, zIndex: 5, anchor: 'center', style: { background: 'transparent', border: 'none', color: 'rgba(150,170,215,.65)', 'font-size': '13px', 'font-weight': '700', 'letter-spacing': '1px', 'text-shadow': '0 1px 4px rgba(0,0,0,.9)' } }); } catch {}
      });

      // 区界线：DistrictSearch 取边界（拿到就画，超时则只剩区名，不影响主体）
      AMap.plugin('AMap.DistrictSearch', () => {
        try {
          const ds = new AMap.DistrictSearch({ level: 'city', subdistrict: 1, extensions: 'all' });
          ds.search(city, (status, result) => {
            if (status !== 'complete' || !result.districtList || !result.districtList[0]) return;
            const subs = result.districtList[0].districtList || [];
            subs.forEach((d) => {
              (d.boundaries || []).forEach((ring) => {
                try { new AMap.Polyline({ path: ring, strokeColor: '#6f8fd6', strokeWeight: 1.4, strokeOpacity: 0.6, strokeStyle: 'dashed', map, zIndex: 4 }); } catch {}
              });
            });
          });
        } catch {}
      });
      const infoHtml = (cm) => {
        const href = (cm.link || '').split(' ')[0];
        const applyBtn = `<a href="/opc/c/${cm.id}" style="display:block;margin-top:8px;text-align:center;background:#2563eb;color:#fff;border-radius:6px;padding:6px 0;font-size:13px;font-weight:600;text-decoration:none">${en ? 'Apply to join →' : '报名入驻 →'}</a>`;
        return `<div style="max-width:240px;color:#1f2430;font-size:13px;line-height:1.6;padding:2px 4px"><b style="color:#111">${href ? `<a href="${href}" target="_blank" rel="noopener" style="color:#1b6bbf;text-decoration:none">${cm.name}</a>` : cm.name}</b>${cm.type ? ` · ${cm.type}` : ''}<br><span style="color:#444">📍${cm.region || ''}</span>${cm.description ? `<br>${cm.description.slice(0, 80)}` : ''}${applyBtn}</div>`;
      };

      // 防堆叠：挨太近的点按螺旋错开，避免坐标重合
      const placed = [];
      const near = (a, b) => Math.abs(a[0] - b[0]) < 0.0065 && Math.abs(a[1] - b[1]) < 0.0065;
      const spread = (pos) => {
        let lng = pos[0], lat = pos[1], t = 0;
        while (placed.some((p) => near(p, [lng, lat])) && t < 40) {
          const ang = (t % 8) * Math.PI / 4, r = 0.008 * (1 + Math.floor(t / 8));
          lng = pos[0] + Math.cos(ang) * r; lat = pos[1] + Math.sin(ang) * r; t++;
        }
        placed.push([lng, lat]); return [lng, lat];
      };
      const markers = [];
      const info = new AMap.InfoWindow({ offset: new AMap.Pixel(0, -10) });
      const addMarker = (cm, rawPos, idx) => {
        const pos = spread(rawPos);
        const nm = cm.name.length > 12 ? cm.name.slice(0, 12) + '…' : cm.name;
        // 名字常显：标签方向按序轮换(右/左/上/下)，进一步降低相邻标签碰撞
        const dir = ['right', 'top', 'left', 'bottom'][idx % 4];
        const off = { right: [9, 0], left: [-9, 0], top: [0, -9], bottom: [0, 9] }[dir];
        const m = new AMap.Marker({
          position: pos, anchor: 'center', zIndex: 10,
          content: '<div style="width:11px;height:11px;border-radius:50%;background:#5b8cff;border:2px solid #fff;box-shadow:0 1px 6px rgba(0,0,0,.6);cursor:pointer"></div>',
          label: { direction: dir, offset: new AMap.Pixel(off[0], off[1]), content: `<div style="background:rgba(13,18,32,.86);color:#dfe7ff;border:1px solid rgba(91,140,255,.55);border-radius:5px;padding:1px 6px;font-size:11px;white-space:nowrap;line-height:1.5;pointer-events:none">${nm}</div>` },
        });
        m.on('mouseover', () => { try { m.setTop(true); } catch {} });
        m.on('click', () => { info.setContent(infoHtml(cm)); info.open(map, m.getPosition()); });
        map.add(m); markers.push(m);
      };
      // 真实位置分布：按名称地理编码；但校验结果是否落在所属区附近，离谱的(如漕泾被定到北边)判错→回退到该区中心。
      const cacheGet = (k) => { try { return JSON.parse(localStorage.getItem('amapgeo:' + k) || 'null'); } catch { return null; } };
      const cacheSet = (k, v) => { try { localStorage.setItem('amapgeo:' + k, JSON.stringify(v)); } catch {} };
      // 已知错点的精确坐标兜底（名称包含 key 即用），可继续补充
      const POS_OVERRIDE = { 漕泾: [121.46, 30.80] };
      // 编码结果是否在所属区合理范围内（阈值放宽以兼容大区如浦东；只拦跨区级别的离谱错误）
      const inDistrict = (pos, region) => { const c = DISTRICT_CENTER[region]; if (!c) return true; return Math.abs(pos[0] - c[0]) <= 0.22 && Math.abs(pos[1] - c[1]) <= 0.18; };
      const fallback = (region) => DISTRICT_CENTER[region] || cityCenter;

      AMap.plugin('AMap.Geocoder', () => {
        const geocoder = new AMap.Geocoder({ city });
        let pending = communities.length || 1;
        const tick = () => { if (--pending <= 0 && markers.length) { try { map.setFitView(markers, false, [50, 50, 50, 50]); } catch {} } };
        if (!communities.length) tick();
        communities.forEach((cm, i) => {
          const ovKey = Object.keys(POS_OVERRIDE).find((k) => cm.name.includes(k));
          if (ovKey) { addMarker(cm, POS_OVERRIDE[ovKey], i); tick(); return; }
          const ck = 'g2:' + city + ':' + cm.name;
          const cached = cacheGet(ck);
          if (cached && inDistrict(cached, cm.region)) { addMarker(cm, cached, i); tick(); return; }
          geocoder.getLocation(`${cm.region || ''}${cm.name}`, (status, result) => {
            let pos = null;
            if (status === 'complete' && result.geocodes && result.geocodes.length) {
              const ll = result.geocodes[0].location; const p = [ll.lng, ll.lat];
              if (inDistrict(p, cm.region)) { pos = p; cacheSet(ck, p); }
            }
            if (!pos) pos = fallback(cm.region);
            addMarker(cm, pos, i); tick();
          });
        });
      });
    }).catch(() => setFailed(true));
    return () => { try { map && map.destroy(); } catch {} };
  }, [amapKey, amapSecret, communities, city]);

  // 真地图
  if (amapKey && !failed) {
    return (
      <div className="card" style={{ padding: 8 }}>
        <div ref={elRef} style={{ width: '100%', height: 360, borderRadius: 8, overflow: 'hidden', background: '#0e1422' }} />
        <p className="hint" style={{ marginTop: 6 }}>{en ? 'Real geocoded positions; cross-district errors fall back to the district. Click for details and “Apply to join”.' : '按真实位置分布；明显跨区的错误点会回退到所属区。点击看详情并可"报名入驻"。'}</p>
      </div>
    );
  }

  // 无 key / 加载失败 → 按区概览
  const max = Math.max(1, ...regionsSorted.map(([, l]) => l.length));
  return (
    <div className="card">
      <div className="hint" style={{ marginBottom: 8 }}>
        {failed ? (en ? 'Map failed to load — showing district overview.' : '地图加载失败，先看按区概览。')
          : (en ? 'Add a free AMap web key (AMAP_KEY in .env.local) to show a real map. Overview below:' : '配置高德 Web key（.env.local 的 AMAP_KEY）即可显示真地图。下面是按区概览：')}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 8 }}>
        {regionsSorted.map(([region, list]) => (
          <a key={region} href={`#region-${region}`} style={{ display: 'block', padding: 10, border: '1px solid var(--border)', borderRadius: 10, textDecoration: 'none' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <b>📍 {region}</b><span style={{ color: 'var(--accent)', fontWeight: 700 }}>{list.length}</span>
            </div>
            <div style={{ height: 6, background: 'var(--bg2,#0e1422)', borderRadius: 4, marginTop: 6, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${(list.length / max) * 100}%`, background: 'var(--accent)' }} />
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
