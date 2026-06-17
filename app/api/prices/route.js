import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

// 返回一组项目的当前“市价”（= 累计注资）+ 标题，供用户投资组合估值。
export async function POST(req) {
  try {
    const { ids } = await req.json();
    const clean = (Array.isArray(ids) ? ids : []).map(Number).filter(Number.isInteger).slice(0, 200);
    const db = getDb();
    const out = {};
    for (const id of clean) {
      const row = db.prepare(`
        SELECT b.title, b.visibility, COALESCE(SUM(CASE WHEN h.amount > 0 THEN h.amount END), 0) AS total
        FROM bps b LEFT JOIN holdings h ON h.bp_id = b.id WHERE b.id = ?
      `).get(id);
      if (row) out[id] = { price: row.total, title: row.visibility === 'public' ? row.title : '🔒 神秘项目' };
    }
    return NextResponse.json({ prices: out });
  } catch {
    return NextResponse.json({ prices: {} });
  }
}
