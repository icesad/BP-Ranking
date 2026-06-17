import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { reEvaluateBp, rebalanceAll } from '@/lib/portfolio';
import { checkRate, clientIp } from '@/lib/ratelimit';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// 一次性：用新评分标准重评所有存量项目（12位投资人并行），再做一次全局调仓。
// 注意：每个项目 ~12 次 LLM 调用，项目多时较慢；无 key 时瞬间降级为加固后的兜底分。
export async function GET(req) {
  try {
    const rl = checkRate(`rescore:${clientIp(req)}`, 3, 10 * 60 * 1000);
    if (!rl.ok) return NextResponse.json({ error: `重评太频繁，请 ${rl.retryAfter} 秒后再试` }, { status: 429 });
    const db = getDb();
    const bps = db.prepare('SELECT * FROM bps').all();
    for (const bp of bps) {
      await reEvaluateBp(db, bp);
    }
    const moves = rebalanceAll(db);
    return NextResponse.json({ ok: true, rescored: bps.length, moves });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: '重评失败，请重试' }, { status: 500 });
  }
}
