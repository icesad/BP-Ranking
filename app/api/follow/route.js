import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET  → 当前用户已关注的 bp id 列表（未登录返回 {ids:null} 让前端回退 localStorage）
export async function GET() {
  const u = getSessionUser();
  if (!u) return NextResponse.json({ ids: null });
  const db = getDb();
  const ids = db.prepare('SELECT bp_id FROM follows WHERE user_id = ? ORDER BY created_at DESC').all(u.uid).map((r) => r.bp_id);
  return NextResponse.json({ ids });
}

// POST {bpId} → 切换关注（需登录）。返回 {followed}
export async function POST(req) {
  const u = getSessionUser();
  if (!u) return NextResponse.json({ error: '请先登录' }, { status: 401 });
  let bpId;
  try { bpId = Number((await req.json()).bpId); } catch { bpId = 0; }
  if (!bpId) return NextResponse.json({ error: 'bad bpId' }, { status: 400 });
  const db = getDb();
  const exists = db.prepare('SELECT 1 FROM follows WHERE user_id = ? AND bp_id = ?').get(u.uid, bpId);
  if (exists) {
    db.prepare('DELETE FROM follows WHERE user_id = ? AND bp_id = ?').run(u.uid, bpId);
    return NextResponse.json({ followed: false });
  }
  db.prepare('INSERT OR IGNORE INTO follows (user_id, bp_id) VALUES (?,?)').run(u.uid, bpId);
  return NextResponse.json({ followed: true });
}
