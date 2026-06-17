import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { valuateBp } from '@/lib/valuation';
import { checkRate, clientIp } from '@/lib/ratelimit';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// 是否还没有有效估值（无 val_summary 或 n<=0）
function needsVal(bp) {
  if (!bp.val_summary) return true;
  try { const v = JSON.parse(bp.val_summary); return !(v && v.n > 0); } catch { return true; }
}

// GET：列出还没估值的公开 Demo（前端据此逐个调用 POST）
export async function GET() {
  const db = getDb();
  const rows = db.prepare("SELECT id, title, val_summary FROM bps WHERE kind='demo' AND visibility='public' ORDER BY id").all();
  const pending = rows.filter(needsVal).map((r) => ({ id: r.id, title: r.title }));
  return NextResponse.json({ pending, count: pending.length });
}

// POST {id}：对单个公开 Demo 估值。批量循环时由前端逐个、顺序调用。
export async function POST(req) {
  try {
    const rl = checkRate(`valuebatch:${clientIp(req)}`, 80, 10 * 60 * 1000);
    if (!rl.ok) return NextResponse.json({ error: `操作太频繁，请 ${rl.retryAfter} 秒后再试` }, { status: 429 });
    const { id } = await req.json();
    const db = getDb();
    const bp = db.prepare("SELECT * FROM bps WHERE id = ? AND kind='demo' AND visibility='public'").get(Number(id));
    if (!bp) return NextResponse.json({ error: '项目不存在或非公开' }, { status: 404 });
    const summary = await valuateBp(db, bp, {});
    return NextResponse.json({ ok: true, id: bp.id, summary, skipped: !!summary.skipped });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: '估值失败' }, { status: 500 });
  }
}
