import {redis} from '../_redis.js';
import {key,videos,applySyncedMetrics} from './store.js';
const PERIOD=900, ENDPOINT='https://connect.oriane.xyz/rest/contents/search?limit=100&projection=basic';
export const configured=()=>Boolean(process.env.ORIANE_API_KEY?.trim());
// Never fetch arbitrary URLs. Query Oriane with exact provider IDs only.
export function platformID(video){
 let u;try{u=new URL(video.post_url);}catch{return null;}
 const host=u.hostname.replace(/^www\./,'');
 if(video.platform==='tt'&&['tiktok.com','m.tiktok.com'].includes(host)){
  const id=/\/video\/(\d+)\/?$/.exec(u.pathname)?.[1];return id?{platform:'tiktok',platformId:id}:null;
 }
 if(video.platform==='ig'&&host==='instagram.com'){
  const shortcode=/^\/(?:p|reel|tv)\/([A-Za-z0-9_-]{5,20})\/?$/.exec(u.pathname)?.[1];if(!shortcode)return null;
  const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';let id=0n;for(const c of shortcode)id=id*64n+BigInt(alphabet.indexOf(c));
  return{platform:'instagram',platformId:String(id)};
 }
 return null;
}
export async function syncStatus(){
 if(!configured())return{enabled:false,mode:'manual',note:'Metrics are entered by Gabe.'};
 const raw=await redis(['GET',key('oriane:status')]);return{enabled:true,mode:'oriane',...(raw?JSON.parse(raw):{note:'Oriane checks eligible TikTok/Instagram posts when this page is visited, at most every 15 minutes. Other platforms use manual entry.'})};
}
export async function syncIfDue(){
 // Missing key is a silent no-op: no network, Redis, warnings or retry loop.
 if(!configured())return{skipped:true};
 if(!await redis(['SET',key('oriane:due'),'1','NX','EX',PERIOD]))return{skipped:true};
 const result={attempted_at:new Date().toISOString(),updated:0,matched:0,candidates:0,state:'ok'};
 try{
  const all=(await videos()).filter(v=>!v.is_example).map(v=>({video:v,id:platformID(v)})).filter(v=>v.id);result.candidates=all.length;
  const distinct=[...new Map(all.map(v=>[v.id.platform+':'+v.id.platformId,v.id])).values()];
  const deadline=AbortSignal.timeout(25000);
  for(let start=0;start<distinct.length;start+=100){
   const ids=distinct.slice(start,start+100),wanted=new Set(ids.map(v=>v.platform+':'+v.platformId));
   const response=await fetch(ENDPOINT,{method:'POST',headers:{Authorization:'Bearer '+process.env.ORIANE_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({operator:'and',filters:{platformId:{includes:ids}}}),signal:AbortSignal.any([deadline,AbortSignal.timeout(8000)])});
   if(!response.ok)throw Error('provider unavailable');
   const body=await response.json();if(!Array.isArray(body?.data?.results))throw Error('invalid response');
   for(const item of body.data.results){
    const id=item.platform+':'+item.platformId;if(!wanted.has(id))continue;
    const metrics={};for(const [ours,theirs]of Object.entries({views:'viewsCount',likes:'likesCount',comments:'commentsCount',shares:'sharesCount'})){const value=item[theirs];if(typeof value==='number'&&Number.isSafeInteger(value)&&value>=0&&value<=1e12)metrics[ours]=value;}
    if(!Object.keys(metrics).length)continue;
    for(const {video}of all.filter(v=>v.id.platform+':'+v.id.platformId===id)){
     result.matched++;if(await applySyncedMetrics(video,metrics))result.updated++;
    }
   }
  }
  result.state=result.matched<result.candidates?'partial':'ok';
  result.note=!result.candidates?'No published TikTok/Instagram post URLs yet. Add them in the table.':`Oriane updated ${result.updated} posts. ${result.candidates-result.matched} not indexed or unavailable; their previous values are kept. Other platforms use manual entry.`;
 }catch{
  result.state='error';result.note='Oriane could not complete this check. Previous numbers are kept; manual entry still works.';
 }
 result.completed_at=new Date().toISOString();result.next_check=new Date(Date.now()+PERIOD*1000).toISOString();
 await redis(['SET',key('oriane:status'),JSON.stringify(result),'EX',90*86400]);return result;
}
