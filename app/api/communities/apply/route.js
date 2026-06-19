import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { applyCommunity } from '@/lib/queries';

export const dynamic = 'force-dynamic';

// POST {communityId, note, contact} → 报名入驻该社区（需登录）。返回 {ok, count}
export async function POST(req) {
  const u = getSessionUser();
  if (!u) return NextResponse.json({ error: '请先登录' }, { status: 401 });
  let body = {};
  try { body = await req.json(); } catch {}
  const communityId = Number(body.communityId);
  if (!communityId) return NextResponse.json({ error: 'bad communityId' }, { status: 400 });
  const note = String(body.note || '').slice(0, 500);
  const contact = String(body.contact || '').slice(0, 200);
  const r = applyCommunity(u.uid, communityId, note, contact);
  return NextResponse.json(r);
}
