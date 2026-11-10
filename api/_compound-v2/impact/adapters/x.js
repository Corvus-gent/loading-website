import {normalize} from '../normalize.js';
import {IMPACT_CONFIG} from '../../../../compound/impact/config.js';
export function classifyX(item,includes={}){
 const author=(includes.users||[]).find(u=>u.id===item.author_id),refs=item.referenced_tweets||[];
 const post_type=refs.some(r=>r.type==='retweeted')?'repost':refs.some(r=>r.type==='replied_to')||item.in_reply_to_user_id?'reply':refs.some(r=>r.type==='quoted')?'quote':'original';
 // Only media attached to THIS post; never media from its quoted/parent post.
 const keys=item.attachments?.media_keys||[],media=(includes.media||[]).filter(m=>keys.includes(m.media_key));
 const media_type=media.some(m=>m.type==='video')?'video':media.some(m=>m.type==='animated_gif')?'gif':media.some(m=>m.type==='photo')?'image':keys.length?'unknown':'text';
 const original_by_gabe=!!author&&IMPACT_CONFIG.xAccounts.includes(String(author.username||'').toLowerCase());
 return{post_type,media_type,original_by_gabe,native_video:media_type==='video',...(media.find(m=>m.type==='video')?.preview_image_url?{thumbnail_url:media.find(m=>m.type==='video').preview_image_url}:{})};
}
export default async function x(rows,{fetcher=fetch}={}){
 if(!process.env.X_BEARER_TOKEN)return{mode:'not_configured',updates:[],error:'X_BEARER_TOKEN missing: X API v2 post lookup with public_metrics is required.',note:'X key absent. Media is checked through the post embed; public video metrics use the scheduled fallback.'};const updates=[];
 for(let start=0;start<rows.length;start+=100){const batch=rows.slice(start,start+100),ids=new Map(batch.map(row=>[new URL(row.post_url).pathname.split('/').at(-1),row]));
 const url=new URL('https://api.x.com/2/tweets');url.searchParams.set('ids',[...ids.keys()].join(','));url.searchParams.set('tweet.fields','public_metrics,created_at,author_id,attachments,referenced_tweets,in_reply_to_user_id');url.searchParams.set('expansions','author_id,attachments.media_keys');url.searchParams.set('media.fields','type,preview_image_url');url.searchParams.set('user.fields','username');
 const response=await fetcher(url,{headers:{Authorization:'Bearer '+process.env.X_BEARER_TOKEN},signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error('X unavailable ('+response.status+'). Previous metrics kept.');const body=await response.json();if(!Array.isArray(body.data))throw Error('X returned no usable posts.');
 for(const item of body.data){const row=ids.get(item.id),m=item.public_metrics||{};if(!row)continue;const patch={...classifyX(item,body.includes),...normalize('x',m)};if(item.created_at&&Number.isFinite(Date.parse(item.created_at)))patch.posted_at=item.created_at;updates.push({row,patch});}
 }return{mode:'x-api',updates,note:'X views are post impressions; shares include reposts + quotes. Own attached video and original author are checked separately.'};
}
