import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { improvementPlan, scoreRubric } from '@/lib/deepseek';
import { comparablesFor } from '@/lib/comparables';
import { classifyArchetypeFallback, compositeScore } from '@/lib/engine';
import { checkRate, clientIp } from '@/lib/ratelimit';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

// 生成改进建议：依据六维评分卡(val_summary.rubric)弱项 + 可比库，产出可执行建议并写 suggestions 表。
// 较便宜（一次 deepseek-chat）。若项目是旧算法估的、还没有 rubric，则当场补算一次评分卡再出建议。
export async function POST(req, { params }) {
  try {
    const id = Number(params.id);
    const rl = checkRate(`suggest:${clientIp(req)}`, 10, 10 * 60 * 1000);
    if (!rl.ok) return NextResponse.json({ error: `太频繁，请 ${rl.retryAfter} 秒后再试` }, { status: 429 });

    const db = getDb();
    const bp = db.prepare("SELECT * FROM bps WHERE id = ? AND visibility = 'public'").get(id);
    if (!bp) return NextResponse.json({ error: '项目不存在或非公开' }, { status: 404 });

    let summary = null; try { summary = JSON.parse(bp.val_summary || 'null'); } catch {}
    if (!summary || !(summary.n > 0)) {
      return NextResponse.json({ error: '请先对该项目做一次估值，再获取改进建议' }, { status: 400 });
    }

    const archetype = bp.archetype || summary.archetype || classifyArchetypeFallback(bp);
    const comps = comparablesFor(db, bp, 5);

    // 旧估值缺评分卡 → 当场补算一次（便宜），并回写 val_summary，顺便点亮 What-if 雷达
    if (!summary.rubric) {
      let evidence = []; try { evidence = JSON.parse(bp.val_evidence || '[]'); } catch {}
      const rb = await scoreRubric(bp, archetype, evidence, comps, summary.floor || 0, null);
      if (rb && rb.dims) {
        summary.rubric = rb.dims; summary.rubricEn = rb.en;
        summary.compScore = compositeScore(rb.dims, archetype);
        summary.archetype = archetype;
        db.prepare('UPDATE bps SET val_summary = ? WHERE id = ?').run(JSON.stringify(summary), id);
      }
    }

    const list = await improvementPlan(bp, summary.rubric || null, archetype, comps, summary);
    if (!list || !list.length) return NextResponse.json({ error: '暂未生成建议，请稍后重试' }, { status: 502 });

    const algo = summary.algo_version || 'v2';
    const tx = db.transaction(() => {
      db.prepare('DELETE FROM suggestions WHERE bp_id = ?').run(id);
      const ins = db.prepare(`INSERT INTO suggestions
        (bp_id, archetype, dim, rubric_dim, title, detail, evidence_needed, potential, effort, evidence_url, en, algo_version, created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?, datetime('now'))`);
      for (const s of list) {
        ins.run(id, archetype, s.dim, s.rubric_dim, s.title, s.detail, s.evidence_needed, s.potential, s.effort, s.evidence_url, JSON.stringify(s.en || null), algo);
      }
    });
    tx();

    const rows = db.prepare('SELECT * FROM suggestions WHERE bp_id = ? ORDER BY id ASC').all(id);
    return NextResponse.json({ ok: true, suggestions: rows });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: '生成建议失败，请重试' }, { status: 500 });
  }
}
