import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';
const START = 100000000;

// GET → 当前用户的模拟持仓（未登录 {portfolio:null} → 前端回退 localStorage）
export async function GET() {
  const u = getSessionUser();
  if (!u) return NextResponse.json({ portfolio: null });
  const db = getDb();
  const row = db.prepare('SELECT fund, positions FROM portfolios WHERE user_id = ?').get(u.uid);
  let positions = []; try { positions = JSON.parse(row?.positions || '[]'); } catch {}
  return NextResponse.json({ portfolio: { fund: row ? row.fund : START, positions } });
}

// POST {fund, positions} → 保存（需登录）
export async function POST(req) {
  const u = getSessionUser();
  if (!u) return NextResponse.json({ error: '请先登录' }, { status: 401 });
  let fund = START, positions = [];
  try { const b = await req.json(); fund = Number(b.fund); positions = Array.isArray(b.positions) ? b.positions : []; } catch {}
  if (!(fund >= 0)) fund = START;
  const db = getDb();
  db.prepare(`INSERT INTO portfolios (user_id, fund, positions, updated_at) VALUES (?,?,?, datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET fund=excluded.fund, positions=excluded.positions, updated_at=excluded.updated_at`)
    .run(u.uid, fund, JSON.stringify(positions.slice(0, 200)));
  return NextResponse.json({ ok: true });
}
