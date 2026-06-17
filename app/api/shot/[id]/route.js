import path from 'path';
import fs from 'fs';
import { getDb, DATA_DIR } from '@/lib/db';

export const dynamic = 'force-dynamic';

// 提供公开项目的首屏截图。仅AI可见/无截图 → 404。
export async function GET(req, { params }) {
  const db = getDb();
  const bp = db.prepare('SELECT shot, visibility FROM bps WHERE id = ?').get(Number(params.id));
  if (!bp || bp.visibility !== 'public' || !bp.shot) return new Response('Not found', { status: 404 });
  const fp = path.join(DATA_DIR, 'uploads', path.basename(bp.shot));
  if (!fs.existsSync(fp)) return new Response('Not found', { status: 404 });
  return new Response(fs.readFileSync(fp), {
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=300' },
  });
}
