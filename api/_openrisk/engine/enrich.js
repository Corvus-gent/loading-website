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

const boardProviders = {
  greenhouse: {
    api:slug=>'https://boards-api.greenhouse.io/v1/boards/'+slug+'/jobs',
    source:slug=>'https://job-boards.greenhouse.io/'+slug,
    postings:doc=>doc.jobs,
    title:job=>job.title,
    department:job=>job.departments?.[0]?.name,
  },
  lever: {
    api:slug=>'https://api.lever.co/v0/postings/'+slug+'?mode=json',
    source:slug=>'https://jobs.lever.co/'+slug,
    postings:doc=>doc,
    title:job=>job.text,
    department:job=>job.categories?.team,
  },
  ashby: {
    api:slug=>'https://api.ashbyhq.com/posting-api/job-board/'+slug,
    source:slug=>'https://jobs.ashbyhq.com/'+slug,
    postings:doc=>doc.jobs?.filter(job=>job.isListed!==false),
    title:job=>job.title,
    department:job=>job.department,
  },
  recruitee: {
    api:slug=>'https://'+slug+'.recruitee.com/api/offers',
    source:slug=>'https://'+slug+'.recruitee.com/',
    postings:doc=>doc.offers,
    title:job=>job.title,
    department:job=>job.department,
  },
};

export async function hiring(board) {
  if (typeof board !== 'string' || !board) return null;
  const [provider,slug] = board.includes(':') ? board.split(':') : ['greenhouse',board];
  if (!Object.hasOwn(boardProviders,provider) || !/^[a-z0-9][a-z0-9_.-]{1,59}$/.test(slug)) return null;
  const config = boardProviders[provider];
  const data = await json(config.api(slug));
  const jobs = config.postings(data);
  if (!Array.isArray(jobs)) return null;
  const publicJobs = jobs.filter(job=>config.title(job) && !/talent (pool|community|network)|general (application|opportunity)/i.test(config.title(job)));
  const roles = publicJobs.slice(0,6).map(job=>String(config.title(job)).slice(0,120));
  const departments = Array.from(new Set(publicJobs.map(config.department).filter(value=>typeof value==='string' && value))).slice(0,8);
  return signal({ count:publicJobs.length, roles, departments, provider }, config.source(slug));
}

export async function engineering(org, deadline) {
  if (!/^[a-z0-9-]{2,39}$/i.test(org || '')) return null;
  const url = 'https://api.github.com/orgs/' + org + '/repos?sort=pushed&direction=desc&per_page=5';
  const data = await json(url,deadline);
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
    .sort((a,b)=>b.created_at_i-a.created_at_i).slice(0, 4).map(hit => ({ title: hit.title, url: 'https://news.ycombinator.com/item?id=' + encodeURIComponent(hit.objectID), date: hit.created_at }));
  return signal(matches, url, 'scraped', 'medium');
}

export async function identify(name) {
  const url = 'https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json&language=en&type=item&limit=8&search=' + encodeURIComponent(name);
  const data = await json(url, 3000);
  const row = data.search?.find(row => row.label?.toLowerCase() === name.toLowerCase()
    && /company|startup|corporation|developer|software|enterprise|business/i.test(row.description || '')
    && /^Q[0-9]+$/.test(row.id));
  if (!row) return null;
  const value = { name: row.label, description: row.description };
  try {
    const record = await json('https://www.wikidata.org/wiki/Special:EntityData/'+row.id+'.json',2300);
    const claims = record.entities?.[row.id]?.claims;
    const first = property=>claims?.[property]?.find(item=>item.rank!=='deprecated')?.mainsnak?.datavalue?.value;
    const website = first('P856');
    const github = first('P2037');
    const epoch = first('P571')?.time;
    if (typeof github==='string' && /^[a-z0-9-]{2,39}$/i.test(github)) value.github=github;
    if (typeof website==='string' && /^https:\/\//i.test(website)) value.website=website;
    if (typeof epoch==='string' && /^\+\d{4}-/.test(epoch)) value.founded=Number(epoch.slice(1,5));
  } catch {}
  return signal(value, 'https://www.wikidata.org/wiki/' + row.id, 'scraped', 'medium');
}
