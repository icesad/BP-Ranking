// 确定性头像（identicon）：同一 seed（用户 handle）永远生成同一个独特头像。
// 纯函数、无依赖，服务端/客户端/node 脚本都能用。返回 data:image/svg+xml 可直接放进 <img src>。
function hashSeed(str) {
  let h = 2166136261 >>> 0; // FNV-1a
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}

// 生成 5x5 对称像素图 + 渐变底色，整体辨识度高、配深色 UI 好看
function avatarDataUri(seed = '', size = 64) {
  const s = String(seed || 'anon');
  const h = hashSeed(s);
  const hue = h % 360;
  const hue2 = (hue + 40 + (h >> 8) % 60) % 360;
  const fg = `hsl(${hue} 70% 62%)`;
  const bgA = `hsl(${hue2} 38% 16%)`;
  const bgB = `hsl(${hue} 45% 22%)`;
  const grid = 5, cell = size / grid;
  let rects = '';
  // 用哈希位决定左半 + 中列的格子，再镜像 → 对称
  let bits = h ^ (hashSeed(s + '#') << 1);
  for (let col = 0; col < 3; col++) {
    for (let row = 0; row < grid; row++) {
      bits = (Math.imul(bits, 1103515245) + 12345) >>> 0;
      if ((bits >> 9) & 1) {
        const x1 = col * cell, y = row * cell;
        rects += `<rect x="${x1.toFixed(2)}" y="${y.toFixed(2)}" width="${cell.toFixed(2)}" height="${cell.toFixed(2)}"/>`;
        const mirror = grid - 1 - col;
        if (mirror !== col) { const x2 = mirror * cell; rects += `<rect x="${x2.toFixed(2)}" y="${y.toFixed(2)}" width="${cell.toFixed(2)}" height="${cell.toFixed(2)}"/>`; }
      }
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`
    + `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${bgA}"/><stop offset="1" stop-color="${bgB}"/></linearGradient></defs>`
    + `<rect width="${size}" height="${size}" rx="${(size * 0.18).toFixed(1)}" fill="url(#g)"/>`
    + `<g fill="${fg}">${rects}</g></svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

module.exports = { avatarDataUri, hashSeed };
