import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

// Demo 是重心：根路径默认进 Demo 榜。BP 榜在 /bp。
export default function Home() {
  redirect('/demos');
}
