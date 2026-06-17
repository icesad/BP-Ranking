import path from 'path';
import fs from 'fs';
import { getDb, DATA_DIR } from '@/lib/db';

export const dynamic = 'force-dynamic';

// 托管已上传的单文件HTML Demo，供详情页iframe试玩
export async function GET(req, { params }) {
  const db = getDb();
  const bp = db.prepare("SELECT * FROM bps WHERE id = ? AND kind = 'demo'").get(Number(params.id));
  if (!bp || bp.visibility !== 'public' || bp.demo_type !== 'html' || !bp.filename) {
    return new Response('Not found', { status: 404 });
  }
  const fp = path.join(DATA_DIR, 'uploads', path.basename(bp.filename));
  if (!fs.existsSync(fp)) return new Response('Not found', { status: 404 });
  return new Response(fs.readFileSync(fp), {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'X-Frame-Options': 'SAMEORIGIN',
      'Content-Security-Policy': "sandbox allow-scripts allow-pointer-lock;",
    },
  });
}
