import { notFound } from 'next/navigation';
import { getDb } from '@/lib/db';
import { bpQuestions } from '@/lib/queries';
import ResubmitForm from '@/components/ResubmitForm';

export const dynamic = 'force-dynamic';

export default function ResubmitPage({ params }) {
  const db = getDb();
  const bp = db.prepare('SELECT id, title, summary, kind, demo_type, demo_url, version, stage FROM bps WHERE id = ?').get(Number(params.id));
  if (!bp) notFound();
  const questions = bpQuestions(bp.id, 3);

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <h1 className="page-title">⚔️ 重新参战</h1>
      <p className="page-sub">
        更新你的{bp.kind === 'demo' ? ' Demo' : ' BP'}内容，12 位投资人将重新评估并调整持仓，争取名次回升。当前版本 v{bp.version || 1}。
      </p>
      <ResubmitForm
        id={bp.id}
        kind={bp.kind || 'bp'}
        title={bp.title}
        summary={bp.summary || ''}
        demoType={bp.demo_type || 'html'}
        demoUrl={bp.demo_url || ''}
        stage={bp.stage || 'idea'}
        questions={questions.map((q) => ({ investor_id: q.investor_id, name: q.name, emoji: q.emoji, question: q.question, answer: q.answer || '' }))}
      />
    </div>
  );
}
