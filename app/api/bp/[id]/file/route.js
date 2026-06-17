import path from 'path';
import fs from 'fs';
import { getDb, DATA_DIR } from '@/lib/db';

export const dynamic = 'force-dynamic';

// 下载公开 BP 的原 .pptx 文件。仅AI可见 / 无文件 / 不存在 → 404（沿用隐私规则）。
export async function GET(req, { params }) {
  const db = getDb();
  const bp = db.prepare("SELECT * FROM bps WHERE id = ? AND kind = 'bp'").get(Number(params.id));
  if (!bp || bp.visibility !== 'public' || !bp.filename) {
    return new Response('Not found', { status: 404 });
  }
  const fp = path.join(DATA_DIR, 'uploads', path.basename(bp.filename));
  if (!fs.existsSync(fp)) return new Response('Not found', { status: 404 });

  // 友好下载名：用项目标题，去掉非法字符
  const safeTitle = (bp.title || 'BP').replace(/[\\/:*?"<>|]/g, '_').slice(0, 60);
  const dispName = `${safeTitle}.pptx`;
  return new Response(fs.readFileSync(fp), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'Content-Disposition': `attachment; filename="BP.pptx"; filename*=UTF-8''${encodeURIComponent(dispName)}`,
    },
  });
}
