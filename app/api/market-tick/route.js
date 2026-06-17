import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { marketTick } from '@/lib/portfolio';
import { checkRate, clientIp } from '@/lib/ratelimit';

export const dynamic = 'force-dynamic';

// 手动触发一次市场情绪波动（也可挂到系统定时任务上）。
export async function GET(req) {
  const rl = checkRate(`market:${clientIp(req)}`, 20, 60 * 1000);
  if (!rl.ok) return NextResponse.json({ error: `太频繁，请 ${rl.retryAfter} 秒后再试` }, { status: 429 });
  const moves = marketTick(getDb());
  return NextResponse.json({ ok: true, moves });
}
