import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSessionUser } from '@/lib/auth';
import { toggleAttend } from '@/lib/queries';

export const dynamic = 'force-dynamic';

// POST {eventId} → 切换"我去/取消报名"（需登录）。返回 {attending, count}
export async function POST(req) {
  const u = getSessionUser();
  if (!u) return NextResponse.json({ error: '请先登录' }, { status: 401 });
  let eventId;
  try { eventId = Number((await req.json()).eventId); } catch { eventId = 0; }
  if (!eventId) return NextResponse.json({ error: 'bad eventId' }, { status: 400 });
  const city = cookies().get('city')?.value || '';
  const r = toggleAttend(u.uid, eventId, city);
  return NextResponse.json(r);
}
