import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { NEED_TYPES, resourcesList } from '@/lib/queries';

export const dynamic = 'force-dynamic';

// GET ?type= → 资源列表
export async function GET(req) {
  const type = req.nextUrl.searchParams.get('type') || '';
  return NextResponse.json({ resources: resourcesList({ type }) });
}

// POST {type, title, detail, region, contact} → 自荐为资源/服务方（需登录）
export async function POST(req) {
  const u = getSessionUser();
  if (!u) return NextResponse.json({ error: '请先登录' }, { status: 401 });
  let b = {};
  try { b = await req.json(); } catch {}
  const type = NEED_TYPES[b.type] ? b.type : null;
  const title = String(b.title || '').trim().slice(0, 80);
  const detail = String(b.detail || '').trim().slice(0, 500);
  const region = String(b.region || '').trim().slice(0, 30);
  const contact = String(b.contact || '').trim().slice(0, 120);
  if (!type || !title) return NextResponse.json({ error: '请选择类型并填写标题' }, { status: 400 });
  const info = getDb().prepare('INSERT INTO resources (user_id, type, title, detail, region, contact) VALUES (?,?,?,?,?,?)')
    .run(u.uid, type, title, detail, region, contact);
  return NextResponse.json({ ok: true, id: info.lastInsertRowid });
}
