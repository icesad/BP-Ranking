import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { getDb, DATA_DIR } from '@/lib/db';
import { extractPptxText } from '@/lib/pptx';
import { detectSector } from '@/lib/engine';
import { reEvaluateBp, rebalanceAll } from '@/lib/portfolio';
import { computeRanks, notifyReEntry } from '@/lib/ranks';
import { fetchUrlDemo, fetchGithubRepo } from '@/lib/demofetch';
import { checkRate, clientIp } from '@/lib/ratelimit';
import { moderate } from '@/lib/moderation';

export const dynamic = 'force-dynamic';
export const maxDuration = 90;

function rankOf(db, kind, id) {
  return computeRanks(db, kind).find((r) => r.bp_id === id)?.rank ?? null;
}
function avgScore(db, id) {
  const r = db.prepare('SELECT ROUND(AVG(score),1) a FROM evaluations WHERE bp_id = ?').get(id);
  return r?.a ?? null;
}

export async function POST(req, { params }) {
  try {
    const id = Number(params.id);
    const ip = clientIp(req);
    const rlIp = checkRate(`resubmit:${ip}`, 10, 10 * 60 * 1000);
    if (!rlIp.ok) return NextResponse.json({ error: `重新参战太频繁，请 ${rlIp.retryAfter} 秒后再试` }, { status: 429 });
    const rlBp = checkRate(`resubmit:bp:${id}`, 1, 60 * 1000);
    if (!rlBp.ok) return NextResponse.json({ error: `同一项目刚刚提交过，请 ${rlBp.retryAfter} 秒后再试` }, { status: 429 });
    const db = getDb();
    const bp = db.prepare('SELECT * FROM bps WHERE id = ?').get(id);
    if (!bp) return NextResponse.json({ error: '项目不存在' }, { status: 404 });
    const kind = bp.kind || 'bp';

    const fd = await req.formData();
    const title = (fd.get('title') || '').toString().trim() || bp.title;
    const summary = (fd.get('summary') || '').toString().trim();
    if (!summary) return NextResponse.json({ error: '请填写更新后的简介' }, { status: 400 });
    const stage = ['idea', 'mvp', 'revenue'].includes(fd.get('stage')) ? fd.get('stage').toString() : (bp.stage || 'idea');

    // 创始人对投资人提问的答复
    let answers = [];
    try { answers = JSON.parse((fd.get('answers') || '[]').toString()); } catch {}
    answers = Array.isArray(answers) ? answers.filter((x) => x && x.a && x.a.trim()) : [];

    const mod = moderate(`${title} ${summary} ${answers.map((x) => x.a).join(' ')}`);
    if (!mod.ok) return NextResponse.json({ error: mod.reason }, { status: 400 });

    let content = bp.content;
    let filename = bp.filename;
    let demoUrl = bp.demo_url;
    let demoType = bp.demo_type;

    if (kind === 'demo') {
      demoType = (fd.get('demo_type') || bp.demo_type || 'html').toString();
      if (demoType === 'html') {
        const file = fd.get('file');
        if (file && typeof file === 'object' && file.size > 0) {
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
          demoUrl = '';
        }
      } else {
        const url = (fd.get('url') || '').toString().trim();
        if (url) {
          if (!/^https?:\/\/.+/.test(url)) {
            return NextResponse.json({ error: '请填写有效的链接（以 http:// 或 https:// 开头）' }, { status: 400 });
          }
          demoUrl = url;
          filename = '';
          if (demoType === 'github') {
            const r = await fetchGithubRepo(url);
            content = r.content;
          } else {
            const r = await fetchUrlDemo(url);
            content = r.content;
            if (r.loadMs) content = `[页面响应时间 ${r.loadMs}ms]\n` + content;
          }
        }
      }
    } else {
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
    }

    // 把答复并入正文(供投资人重评时参考)并存档到 qa 表
    if (answers.length) {
      const qaText = answers.map((x) => `Q（投资人）：${x.q || ''}\nA（创始人）：${x.a.trim()}`).join('\n');
      content = `${content || ''}\n\n【路演问答】\n${qaText}`;
      const up = db.prepare(`INSERT INTO qa (bp_id, investor_id, q, a) VALUES (?,?,?,?)
        ON CONFLICT(bp_id, investor_id) DO UPDATE SET q=excluded.q, a=excluded.a, created_at=datetime('now')`);
      for (const x of answers) {
        if (!Number.isInteger(Number(x.investor_id))) continue;
        up.run(id, Number(x.investor_id), (x.q || '').toString(), x.a.trim());
      }
    }

    const sector = detectSector(`${title} ${summary} ${(content || '').slice(0, 5000)}`);
    const newVersion = (bp.version || 1) + 1;
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19);

    // 参战前名次 / 均分
    const rankBefore = rankOf(db, kind, id);
    const avgBefore = avgScore(db, id);

    db.prepare(
      `UPDATE bps SET title=?, summary=?, content=?, sector=?, filename=?, demo_type=?, demo_url=?, version=?, last_resubmit_at=?, stage=? WHERE id=?`
    ).run(title, summary, content, sector, filename, demoType, demoUrl, newVersion, now, stage, id);

    const updated = db.prepare('SELECT * FROM bps WHERE id = ?').get(id);

    // 重评全部投资人 → 全局调仓（按新评分调整持仓，避免重复注资）
    await reEvaluateBp(db, updated);
    rebalanceAll(db); // 内部已写快照并对名次变化生成通知

    const rankAfter = rankOf(db, kind, id);
    const avgAfter = avgScore(db, id);

    let body = `重新参战 v${newVersion}`;
    if (avgBefore != null && avgAfter != null) body += `，均分 ${avgBefore} → ${avgAfter}`;
    notifyReEntry(db, id, kind, body, rankBefore, rankAfter);

    return NextResponse.json({ id, version: newVersion, rankBefore, rankAfter, avgBefore, avgAfter });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: '服务器处理失败，请重试' }, { status: 500 });
  }
}
