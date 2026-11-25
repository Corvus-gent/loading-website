import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
// API Anything owns every external website/API read. No browser, cookies from
// your personal browser, telemetry, learning or anti-bot fallback is enabled.
export async function makeReader(cfg,{fetchImpl=fetch,runtime=resolve('.runtime/api-anything')}={}) {
 process.env.API_ANYTHING_HOME=runtime;
 await mkdir(join(runtime,'sites'),{recursive:true,mode:0o700});
 const {call,parseSite}=await import('api-anything');
 const endpoint=(name,url,params=[],slots=[],extra={})=>({name,description:'Authorized leadhunter read',readOnly:true,minTier:1,request:{method:'GET',url,headers:{accept:'application/json'},...extra},params,slots,volatile:[],trigger:{url},match:{method:extra.method||'GET',host:new URL(url).hostname,path:new URL(url).pathname},response:{format:'json'}});
 const str=name=>({name,type:'string',required:true});
 const q=(param,at)=>({param,at:[at]});
 const redditBase=cfg.redditToken?'https://oauth.reddit.com':'https://www.reddit.com';
 const specs=[{name:'leadhunter-fx',baseUrl:'https://api.frankfurter.dev',operations:[endpoint('latest','https://api.frankfurter.dev/v1/latest?base=EUR&symbols=USD,GBP')]},
  {name:'leadhunter-reddit',baseUrl:redditBase,operations:[endpoint('new',`${redditBase}/r/{sub}/new.json?limit=100&raw_json=1&after={after}`,[str('sub'),str('after')],[q('sub','path:1'),q('after','query:after')])]},
  {name:'leadhunter-x',baseUrl:'https://api.x.com',operations:[endpoint('search','https://api.x.com/2/tweets/search/recent?query={query}&start_time={since}&max_results=100&tweet.fields=created_at,author_id,entities,referenced_tweets&expansions=author_id&user.fields=name,username,created_at,public_metrics&next_token={cursor}',[str('query'),str('since'),str('cursor')],[q('query','query:query'),q('since','query:start_time'),q('cursor','query:next_token')])]},
  {name:'leadhunter-places',baseUrl:'https://places.googleapis.com',operations:[endpoint('search','https://places.googleapis.com/v1/places:searchText',[str('query')],[{param:'query',at:['body','json:/textQuery']}],{method:'POST',headers:{'content-type':'application/json','X-Goog-FieldMask':'places.id,places.displayName,places.websiteUri,places.googleMapsUri,places.nationalPhoneNumber,places.businessStatus,places.formattedAddress,places.attributions'},body:JSON.stringify({textQuery:'{query}',pageSize:20,languageCode:'en'})})]},
 ];
 for(const spec of specs)await writeFile(join(runtime,'sites',spec.name+'.json'),JSON.stringify(parseSite(spec)),{mode:0o600});
 return async(source,op,args)=>call('leadhunter-'+source,op,args,{callOnly:true,maxTier:1,allowWrites:false,timeoutMs:15000,minIntervalMs:2000,fetchImpl:async(input,init={})=>{
  const url=new URL(typeof input==='string'?input:input.url||String(input)); const headers=new Headers(init.headers);
  if(!['www.reddit.com','oauth.reddit.com','api.x.com','places.googleapis.com','api.frankfurter.dev'].includes(url.hostname))throw new Error('Unexpected data host');
  if(url.protocol!=='https:')throw new Error('HTTPS required');
  if(url.hostname.endsWith('reddit.com')){headers.set('user-agent','leadhunter/1.0 (private lead dashboard; owner u/gabe_maxxing)');if(cfg.redditToken)headers.set('authorization',`Bearer ${cfg.redditToken}`);if(!url.searchParams.get('after'))url.searchParams.delete('after');}
  if(url.hostname==='api.x.com'){headers.set('authorization',`Bearer ${cfg.xToken}`);if(!url.searchParams.get('next_token'))url.searchParams.delete('next_token');}
  if(url.hostname==='places.googleapis.com')headers.set('X-Goog-Api-Key',cfg.placesKey);
  return fetchImpl(url,{...init,headers,redirect:'error'});
 }});
}
