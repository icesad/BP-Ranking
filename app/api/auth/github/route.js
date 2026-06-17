import { NextResponse } from 'next/server';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

// 跳转到 GitHub 授权页。带随机 state 防 CSRF（存短时 cookie，回调校验）。
export async function GET(req) {
  const cid = process.env.GITHUB_OAUTH_CLIENT_ID;
  const origin = req.nextUrl.origin;
  if (!cid) return NextResponse.redirect(`${origin}/?login=noconfig`);
  const state = crypto.randomBytes(16).toString('hex');
  const redirect = `${origin}/api/auth/github/callback`;
  const url = `https://github.com/login/oauth/authorize?client_id=${encodeURIComponent(cid)}&redirect_uri=${encodeURIComponent(redirect)}&scope=read:user&state=${state}`;
  const res = NextResponse.redirect(url);
  res.cookies.set('bpr_oauth_state', state, { httpOnly: true, maxAge: 600, path: '/', sameSite: 'lax' });
  return res;
}
