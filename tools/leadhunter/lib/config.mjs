export const SUBREDDITS = ['forhire','slavelabour','smallbusiness','Entrepreneur','webdev','startups'];
export const CATEGORIES = ['restaurants','salons','gyms','cafés','plumbers','electricians'];
export const X_QUERY = '("need a website" OR "looking for a web developer" OR "who can build me a website") -is:retweet';
export function httpsLink(value) { try { const u=new URL(value); return u.protocol==='https:'&&!u.username&&!u.password?u.href:''; } catch { return ''; } }
export function config(env=process.env) { return {
 cal: httpsLink(env.CAL_LINK), revolut:httpsLink(env.REVOLUT_LINK),
 cities:(env.CITIES||'Ghent,Brussels,Antwerp,London').split(',').map(x=>x.trim()).filter(Boolean).slice(0,10),
 redditApproved:env.REDDIT_COMMERCIAL_APPROVED==='true', redditToken:env.REDDIT_ACCESS_TOKEN||'',
 xToken:env.X_BEARER_TOKEN||'', placesKey:env.GOOGLE_PLACES_API_KEY||'', placesApproved:env.PLACES_STORAGE_APPROVED==='true',
 ingestUrl:httpsLink(env.LEADS_INGEST_URL), ingestToken:env.LEADS_INGEST_TOKEN||'',
 }; }
