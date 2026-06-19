import Link from 'next/link';
import { cookies } from 'next/headers';
import { eventsList, eventAttendees, myEventIds } from '@/lib/queries';
import { getSessionUser } from '@/lib/auth';
import { avatarDataUri } from '@/lib/avatar';
import EventsBoard from '@/components/EventsBoard';

export const dynamic = 'force-dynamic';

export default function EventsPage() {
  const en = cookies().get('lang')?.value === 'en';
  const city = cookies().get('city')?.value || '上海';
  // 取该城市全部活动：列表只显示未过期(EventsBoard 内过滤)，日历显示含过期(灰显)
  const events = eventsList({ city, all: true, limit: 500 });
  const today = new Date().toISOString().slice(0, 10);
  const u = getSessionUser();
  // 出席（搭子）头像：无真实头像时用确定性 identicon，保证每个搭子头像独特
  const attRaw = eventAttendees(events.map((e) => e.id));
  const attendees = {};
  for (const [eid, list] of Object.entries(attRaw)) {
    attendees[eid] = list.map((p) => ({ handle: p.handle, name: p.name, avatar: p.avatar || avatarDataUri(p.handle) }));
  }
  const myIds = u ? myEventIds(u.uid) : [];

  return (
    <div>
      <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: 14, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div className="hint" style={{ letterSpacing: '.28em' }}>EVENT CALENDAR</div>
          <h1 className="page-title" style={{ margin: '6px 0 0' }}>📅 {en ? 'Vibe Coder Events' : '活动日历'}</h1>
          <p className="page-sub" style={{ marginTop: 8 }}>{en
            ? 'Meetups, hackathons, talks. Some links come from Xiaohongshu — open the link and scan the QR to view.'
            : '聚会 / 黑客松 / 分享会。部分链接来源于小红书，可能需点开后扫码查看。'}
            {' '}<Link href="/news" style={{ color: 'var(--accent)' }}>📰 {en ? 'News' : '资讯'}</Link>
            {' '}<Link href="/opc" style={{ color: 'var(--accent)' }}>🧭 OPC</Link></p>
        </div>
      </div>

      <EventsBoard events={events} today={today} en={en} attendees={attendees} myIds={myIds} loggedIn={!!u}
        me={u ? { handle: u.handle, name: u.name, avatar: u.avatar || avatarDataUri(u.handle) } : null} />

      <p className="hint" style={{ marginTop: 14 }}>{en
        ? 'Avatars show who’s going — find your buddies and meet up offline. Tap “I’m going” to appear here.'
        : '活动上的头像就是报名的搭子——看看你的搭子去了哪些活动，方便线下面基。点"我去"即可出现在这里。'}</p>
    </div>
  );
}
