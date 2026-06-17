// 从 .pptx 提取文本（pptx 即 zip，幻灯片文本在 ppt/slides/slideN.xml 的 <a:t> 标签中）
const JSZip = require('jszip');

async function extractPptxText(buffer) {
  try {
    const zip = await JSZip.loadAsync(buffer);
    const slideFiles = Object.keys(zip.files)
      .filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f))
      .sort((a, b) => {
        const na = parseInt(a.match(/slide(\d+)/)[1], 10);
        const nb = parseInt(b.match(/slide(\d+)/)[1], 10);
        return na - nb;
      });
    const parts = [];
    for (const f of slideFiles) {
      const xml = await zip.files[f].async('string');
      const texts = [...xml.matchAll(/<a:t[^>]*>([^<]*)<\/a:t>/g)].map((m) => m[1]);
      if (texts.length) parts.push(texts.join(' '));
    }
    return parts.join('\n\n');
  } catch {
    return '';
  }
}

module.exports = { extractPptxText };
