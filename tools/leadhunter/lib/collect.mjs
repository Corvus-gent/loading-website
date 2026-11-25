import {SUBREDDITS,CATEGORIES,X_QUERY} from './config.mjs';
import {normalize,dedupe} from './leads.mjs';
const note=(source,state,detail,found=0)=>({source,state,detail,found,checked_at:new Date().toISOString()});
const failure=r=>`${r.class||'error'}: ${String(r.reason||'Source could not be read').slice(0,350)}`;
export async function collect(cfg,read,now=Date.now()) {
 const rows=[],statuses=[]; let total=0,fx=null;
 const rates=await read('fx','latest',{});if(rates.ok&&rates.data?.rates){fx={date:rates.data.date,eur_per_unit:{EUR:1,...Object.fromEntries(Object.entries(rates.data.rates).filter(([,n])=>Number(n)>0).map(([c,n])=>[c,1/Number(n)]))}};}else statuses.push(note('fx','error',failure(rates))); 
 if(!cfg.redditApproved)statuses.push(note('reddit','setup','Commercial Reddit API approval required. Set REDDIT_COMMERCIAL_APPROVED=true only after approval.'));
 else {
  for(const sub of SUBREDDITS){let after='',found=0,error='',pages=0,truncated=false;
   for(;pages<3;pages++){
    const r=await read('reddit','new',{sub,after});
    if(!r.ok){error=failure(r);break;}
    const listing=r.data?.data;if(!Array.isArray(listing?.children)){error='drift: expected Reddit JSON listing';break;}
    const posts=listing.children.map(x=>x.data).filter(Boolean);found+=posts.length;
    for(const p of posts){if(p.removed_by_category||p.selftext==='[removed]'||p.selftext==='[deleted]')continue;rows.push(normalize({source:'reddit',title:p.title,text:p.selftext,handle:p.author,name:p.author,url:`https://www.reddit.com${p.permalink}`,posted_at:new Date(Number(p.created_utc)*1000).toISOString()},cfg,now));}
    after=listing.after||'';
    if(!after||posts.some(p=>now-Number(p.created_utc)*1000>=86400000))break;
    truncated=pages===2;
   }
   statuses.push(note('reddit',error?'error':truncated?'partial':'ok',`r/${sub}: ${error||`${found} posts checked${truncated?'; pagination cap reached':''}`}`,found));total+=found;
   if(error&&/rate|blocked|auth/i.test(error))break;
  }
 }
 if(!cfg.xToken)statuses.push(note('x','setup','Add X_BEARER_TOKEN with recent-search access. API Anything has no bundled X search operation; this adapter uses the official read API.'));
 else {let cursor='',found=0,error='',more=false;
  for(let page=0;page<3;page++){
   const r=await read('x','search',{query:X_QUERY,since:new Date(now-86400000).toISOString(),cursor});
   if(!r.ok){error=failure(r);break;}
   if(r.data?.errors?.length&&!r.data?.data){error='X search returned errors; check plan/access';break;}
   const posts=r.data?.data||[];if(!Array.isArray(posts)){error='drift: expected X JSON';break;}
   const users=new Map((r.data?.includes?.users||[]).map(x=>[x.id,x]));found+=posts.length;
   for(const p of posts){if(p.referenced_tweets?.some(x=>x.type==='retweeted'))continue;const u=users.get(p.author_id)||{};rows.push(normalize({source:'x',text:p.text,handle:u.username,name:u.name||u.username,author_id:p.author_id,evidence:{account_created_at:u.created_at,followers:u.public_metrics?.followers_count},url:`https://x.com/${u.username||'i'}/status/${p.id}`,posted_at:p.created_at},cfg,now));}
   cursor=r.data?.meta?.next_token||'';more=Boolean(cursor);if(!cursor)break;
  }
  statuses.push(note('x',error?'error':more?'partial':'ok',error||`${found} posts checked${more?'; pagination cap reached':''}`,found));total+=found;
 }
 if(!cfg.placesKey||!cfg.placesApproved)statuses.push(note('places','setup','Requires GOOGLE_PLACES_API_KEY and an agreement allowing persisted Places lead data (PLACES_STORAGE_APPROVED=true). Google Maps scraping is disabled.'));
 else {let found=0,error='';const bucket=Math.floor(now/900000),queries=cfg.cities.flatMap(city=>CATEGORIES.map(category=>({city,category})));
  // Two queries per run rotate across all cities/categories, limiting paid API calls.
  for(let i=0;i<Math.min(2,queries.length);i++){
   const {city,category}=queries[(bucket*2+i)%queries.length];const r=await read('places','search',{query:`${category} in ${city}`});
   if(!r.ok){error=failure(r);break;}
   if(!Array.isArray(r.data?.places)){error='drift: expected Places JSON';break;}
   found+=r.data.places.length;
   for(const p of r.data.places){if(p.businessStatus&&p.businessStatus!=='OPERATIONAL')continue;const row=normalize({source:'places',place_id:p.id,name:p.displayName?.text,text:`${category} · ${p.formattedAddress||city}`,city,url:p.googleMapsUri||`https://www.google.com/maps/search/?api=1&query=Google&query_place_id=${encodeURIComponent(p.id)}`,website:p.websiteUri,website_checked:true},cfg,now);if(row){row.attributions=p.attributions||[];rows.push(row);}}
  }
  statuses.push(note('places',error?'error':'ok',error||`${found} businesses checked; two city/category queries per run`,found));total+=found;
 }
 return {schema_version:1,fx,generated_at:new Date(now).toISOString(),scanned:total,config:{cal:cfg.cal,revolut:cfg.revolut,cities:cfg.cities},statuses,leads:dedupe(rows,now)};
}
