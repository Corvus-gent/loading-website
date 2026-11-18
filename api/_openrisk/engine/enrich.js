const headers = { 'User-Agent': 'OpenRiskPrototype/1.0 (https://corvus.gent; research demo)', Accept: 'application/json' };

export function signal(value, source, status = 'scraped', confidence = 'high', fetchedAt = new Date().toISOString()) {
  return { value, source, status, confidence, fetchedAt };
}

async function json(url, deadline = 4200) {
  const response = await fetch(url, { headers, redirect: 'error', signal: AbortSignal.timeout(deadline) });
  if (!response.ok) throw new Error('Source unavailable');
  const raw = await response.text();
  if (raw.length > 3_500_000) throw new Error('Source too large');
  return JSON.parse(raw);
}

export async function hiring(board) {
  if (!/^[a-z0-9_-]{2,60}$/.test(board || '')) return null;
  const url = 'https://boards-api.greenhouse.io/v1/boards/' + board + '/jobs';
  const data = await json(url);
  if (!Array.isArray(data.jobs)) return null;
  return signal({ count: data.jobs.length, roles: data.jobs.slice(0, 6).map(job => String(job.title).slice(0, 120)) }, url);
}

export async function engineering(org) {
  if (!/^[a-z0-9-]{2,39}$/i.test(org || '')) return null;
  const url = 'https://api.github.com/orgs/' + org + '/repos?sort=pushed&direction=desc&per_page=5';
  const data = await json(url);
  if (!Array.isArray(data)) return null;
  const repo = data.find(repo => !repo.fork && repo.pushed_at);
  if (!repo) return null;
  return signal({ repo: repo.name, pushedAt: repo.pushed_at, stars: repo.stargazers_count }, 'https://github.com/' + org + '/' + repo.name);
}

export async function coverageNews(name) {
  const url = 'https://hn.algolia.com/api/v1/search?tags=story&hitsPerPage=8&query=' + encodeURIComponent(name);
  const data = await json(url);
  if (!Array.isArray(data.hits)) return null;
  const matches = data.hits.filter(hit => hit.title?.toLowerCase().includes(name.toLowerCase()))
    .slice(0, 4).map(hit => ({ title: hit.title, url: 'https://news.ycombinator.com/item?id=' + encodeURIComponent(hit.objectID), date: hit.created_at }));
  return signal(matches, url, 'scraped', 'medium');
}

export async function identify(name) {
  const url = 'https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json&language=en&type=item&limit=8&search=' + encodeURIComponent(name);
  const data = await json(url, 3000);
  const row = data.search?.find(row => row.label?.toLowerCase() === name.toLowerCase()
    && /company|startup|corporation|developer|software|enterprise|business/i.test(row.description || '')
    && /^Q[0-9]+$/.test(row.id));
  if (!row) return null;
  return signal({ name: row.label, description: row.description }, 'https://www.wikidata.org/wiki/' + row.id, 'scraped', 'medium');
}
