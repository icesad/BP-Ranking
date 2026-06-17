import { dealflowProjects } from '@/lib/queries';
import { SECTOR_LABELS, STAGE_LABELS, BIZ_MODEL_LABELS, CUSTOMER_LABELS, evidenceCount } from '@/lib/engine';

export const dynamic = 'force-dynamic';

const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

export async function GET(req) {
  const sp = req.nextUrl.searchParams;
  const f = { sector: sp.get('sector') || '', stage: sp.get('stage') || '', model: sp.get('model') || '', minScore: sp.get('minScore') || '' };
  const rows = dealflowProjects(f);
  const origin = req.nextUrl.origin;
  const header = ['项目', '创始人', '赛道', '子赛道', '阶段', '商业模式', '服务对象', '均分', '评分分歧', '投资人数', '累计注资(元)', '证据数', '链接'];
  const body = rows.map((r) => [
    r.title, r.founder, SECTOR_LABELS[r.sector] || r.sector, r.subsector,
    STAGE_LABELS[r.stage] || '', BIZ_MODEL_LABELS[r.biz_model] || '', CUSTOMER_LABELS[r.customer] || '',
    r.avg_score ?? '', r.spread ?? '', r.investor_count, Math.round(r.total_invested),
    evidenceCount(`${r.summary} ${r.content}`), `${origin}/bp/${r.id}`,
  ]);
  const csv = '﻿' + [header, ...body].map((row) => row.map(cell).join(',')).join('\r\n');
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="bp-ranking-dealflow.csv"`,
    },
  });
}
