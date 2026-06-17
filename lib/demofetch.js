// Demo 在线内容抓取：URL 页面 / GitHub README
// 抓取失败不报错，返回空内容由引擎按文本描述兜底评分

async function fetchWithTimeout(url, ms = 12000) {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(ms),
    headers: { 'User-Agent': 'Mozilla/5.0 BP-Ranking-Bot' },
    redirect: 'follow',
  });
  return res;
}

// 抓取在线Demo页面，返回 { content, loadMs }
async function fetchUrlDemo(url) {
  try {
    const t0 = Date.now();
    const res = await fetchWithTimeout(url);
    const loadMs = Date.now() - t0;
    if (!res.ok) return { content: '', loadMs: 0 };
    const html = (await res.text()).slice(0, 200000);
    return { content: html, loadMs };
  } catch {
    return { content: '', loadMs: 0 };
  }
}

// 抓取 GitHub 仓库 README。支持 github.com/owner/repo 链接
async function fetchGithubReadme(repoUrl) {
  try {
    const m = repoUrl.match(/github\.com\/([\w.-]+)\/([\w.-]+)/);
    if (!m) return '';
    const [, owner, repo] = m;
    for (const branch of ['HEAD', 'main', 'master']) {
      for (const name of ['README.md', 'readme.md', 'README.zh-CN.md']) {
        try {
          const res = await fetchWithTimeout(`https://raw.githubusercontent.com/${owner}/${repo.replace(/\.git$/, '')}/${branch}/${name}`, 8000);
          if (res.ok) return (await res.text()).slice(0, 50000);
        } catch {}
      }
    }
    return '';
  } catch {
    return '';
  }
}

// 抓取 GitHub 仓库的客观元数据（star/fork/活跃度/语言/topics/license）+ README。
// 这些是可验证、难造假的真实信号，喂给评估与估值能显著提升质量。
async function fetchGithubRepo(repoUrl) {
  const m = repoUrl.match(/github\.com\/([\w.-]+)\/([\w.-]+)/);
  if (!m) return { content: await fetchGithubReadme(repoUrl), meta: null };
  const owner = m[1];
  const repo = m[2].replace(/\.git$/, '');
  const headers = { 'User-Agent': 'BP-Ranking-Bot', Accept: 'application/vnd.github+json' };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  let meta = null;
  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers, signal: AbortSignal.timeout(10000) });
    if (res.ok) {
      const j = await res.json();
      meta = {
        full_name: j.full_name, description: j.description || '',
        stars: j.stargazers_count || 0, forks: j.forks_count || 0, watchers: j.subscribers_count || 0,
        issues: j.open_issues_count || 0, language: j.language || '', topics: j.topics || [],
        license: j.license?.spdx_id || '', pushed_at: (j.pushed_at || '').slice(0, 10),
        created_at: (j.created_at || '').slice(0, 10), homepage: j.homepage || '', archived: !!j.archived,
      };
    }
  } catch {}
  const readme = await fetchGithubReadme(repoUrl);
  let header = '';
  if (meta) {
    header = `【GitHub 仓库客观数据 / objective signals】\n仓库 Repo：${meta.full_name}\n描述 Description：${meta.description}\n⭐ Stars：${meta.stars} · Forks：${meta.forks} · Watchers：${meta.watchers} · Open issues：${meta.issues}\n主要语言 Language：${meta.language}　Topics：${(meta.topics || []).join(', ')}\nLicense：${meta.license}　创建 Created：${meta.created_at}　最近提交 Last push：${meta.pushed_at}${meta.archived ? '　（已归档/停更 archived）' : ''}${meta.homepage ? `\n主页 Homepage：${meta.homepage}` : ''}\n（star/fork/活跃度等为可验证的真实 traction 信号，应据此判断热度与维护状态）\n\n`;
  }
  return { content: header + readme, meta };
}

module.exports = { fetchUrlDemo, fetchGithubReadme, fetchGithubRepo };
