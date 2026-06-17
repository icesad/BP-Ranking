// 极简会话：HMAC 签名的 cookie（无状态，不需 sessions 表）。payload 为 base64url(JSON)，附 HMAC-SHA256 签名。
// cookie 由登录回调用 NextResponse.cookies.set 写入；服务端组件/路由用 getSessionUser() 读取。
const crypto = require('crypto');
const { cookies } = require('next/headers');

const COOKIE = 'bpr_session';
const MAXAGE = 30 * 24 * 3600; // 30 天（秒）

function secret() {
  return process.env.AUTH_SECRET || 'dev-insecure-secret-change-me';
}
function sign(payloadObj) {
  const payload = Buffer.from(JSON.stringify(payloadObj)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}
function verify(token) {
  if (!token || typeof token !== 'string' || token.indexOf('.') < 0) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expect = crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
  const a = Buffer.from(sig), b = Buffer.from(expect);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const obj = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (obj.exp && Date.now() > obj.exp) return null;
    return obj; // { uid, handle, name, avatar, exp }
  } catch { return null; }
}
// 服务端读取当前登录用户（cookie 内容，不查库）。无登录返回 null。
function getSessionUser() {
  try { return verify(cookies().get(COOKIE)?.value); } catch { return null; }
}

module.exports = { COOKIE, MAXAGE, sign, verify, getSessionUser };
