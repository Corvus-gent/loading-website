// Owner tokens are used only on fixed first-party API origins, never on post URLs.
import {normalize} from '../normalize.js';
import {normalizedHandle} from '../../../../compound/impact/accounts.js';
export const envFor=(prefix,account)=>prefix+'_'+String(account||'').toUpperCase().replace(/[^A-Z0-9]/g,'_');
export const apiError=(message,status=0,retryAfter=0)=>Object.assign(Error(message),{status,retryAfter});
export async function json(fetcher,url,opts={},permission=''){
 const r=await fetcher(url,{...opts,signal:AbortSignal.timeout(8000)});
 if(!r.ok){const delay=r.headers?.get?.('retry-after');let body;try{body=await r.json()}catch{};const code=body?.error?.errors?.[0]?.reason||body?.error?.error_subcode||body?.error?.code;
 throw apiError('HTTP '+r.status+(code?' ('+String(code).slice(0,40)+')':'')+'. '+permission,r.status,delay?Number(delay)||Math.max(0,(Date.parse(delay)-Date.now())/1000):0);}
 return await r.json();
}
const auth=t=>({Authorization:'Bearer '+t});
const pending=error=>({mode:'not_configured',updates:[],error,note:error});
export async function instagram(rows,{account,fetcher=fetch,token=process.env[envFor('IG_ACCESS_TOKEN',account)],userId=process.env[envFor('IG_USER_ID',account)]}={}){
 const permission='Professional Instagram account linked to a Facebook Page; Facebook Login token with instagram_basic, instagram_manage_insights and pages_read_engagement.';
 if(!token||!/^\d+$/.test(userId||''))return pending(envFor('IG_ACCESS_TOKEN',account)+' and '+envFor('IG_USER_ID',account)+' required. '+permission);
 const base='https://graph.facebook.com/v24.0/',get=(path,params)=>json(fetcher,base+path+'?'+new URLSearchParams(params),{headers:auth(token)},permission);
 const owner=await get(userId,{fields:'id,username'});if(normalizedHandle(owner.username)!==normalizedHandle(account))throw Error('Instagram token/account mismatch for @'+account);
 const wanted=new Map(rows.map(r=>[new URL(r.post_url).pathname.split('/')[2],r]));const updates=[];let after,warning;
 for(let page=0;page<8&&wanted.size;page++){
 const data=await get(userId+'/media',{fields:'id,permalink,media_type,like_count,comments_count,timestamp',limit:'100',...(after?{after}:{})});
 if(!Array.isArray(data.data))throw Error('Invalid Instagram media response.');
 for(const media of data.data){const match=/^https:\/\/(?:www\.)?instagram\.com\/(?:reel|p|tv)\/([\w-]+)/.exec(media.permalink||'');const row=match&&wanted.get(match[1]);if(!row||media.media_type!=='VIDEO'||!/^\d+$/.test(media.id))continue;wanted.delete(match[1]);
 let ins;if(!warning)try{ins=await get(media.id+'/insights',{metric:'views,shares,saved'});}catch(e){if(e.status===429)throw e;warning=e.message;}
 const patch=normalize('ig',{...media,insights:ins?.data});if(Object.keys(patch).length)updates.push({row,patch});}
 after=data.paging?.next&&data.paging?.cursors?.after;if(!after)break;}
 return{mode:'instagram-insights',updates,error:warning||null,note:warning||updates.length+' original media IDs matched to registered posts; unavailable insights are retained.'};
}
export async function tiktok(rows,{account,fetcher=fetch,token=process.env[envFor('TIKTOK_ACCESS_TOKEN',account)]}={}){
 const permission='Owner OAuth access token with video.list for @'+account;if(!token)return pending(envFor('TIKTOK_ACCESS_TOKEN',account)+' required: '+permission);
 const fields='id,share_url,create_time,title,cover_image_url,duration,view_count,like_count,comment_count,share_count';
 const get=async(path,body)=>{const d=await json(fetcher,'https://open.tiktokapis.com/v2/video/'+path+'/?fields='+fields,{method:'POST',headers:{...auth(token),'Content-Type':'application/json'},body:JSON.stringify(body)},permission);if(d.error?.code&&d.error.code!=='ok')throw apiError('TikTok '+d.error.code+'. '+permission,d.error.code==='rate_limit_exceeded'?429:0);return d.data?.videos||[];};
 const known=new Map(rows.map(r=>[new URL(r.post_url).pathname.split('/').filter(Boolean).at(-1),r])),updates=[],posts=[];
 for(let i=0;i<known.size;i+=20)for(const v of await get('query',{filters:{video_ids:[...known.keys()].slice(i,i+20)}})){const row=known.get(v.id);if(row)updates.push({row,patch:normalize('tt',v)});}
 if(!rows.length)for(const v of await get('list',{max_count:20})){let u;try{u=new URL(v.share_url)}catch{continue}const m=/^\/@([^/]+)\/video\/(\d+)\/?$/.exec(u.pathname);if(u.hostname!=='www.tiktok.com'||!m||normalizedHandle(m[1])!==normalizedHandle(account)||m[2]!==v.id||!(v.duration>0))continue;
 posts.push({post_url:u.origin+u.pathname,account,label:v.title,posted_at:new Date(v.create_time*1000).toISOString(),media_type:'video',post_type:'original',original_by_gabe:true,native_video:true,thumbnail_url:v.cover_image_url,...normalize('tt',v)});}
 return{mode:'tiktok-display',updates,posts,note:'Owner video.list: views, likes, comments and shares. This API does not return saves.'};
}
export async function youtube(rows,{fetcher=fetch,key=process.env.YOUTUBE_DATA_API_KEY,owner=process.env.YOUTUBE_ANALYTICS_ACCESS_TOKEN}={}){
 if(!key&&!owner)return pending('YOUTUBE_DATA_API_KEY required for public counts; optional YOUTUBE_ANALYTICS_ACCESS_TOKEN (yt-analytics.readonly) for owner shares.');
 const updates=[],map=new Map(rows.map(r=>[new URL(r.post_url).searchParams.get('v'),r]));let warning;
 for(let start=0;start<map.size;start+=50){const ids=[...map.keys()].slice(start,start+50),url=new URL('https://www.googleapis.com/youtube/v3/videos');url.search=new URLSearchParams({part:'statistics',id:ids.join(',')});const headers=key?{'X-Goog-Api-Key':key}:auth(owner);const data=await json(fetcher,url,{headers},'Enable YouTube Data API v3 and authorize the API key.');
 for(const item of data.items||[]){const row=map.get(item.id);if(row)updates.push({row,patch:normalize('yt',item)});}
 if(owner){const q=new URLSearchParams({ids:'channel==MINE',dimensions:'video',metrics:'shares',filters:'video=='+ids.join(','),startDate:'2005-04-23',endDate:new Date().toISOString().slice(0,10)});try{const a=await json(fetcher,'https://youtubeanalytics.googleapis.com/v2/reports?'+q,{headers:auth(owner)},'YouTube channel-owner OAuth: yt-analytics.readonly (and youtube.readonly).');const cols=a.columnHeaders?.map(c=>c.name)||[];for(const values of a.rows||[]){const u=updates.find(u=>u.row===map.get(values[cols.indexOf('video')]));const n=values[cols.indexOf('shares')];if(u&&Number.isSafeInteger(n)&&n>=0)u.patch.shares=n;}}catch(e){if(e.status===429)throw e;warning=e.message;}}
 }return{mode:'youtube-api',updates,error:warning||null,note:warning||'YouTube Data API statistics; shares require owner Analytics. favoriteCount is deprecated and is never used as saves.'};
}
