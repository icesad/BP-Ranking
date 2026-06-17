import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { userPoints } from '@/lib/queries';

export const dynamic = 'force-dynamic';

// 当前登录用户（供客户端组件判断登录态 + 积分余额）。未登录返回 { user: null }。
export async function GET() {
  const u = getSessionUser();
  if (!u) return NextResponse.json({ user: null });
  let points = 0; try { points = userPoints(u.uid); } catch {}
  return NextResponse.json({ user: { uid: u.uid, handle: u.handle, name: u.name, avatar: u.avatar, points } });
}
