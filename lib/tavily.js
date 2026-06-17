// Tavily 联网搜索（为 LLM 优化，返回清洗后的摘要+链接）。无 key 或失败返回 []。
async function tavilySearch(query, { max = 6 } = {}) {
  const key = process.env.TAVILY_API_KEY;
  if (!key || !query) return [];
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: key,
        query,
        search_depth: 'advanced',
        max_results: max,
        include_answer: false,
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results || []).slice(0, max).map((r) => ({
      title: String(r.title || '').slice(0, 160),
      snippet: String(r.content || '').slice(0, 500),
      url: String(r.url || ''),
    }));
  } catch {
    return [];
  }
}

module.exports = { tavilySearch };
