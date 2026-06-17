import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { sign, COOKIE, MAXAGE } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GitHub 回调：校验 state → 换 access_token → 拉用户 → upsert users → 设签名会话 cookie → 跳个人主页。
export async function GET(req) {
  const url = req.nextUrl;
  const origin = url.origin;
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const saved = req.cookies.get('bpr_oauth_state')?.value;
  if (!code || !state || !saved || state !== saved) return NextResponse.redirect(`${origin}/?login=err`);

  const cid = process.env.GITHUB_OAUTH_CLIENT_ID, secret = process.env.GITHUB_OAUTH_CLIENT_SECRET;
  if (!cid || !secret) return NextResponse.redirect(`${origin}/?login=noconfig`);

  try {
    const tokRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ client_id: cid, client_secret: secret, code, redirect_uri: `${origin}/api/auth/github/callback` }),
      signal: AbortSignal.timeout(15000),
    });
    const tj = await tokRes.json();
    const access = tj.access_token;
    if (!access) return NextResponse.redirect(`${origin}/?login=err`);

    const ures = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${access}`, 'User-Agent': 'demo-ranking', Accept: 'application/vnd.github+json' },
      signal: AbortSignal.timeout(15000),
    });
    const gu = await ures.json();
    if (!gu || !gu.id) return NextResponse.redirect(`${origin}/?login=err`);

    const db = getDb();
    const provider = 'github', uid = String(gu.id);
    const existing = db.prepare('SELECT * FROM users WHERE provider = ? AND provider_uid = ?').get(provider, uid);
    let userId, handle;
    if (existing) {
      userId = existing.id; handle = existing.handle;
      db.prepare('UPDATE users SET name = ?, avatar = ?, github_login = ? WHERE id = ?')
        .run(gu.name || existing.name || '', gu.avatar_url || existing.avatar || '', gu.login || '', userId);
    } else {
      const base = String(gu.login || ('user' + uid)).toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 30) || ('user' + uid);
      let h = base, i = 1;
      while (db.prepare('SELECT 1 FROM users WHERE handle = ?').get(h)) h = `${base}-${i++}`;
      handle = h;
      const info = db.prepare('INSERT INTO users (provider, provider_uid, handle, name, avatar, bio, github_login) VALUES (?,?,?,?,?,?,?)')
        .run(provider, uid, handle, gu.name || '', gu.avatar_url || '', gu.bio || '', gu.login || '');
      userId = info.lastInsertRowid;
    }

    const token = sign({ uid: userId, handle, name: gu.name || handle, avatar: gu.avatar_url || '', exp: Date.now() + MAXAGE * 1000 });
    const res = NextResponse.redirect(`${origin}/u/${handle}`);
    res.cookies.set(COOKIE, token, { httpOnly: true, maxAge: MAXAGE, path: '/', sameSite: 'lax' });
    res.cookies.set('bpr_oauth_state', '', { maxAge: 0, path: '/' });
    return res;
  } catch (e) {
    console.error('[oauth] callback failed', e?.message || e);
    return NextResponse.redirect(`${origin}/?login=err`);
  }
}
