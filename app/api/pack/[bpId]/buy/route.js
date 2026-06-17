import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { packForBp } from '@/lib/queries';

export const dynamic = 'force-dynamic';

// 购买提示词包：花积分解锁正文（需登录；积分从买家转给作者）。
export async function POST(req, { params }) {
  const u = getSessionUser();
  if (!u) return NextResponse.json({ error: '请先登录' }, { status: 401 });
  const bpId = Number(params.bpId);
  const db = getDb();
  const pack = db.prepare('SELECT * FROM prompt_packs WHERE bp_id = ?').get(bpId);
  if (!pack) return NextResponse.json({ error: '该作品没有提示词包' }, { status: 404 });
  if (pack.owner_user_id === u.uid) return NextResponse.json({ error: '这是你自己的包' }, { status: 400 });
  if (pack.price <= 0) return NextResponse.json({ error: '该包免费，无需购买' }, { status: 400 });
  const already = db.prepare('SELECT 1 FROM pack_purchases WHERE buyer_user_id = ? AND bp_id = ?').get(u.uid, bpId);
  if (already) return NextResponse.json({ ok: true, pack: packForBp(bpId, u.uid) });

  const me = db.prepare('SELECT points FROM users WHERE id = ?').get(u.uid);
  if (!me || me.points < pack.price) return NextResponse.json({ error: '积分不足' }, { status: 400 });

  try {
    const tx = db.transaction(() => {
      db.prepare('UPDATE users SET points = points - ? WHERE id = ?').run(pack.price, u.uid);
      db.prepare('UPDATE users SET points = points + ? WHERE id = ?').run(pack.price, pack.owner_user_id);
      db.prepare('INSERT INTO pack_purchases (buyer_user_id, bp_id, amount) VALUES (?,?,?)').run(u.uid, bpId, pack.price);
      db.prepare('INSERT INTO ledger (user_id, delta, type, ref_bp_id, ref_user_id, note) VALUES (?,?,?,?,?,?)').run(u.uid, -pack.price, 'purchase_out', bpId, pack.owner_user_id, pack.title);
      db.prepare('INSERT INTO ledger (user_id, delta, type, ref_bp_id, ref_user_id, note) VALUES (?,?,?,?,?,?)').run(pack.owner_user_id, pack.price, 'sale_in', bpId, u.uid, pack.title);
    });
    tx();
  } catch (e) { console.error('[pack.buy]', e?.message || e); return NextResponse.json({ error: '购买失败' }, { status: 500 }); }

  const balance = db.prepare('SELECT points FROM users WHERE id = ?').get(u.uid).points;
  return NextResponse.json({ ok: true, balance, pack: packForBp(bpId, u.uid) });
}
