import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { getDb, DATA_DIR } from '@/lib/db';
import { detectSector } from '@/lib/engine';
import { processNewBp } from '@/lib/portfolio';
import { fetchUrlDemo, fetchGithubRepo } from '@/lib/demofetch';
import { checkRate, clientIp } from '@/lib/ratelimit';
import { moderate } from '@/lib/moderation';
import { captureUrl } from '@/lib/screenshot';
import { getSessionUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 90;

export async function POST(req) {
  try {
    const rl = checkRate(`upload:${clientIp(req)}`, 5, 10 * 60 * 1000);
    if (!rl.ok) return NextResponse.json({ error: `提交太频繁，请 ${rl.retryAfter} 秒后再试` }, { status: 429 });
    const fd = await req.formData();
    const title = (fd.get('title') || '').toString().trim();
    const founder = (fd.get('founder') || '').toString().trim();
    const summary = (fd.get('summary') || '').toString().trim();
    const demoType = (fd.get('demo_type') || '').toString();
    const visibility = fd.get('visibility') === 'ai_only' ? 'ai_only' : 'public';
    if (!title || !founder || !summary || !['html', 'url', 'github', 'shots'].includes(demoType)) {
      return NextResponse.json({ error: '请填写完整信息' }, { status: 400 });
    }

    let content = '';
    let filename = '';
    let demoUrl = '';
    let shotPre = ''; // 截图+描述模式直接用上传的图片当截图

    if (demoType === 'shots') {
      const img = fd.get('file');
      if (!img || typeof img !== 'object' || img.size === 0) {
        return NextResponse.json({ error: '请上传一张截图' }, { status: 400 });
      }
      if (!/^image\//.test(img.type) && !/\.(png|jpe?g|webp|gif)$/i.test(img.name || '')) {
        return NextResponse.json({ error: '只支持图片文件（png/jpg/webp）' }, { status: 400 });
      }
      if (img.size > 8 * 1024 * 1024) {
        return NextResponse.json({ error: '图片不能超过8MB' }, { status: 400 });
      }
      const buf = Buffer.from(await img.arrayBuffer());
      shotPre = `shot-${Date.now()}.png`;
      fs.writeFileSync(path.join(DATA_DIR, 'uploads', shotPre), buf);
      content = summary; // 文本模型按描述评估（不读图）
    } else if (demoType === 'html') {
      const file = fd.get('file');
      if (!file || typeof file !== 'object' || file.size === 0) {
        return NextResponse.json({ error: '请上传 .html 文件' }, { status: 400 });
      }
      if (!/\.html?$/i.test(file.name)) {
        return NextResponse.json({ error: '只支持 .html 文件' }, { status: 400 });
      }
      if (file.size > 5 * 1024 * 1024) {
        return NextResponse.json({ error: '文件不能超过5MB' }, { status: 400 });
      }
      const buf = Buffer.from(await file.arrayBuffer());
      content = buf.toString('utf-8');
      filename = `demo-${Date.now()}-${file.name.replace(/[^\w.一-龥-]/g, '_')}`;
      fs.writeFileSync(path.join(DATA_DIR, 'uploads', filename), buf);
    } else {
      demoUrl = (fd.get('url') || '').toString().trim();
      if (!/^https?:\/\/.+/.test(demoUrl)) {
        return NextResponse.json({ error: '请填写有效的链接（以 http:// 或 https:// 开头）' }, { status: 400 });
      }
      if (demoType === 'github') {
        const r = await fetchGithubRepo(demoUrl);
        content = r.content;
      } else {
        const r = await fetchUrlDemo(demoUrl);
        content = r.content;
        if (r.loadMs) content = `[页面响应时间 ${r.loadMs}ms]\n` + content;
      }
    }

    const mod = moderate(`${title} ${summary} ${content.slice(0, 5000)}`);
    if (!mod.ok) return NextResponse.json({ error: mod.reason }, { status: 400 });

    // 截图模式：用上传的图；在线URL：抓取截图；HTML：上传后截本地预览
    let shot = shotPre;
    if (demoType === 'url' && demoUrl) { shot = (await captureUrl(demoUrl)) || ''; }

    const db = getDb();
    const sector = detectSector(`${title} ${summary} ${content.slice(0, 5000)}`);
    const ownerId = getSessionUser()?.uid || null; // 登录则归属该账户（匿名仍允许）
    const r = db.prepare(
      "INSERT INTO bps (title, founder, summary, content, sector, visibility, filename, kind, demo_type, demo_url, shot, owner_user_id) VALUES (?,?,?,?,?,?,?,'demo',?,?,?,?)"
    ).run(title, founder, summary, content, sector, visibility, filename, demoType, demoUrl, shot, ownerId);

    const bp = db.prepare('SELECT * FROM bps WHERE id = ?').get(r.lastInsertRowid);

    if (demoType === 'html' && bp.visibility === 'public') {
      const s = await captureUrl(`${req.nextUrl.origin}/api/demo/${bp.id}/preview`);
      if (s) { db.prepare('UPDATE bps SET shot = ? WHERE id = ?').run(s, bp.id); bp.shot = s; }
    }

    await processNewBp(db, bp);

    return NextResponse.json({ id: bp.id });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: '服务器处理失败，请重试' }, { status: 500 });
  }
}
