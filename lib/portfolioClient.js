// 客户端模拟盘存取：登录则走服务端(/api/portfolio)，未登录回退本机 localStorage。
// 供 InvestWidget 与 /portfolio 共用，保证买/卖/重置在两处一致。
const KEY = 'bpr_portfolio';
export const PF_START = 100000000;

let _loggedIn = null; // 模块级缓存（登录/退出会整页跳转重置 JS）
async function checkLogin() {
  if (_loggedIn !== null) return _loggedIn;
  try { const me = await fetch('/api/me').then((r) => r.json()); _loggedIn = !!me.user; } catch { _loggedIn = false; }
  return _loggedIn;
}
function readLocal() { try { const p = JSON.parse(localStorage.getItem(KEY)); if (p && typeof p.fund === 'number') return p; } catch {} return { fund: PF_START, positions: [] }; }
function writeLocal(p) { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch {} }

export async function loadPF() {
  if (await checkLogin()) {
    try { const d = await fetch('/api/portfolio').then((r) => r.json()); if (d.portfolio) return d.portfolio; } catch {}
    return { fund: PF_START, positions: [] };
  }
  return readLocal();
}
export async function savePF(p) {
  if (await checkLogin()) {
    try { await fetch('/api/portfolio', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p) }); } catch {}
  } else writeLocal(p);
}
