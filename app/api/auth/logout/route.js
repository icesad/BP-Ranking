import { NextResponse } from 'next/server';
import { COOKIE } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// 退出登录：清会话 cookie，回首页。
export async function GET(req) {
  const res = NextResponse.redirect(`${req.nextUrl.origin}/`);
  res.cookies.set(COOKIE, '', { maxAge: 0, path: '/' });
  return res;
}
