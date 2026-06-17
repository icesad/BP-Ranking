import { NextResponse } from 'next/server';
import { usdCnyRate } from '@/lib/fx';

export const dynamic = 'force-dynamic';

// 当前美元→人民币汇率（供录入表单做 ¥/$ 换算）。
export async function GET() {
  const rate = await usdCnyRate();
  return NextResponse.json({ rate: Math.round(rate * 10000) / 10000, at: new Date().toISOString().slice(0, 10) });
}
