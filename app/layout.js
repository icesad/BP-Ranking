import './globals.css';
import { cookies } from 'next/headers';
import Nav from '@/components/Nav';
import VisitTracker from '@/components/VisitTracker';
import { getSessionUser } from '@/lib/auth';
import { userPoints, citiesAvailable } from '@/lib/queries';

export const metadata = {
  title: 'Demo-Ranking | AI 时代，你的 Demo 到底值多少？12 位 AI 投资人联网估值',
  description: '提交你的 Demo 或 BP，12 位 AI 投资人联网搜索 + 深度推理给出带证据来源的估值与排名，团队背景不计分、只认可验证证据。',
};

export default function RootLayout({ children }) {
  const locale = cookies().get('lang')?.value === 'en' ? 'en' : 'zh';
  const su = getSessionUser();
  const user = su ? { handle: su.handle, name: su.name, avatar: su.avatar, points: (() => { try { return userPoints(su.uid); } catch { return 0; } })() } : null;
  const city = cookies().get('city')?.value || '上海';
  let cities = ['上海']; try { cities = citiesAvailable(); } catch {}
  return (
    <html lang={locale === 'en' ? 'en' : 'zh-CN'}>
      <body>
        <VisitTracker />
        <Nav locale={locale} user={user} city={city} cities={cities} />
        <main className="container">{children}</main>
        <footer className="footer">
          <p>{locale === 'en'
            ? 'Demo-Ranking · All capital is virtual; all “famous investors” are style-simulated agents, not the actual people’s views, and nothing here is investment advice.'
            : 'Demo-Ranking · 所有资金均为虚拟资金，所有“知名投资人”均为风格模拟智能体，不代表本人观点，不构成投资建议。'}</p>
        </footer>
      </body>
    </html>
  );
}
