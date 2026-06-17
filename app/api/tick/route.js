import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { rebalanceAll } from '@/lib/portfolio';
import { checkRate, clientIp } from '@/lib/ratelimit';

export const dynamic = 'force-dynamic';

// 全局调仓：模拟投资人“根据最新信息重新审视组合”。可手动访问或由定时任务触发。
export async function GET(req) {
  const rl = checkRate(`tick:${clientIp(req)}`, 20, 60 * 1000);
  if (!rl.ok) return NextResponse.json({ error: `调仓太频繁，请 ${rl.retryAfter} 秒后再试` }, { status: 429 });
  const db = getDb();
  const moves = rebalanceAll(db);
  return NextResponse.json({ ok: true, moves });
}
