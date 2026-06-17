import { NextResponse } from 'next/server';
import { followingSummary } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const { ids } = await req.json();
    const clean = (Array.isArray(ids) ? ids : []).map(Number).filter((n) => Number.isInteger(n)).slice(0, 100);
    return NextResponse.json({ items: followingSummary(clean) });
  } catch {
    return NextResponse.json({ items: [] });
  }
}
