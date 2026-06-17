// 上传内容审核（基础版）。这里只是关键词兜底，示例性、可扩展；
// 生产环境建议接入专业内容审核 API（如阿里云/腾讯云内容安全），并把政策敏感词按合规要求维护在配置里。
const BLOCKED = [
  // 明显违法/违规类（示例，可按需增删）
  '赌博', '博彩', '六合彩', '代开发票', '办理证件', '办假证',
  '枪支', '弹药', '毒品', '冰毒', '制毒', '迷药',
  '色情', '裸聊', '招嫖',
  '洗钱', '传销', '资金盘',
];

// 运营方按本地合规要求自行补充的敏感词（默认空，避免在代码里固化地区性词表）
const CUSTOM = [];

function moderate(text) {
  const t = (text || '').toLowerCase();
  for (const w of [...BLOCKED, ...CUSTOM]) {
    if (w && t.includes(w.toLowerCase())) {
      return { ok: false, word: w, reason: `内容包含疑似违规信息（“${w}”），已被拦截。如为误判，请调整措辞后重试。` };
    }
  }
  return { ok: true };
}

module.exports = { moderate };
