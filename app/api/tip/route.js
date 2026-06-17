import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// 打赏：把积分从打赏者转给作品作者（需登录；作品须有归属账户；不能打赏自己）。
export async function POST(req) {
  const u = getSessionUser();
  if (!u) return NextResponse.json({ error: '请先登录' }, { status: 401 });
  let bpId, amount, message;
  try { const b = await req.json(); bpId = Number(b.bpId); amount = Math.floor(Number(b.amount)); message = String(b.message || '').slice(0, 140); } catch {}
  if (!bpId || !(amount > 0)) return NextResponse.json({ error: '参数有误' }, { status: 400 });

  const db = getDb();
  const bp = db.prepare("SELECT id, owner_user_id, title FROM bps WHERE id = ? AND visibility = 'public'").get(bpId);
  if (!bp) return NextResponse.json({ error: '项目不存在或非公开' }, { status: 404 });
  if (!bp.owner_user_id) return NextResponse.json({ error: '该作品暂未绑定作者账户，无法打赏' }, { status: 400 });
  if (bp.owner_user_id === u.uid) return NextResponse.json({ error: '不能打赏自己的作品' }, { status: 400 });

  const me = db.prepare('SELECT points FROM users WHERE id = ?').get(u.uid);
  if (!me || me.points < amount) return NextResponse.json({ error: '积分不足' }, { status: 400 });

  try {
    const tx = db.transaction(() => {
      db.prepare('UPDATE users SET points = points - ? WHERE id = ?').run(amount, u.uid);
      db.prepare('UPDATE users SET points = points + ? WHERE id = ?').run(amount, bp.owner_user_id);
      db.prepare('INSERT INTO tips (from_user_id, to_user_id, bp_id, amount, message) VALUES (?,?,?,?,?)').run(u.uid, bp.owner_user_id, bpId, amount, message);
      db.prepare('INSERT INTO ledger (user_id, delta, type, ref_bp_id, ref_user_id, note) VALUES (?,?,?,?,?,?)').run(u.uid, -amount, 'tip_out', bpId, bp.owner_user_id, message);
      db.prepare('INSERT INTO ledger (user_id, delta, type, ref_bp_id, ref_user_id, note) VALUES (?,?,?,?,?,?)').run(bp.owner_user_id, amount, 'tip_in', bpId, u.uid, message);
    });
    tx();
  } catch (e) { console.error('[tip]', e?.message || e); return NextResponse.json({ error: '打赏失败' }, { status: 500 }); }

  const balance = db.prepare('SELECT points FROM users WHERE id = ?').get(u.uid).points;
  const total = db.prepare('SELECT COALESCE(SUM(amount),0) t FROM tips WHERE bp_id = ?').get(bpId).t;
  return NextResponse.json({ ok: true, balance, total });
}
