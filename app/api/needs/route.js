import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { NEED_TYPES, needsList } from '@/lib/queries';

export const dynamic = 'force-dynamic';

// GET ?type= → 需求列表
export async function GET(req) {
  const type = req.nextUrl.searchParams.get('type') || '';
  return NextResponse.json({ needs: needsList({ type }) });
}

// POST {type, detail, region, bpId?} → 发布需求（需登录）。action:'close' + id → 关闭自己的需求
export async function POST(req) {
  const u = getSessionUser();
  if (!u) return NextResponse.json({ error: '请先登录' }, { status: 401 });
  let b = {};
  try { b = await req.json(); } catch {}
  const db = getDb();

  if (b.action === 'close' && b.id) {
    db.prepare("UPDATE needs SET status='closed' WHERE id=? AND user_id=?").run(Number(b.id), u.uid);
    return NextResponse.json({ ok: true });
  }

  const type = NEED_TYPES[b.type] ? b.type : null;
  const detail = String(b.detail || '').trim().slice(0, 500);
  const region = String(b.region || '').trim().slice(0, 30);
  const bpId = b.bpId ? Number(b.bpId) : null;
  if (!type || !detail) return NextResponse.json({ error: '请选择类型并填写需求说明' }, { status: 400 });
  // 关联作品须属于本人
  let ownBp = null;
  if (bpId) { const r = db.prepare('SELECT id FROM bps WHERE id=? AND owner_user_id=?').get(bpId, u.uid); ownBp = r ? bpId : null; }
  const info = db.prepare('INSERT INTO needs (user_id, bp_id, type, detail, region) VALUES (?,?,?,?,?)').run(u.uid, ownBp, type, detail, region);
  return NextResponse.json({ ok: true, id: info.lastInsertRowid });
}
