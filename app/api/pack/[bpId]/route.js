import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { packForBp } from '@/lib/queries';

export const dynamic = 'force-dynamic';

// GET → 提示词包（已购/作者得正文，否则只给预览）
export async function GET(req, { params }) {
  const u = getSessionUser();
  const pack = packForBp(Number(params.bpId), u?.uid || null);
  return NextResponse.json({ pack });
}

// POST → 作者创建/更新自己作品的提示词包（需登录且为作品归属者）
export async function POST(req, { params }) {
  const u = getSessionUser();
  if (!u) return NextResponse.json({ error: '请先登录' }, { status: 401 });
  const bpId = Number(params.bpId);
  const db = getDb();
  const bp = db.prepare('SELECT id, owner_user_id FROM bps WHERE id = ?').get(bpId);
  if (!bp) return NextResponse.json({ error: '项目不存在' }, { status: 404 });
  if (bp.owner_user_id !== u.uid) return NextResponse.json({ error: '只有作品作者能设置提示词包' }, { status: 403 });

  const KINDS = ['claude_md', 'skill', 'plugin', 'prompt', 'workflow', 'config', 'other'];
  let title, preview, body, price, llm, stack, assets;
  try {
    const b = await req.json();
    title = String(b.title || '').slice(0, 80);
    preview = String(b.preview || '').slice(0, 800);
    body = String(b.body || '').slice(0, 20000);
    price = Math.max(0, Math.floor(Number(b.price) || 0));
    llm = String(b.llm || '').slice(0, 60);
    stack = (Array.isArray(b.stack) ? b.stack : []).map((x) => String(x).trim().slice(0, 30)).filter(Boolean).slice(0, 12);
    assets = (Array.isArray(b.assets) ? b.assets : []).slice(0, 20).map((a) => ({
      kind: KINDS.includes(a?.kind) ? a.kind : 'other',
      title: String(a?.title || '').slice(0, 80),
      content: String(a?.content || '').slice(0, 20000),
    })).filter((a) => a.title || a.content);
  } catch { return NextResponse.json({ error: '参数有误' }, { status: 400 }); }
  if (!body && assets.length === 0) return NextResponse.json({ error: '正文或至少一个资产不能为空' }, { status: 400 });

  db.prepare(`INSERT INTO prompt_packs (bp_id, owner_user_id, title, preview, body, llm, stack, assets, price, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?, datetime('now'))
    ON CONFLICT(bp_id) DO UPDATE SET title=excluded.title, preview=excluded.preview, body=excluded.body, llm=excluded.llm, stack=excluded.stack, assets=excluded.assets, price=excluded.price, updated_at=excluded.updated_at`)
    .run(bpId, u.uid, title, preview, body, llm, JSON.stringify(stack), JSON.stringify(assets), price);
  return NextResponse.json({ ok: true, pack: packForBp(bpId, u.uid) });
}
