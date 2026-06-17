import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';
const PLATFORMS = ['xiaohongshu', 'x', 'bilibili', 'github', 'site', 'other'];

// GET → 当前用户的社媒链接
export async function GET() {
  const u = getSessionUser();
  if (!u) return NextResponse.json({ socials: [] });
  const socials = getDb().prepare('SELECT platform, url FROM user_socials WHERE user_id = ?').all(u.uid);
  return NextResponse.json({ socials });
}

// POST {socials:[{platform,url}]} → 整体替换当前用户的社媒链接（未核实）
export async function POST(req) {
  const u = getSessionUser();
  if (!u) return NextResponse.json({ error: '请先登录' }, { status: 401 });
  let list = [];
  try { list = (await req.json()).socials || []; } catch {}
  const clean = [];
  const seen = new Set();
  for (const s of (Array.isArray(list) ? list : []).slice(0, 8)) {
    const platform = PLATFORMS.includes(s?.platform) ? s.platform : 'other';
    const url = String(s?.url || '').trim().slice(0, 300);
    if (!/^https?:\/\/.+/.test(url) || seen.has(platform)) continue;
    seen.add(platform);
    clean.push({ platform, url });
  }
  const db = getDb();
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM user_socials WHERE user_id = ?').run(u.uid);
    const ins = db.prepare('INSERT INTO user_socials (user_id, platform, url) VALUES (?,?,?)');
    for (const s of clean) ins.run(u.uid, s.platform, s.url);
  });
  tx();
  return NextResponse.json({ ok: true, socials: clean });
}
