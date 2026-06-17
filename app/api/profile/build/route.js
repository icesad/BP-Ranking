import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { buildProfile } from '@/lib/profile';
import { checkRate, clientIp } from '@/lib/ratelimit';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

// 生成/更新自己的画像（需登录；联网搜社媒 + 一次 LLM 合成，故限流）。
export async function POST(req) {
  const u = getSessionUser();
  if (!u) return NextResponse.json({ error: '请先登录' }, { status: 401 });
  const rl = checkRate(`profile:${clientIp(req)}`, 6, 10 * 60 * 1000);
  if (!rl.ok) return NextResponse.json({ error: `太频繁，请 ${rl.retryAfter} 秒后再试` }, { status: 429 });
  try {
    const r = await buildProfile(getDb(), u.uid);
    if (!r.ok) return NextResponse.json({ error: r.error || '生成失败' }, { status: 502 });
    return NextResponse.json({ ok: true, basedOn: r.basedOn });
  } catch (e) {
    console.error('[profile.build]', e?.message || e);
    return NextResponse.json({ error: '生成失败，请重试' }, { status: 500 });
  }
}
