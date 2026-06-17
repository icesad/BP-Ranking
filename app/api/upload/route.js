import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { getDb, DATA_DIR } from '@/lib/db';
import { extractPptxText } from '@/lib/pptx';
import { detectSector } from '@/lib/engine';
import { processNewBp } from '@/lib/portfolio';
import { checkRate, clientIp } from '@/lib/ratelimit';
import { moderate } from '@/lib/moderation';
import { getSessionUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req) {
  try {
    const rl = checkRate(`upload:${clientIp(req)}`, 5, 10 * 60 * 1000);
    if (!rl.ok) return NextResponse.json({ error: `上传太频繁，请 ${rl.retryAfter} 秒后再试` }, { status: 429 });
    const fd = await req.formData();
    const title = (fd.get('title') || '').toString().trim();
    const founder = (fd.get('founder') || '').toString().trim();
    const summary = (fd.get('summary') || '').toString().trim();
    const visibility = fd.get('visibility') === 'ai_only' ? 'ai_only' : 'public';
    const stage = ['idea', 'mvp', 'revenue'].includes(fd.get('stage')) ? fd.get('stage').toString() : 'idea';
    if (!title || !founder || !summary) {
      return NextResponse.json({ error: '请填写完整信息' }, { status: 400 });
    }

    let content = '';
    let filename = '';
    const file = fd.get('file');
    if (file && typeof file === 'object' && file.size > 0) {
      if (!file.name.toLowerCase().endsWith('.pptx')) {
        return NextResponse.json({ error: '只支持 .pptx 文件' }, { status: 400 });
      }
      if (file.size > 30 * 1024 * 1024) {
        return NextResponse.json({ error: '文件不能超过30MB' }, { status: 400 });
      }
      const buf = Buffer.from(await file.arrayBuffer());
      filename = `${Date.now()}-${file.name.replace(/[^\w.一-龥-]/g, '_')}`;
      fs.writeFileSync(path.join(DATA_DIR, 'uploads', filename), buf);
      content = await extractPptxText(buf);
    }

    const mod = moderate(`${title} ${summary} ${content}`);
    if (!mod.ok) return NextResponse.json({ error: mod.reason }, { status: 400 });

    const db = getDb();
    const sector = detectSector(`${title} ${summary} ${content}`);
    const ownerId = getSessionUser()?.uid || null; // 登录则归属该账户（匿名仍允许）
    const r = db.prepare(
      'INSERT INTO bps (title, founder, summary, content, sector, visibility, filename, stage, owner_user_id) VALUES (?,?,?,?,?,?,?,?,?)'
    ).run(title, founder, summary, content, sector, visibility, filename, stage, ownerId);

    const bp = db.prepare('SELECT * FROM bps WHERE id = ?').get(r.lastInsertRowid);
    await processNewBp(db, bp); // 12位投资人评估并注资（DeepSeek配置密钥时真实调用）

    return NextResponse.json({ id: bp.id });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: '服务器处理失败，请重试' }, { status: 500 });
  }
}
