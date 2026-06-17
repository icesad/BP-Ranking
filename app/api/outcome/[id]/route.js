import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { checkRate, clientIp } from '@/lib/ratelimit';

export const dynamic = 'force-dynamic';

const TYPES = ['raised', 'acquired', 'revenue', 'users', 'shutdown', 'other'];

// 报告项目的真实结果（融资/收购/营收/用户/停运）。匿名可提交，建议附来源链接以便核实。
export async function POST(req, { params }) {
  try {
    const id = Number(params.id);
    const rl = checkRate(`outcome:${clientIp(req)}`, 10, 10 * 60 * 1000);
    if (!rl.ok) return NextResponse.json({ error: `提交太频繁，请 ${rl.retryAfter} 秒后再试` }, { status: 429 });
    const db = getDb();
    const bp = db.prepare("SELECT id FROM bps WHERE id = ? AND visibility = 'public'").get(id);
    if (!bp) return NextResponse.json({ error: '项目不存在或非公开' }, { status: 404 });

    const body = await req.json();
    const type = TYPES.includes(body.type) ? body.type : 'other';
    let amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount < 0) amount = null;
    const note = String(body.note || '').slice(0, 300);
    const source_url = String(body.source_url || '').slice(0, 400);
    const occurred_at = /^\d{4}-\d{2}(-\d{2})?$/.test(String(body.occurred_at || ''))
      ? String(body.occurred_at)
      : new Date().toISOString().slice(0, 10);

    db.prepare('INSERT INTO outcomes (bp_id, type, amount, note, source_url, occurred_at) VALUES (?,?,?,?,?,?)')
      .run(id, type, amount, note, source_url, occurred_at);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: '提交失败' }, { status: 500 });
  }
}
