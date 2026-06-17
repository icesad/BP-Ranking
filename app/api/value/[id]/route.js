import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { valuateBp } from '@/lib/valuation';
import { rebalanceAll } from '@/lib/portfolio';
import { checkRate, clientIp } from '@/lib/ratelimit';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// 触发一次估值：联网搜索 + 12 位投资人(deepseek-reasoner)估值 + 综合估值。较慢、较贵，故限流。
export async function POST(req, { params }) {
  try {
    const id = Number(params.id);
    const rl = checkRate(`value:${clientIp(req)}`, 5, 10 * 60 * 1000);
    if (!rl.ok) return NextResponse.json({ error: `估值太频繁，请 ${rl.retryAfter} 秒后再试` }, { status: 429 });
    const rlBp = checkRate(`value:bp:${id}`, 1, 60 * 1000);
    if (!rlBp.ok) return NextResponse.json({ error: `该项目刚估过值，请 ${rlBp.retryAfter} 秒后再试` }, { status: 429 });

    const db = getDb();
    const bp = db.prepare("SELECT * FROM bps WHERE id = ? AND visibility = 'public'").get(id);
    if (!bp) return NextResponse.json({ error: '项目不存在或非公开' }, { status: 404 });

    const force = req.nextUrl.searchParams.get('force') === '1';
    const summary = await valuateBp(db, bp, { force });
    // 估值变化后顺手调仓：低估加仓 / 高估减仓（纯数据库操作，不调用 LLM）
    let moves = 0;
    if (!summary.skipped) { try { moves = rebalanceAll(db); } catch (e) { console.error('rebalance after valuation failed', e); } }
    return NextResponse.json({ ok: true, summary, skipped: !!summary.skipped, moves });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: '估值失败，请重试' }, { status: 500 });
  }
}
