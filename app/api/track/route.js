import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

// 记录访问 / 第一方信号：
//  - {v}                  → 全站访问（按天去重，复访率统计）
//  - {v, bp, kind, dwell} → 某项目的第一方信号（view|play|share，按 visitor/day/kind 去重；dwell 取当天最大）
const KINDS = ['view', 'play', 'share'];
export async function POST(req) {
  try {
    const { v, bp, kind, dwell } = await req.json();
    if (!v || typeof v !== 'string' || v.length > 64) return NextResponse.json({ ok: false });
    const db = getDb();
    // 全站访问
    db.prepare("INSERT OR IGNORE INTO visits (visitor, day) VALUES (?, date('now'))").run(v);
    // 项目级第一方信号
    const bpId = Number(bp);
    if (bpId && KINDS.includes(kind)) {
      const d = Math.max(0, Math.min(7200000, Number(dwell) || 0)); // 上限 2h，防异常值
      db.prepare("INSERT OR IGNORE INTO bp_events (bp_id, visitor, kind, day, dwell_ms) VALUES (?, ?, ?, date('now'), ?)").run(bpId, v, kind, d);
      if (kind === 'view' && d > 0) {
        db.prepare("UPDATE bp_events SET dwell_ms = MAX(dwell_ms, ?) WHERE bp_id = ? AND visitor = ? AND kind = 'view' AND day = date('now')").run(d, bpId, v);
      }
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false });
  }
}
