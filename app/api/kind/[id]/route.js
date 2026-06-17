import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

// 返回某项目的赛道类型（bp|demo），供导航栏在详情页决定显示"上传BP"还是"提交Demo"。
export async function GET(req, { params }) {
  const row = getDb().prepare('SELECT kind FROM bps WHERE id = ?').get(Number(params.id));
  return NextResponse.json({ kind: row?.kind || null });
}
