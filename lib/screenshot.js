// 用无头浏览器给 URL/本地 Demo 截首屏图。puppeteer 为可选依赖（懒加载）：
// 未安装或失败时返回 null，不影响主流程。安装：npm install puppeteer
const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('./db');

async function captureUrl(url, opts = {}) {
  let puppeteer;
  try { puppeteer = require('puppeteer'); } catch { return null; } // 未安装则跳过
  let browser;
  try {
    browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 750, deviceScaleFactor: 1 });
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 20000 });
    await new Promise((r) => setTimeout(r, 1200)); // 等动画/渲染
    const dir = path.join(DATA_DIR, 'uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const filename = `shot-${Date.now()}.png`;
    const buf = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: 1200, height: 750 } });
    fs.writeFileSync(path.join(dir, filename), buf);
    return filename;
  } catch {
    return null;
  } finally {
    try { if (browser) await browser.close(); } catch {}
  }
}

module.exports = { captureUrl };
