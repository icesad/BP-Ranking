import { NextResponse } from 'next/server';
import { extractPptxText } from '@/lib/pptx';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// 仅解析 PPT 提取正文，不入库、不评估。供上传前预览"AI 读到的内容"。
export async function POST(req) {
  try {
    const fd = await req.formData();
    const file = fd.get('file');
    if (!file || typeof file !== 'object' || file.size === 0) {
      return NextResponse.json({ content: '', chars: 0 });
    }
    if (!file.name.toLowerCase().endsWith('.pptx')) {
      return NextResponse.json({ error: '只支持 .pptx 文件' }, { status: 400 });
    }
    if (file.size > 30 * 1024 * 1024) {
      return NextResponse.json({ error: '文件不能超过30MB' }, { status: 400 });
    }
    const buf = Buffer.from(await file.arrayBuffer());
    const content = await extractPptxText(buf);
    return NextResponse.json({ content, chars: content.length });
  } catch {
    return NextResponse.json({ error: '解析失败，请确认是有效的 .pptx 文件' }, { status: 500 });
  }
}
