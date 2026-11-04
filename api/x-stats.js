import {waitUntil} from '@vercel/functions';
import {redis,connected} from './_redis.js';
import {hogql,posthogReady} from './_posthog.js';
import {getSession,safeEqual} from './_session.js';
import {ORIGINS} from './_privacy.js';
import {createXSync,XKEY} from './_x-sync.js';
export function xReady(){return !!(connected()&&posthogReady()&&process.env.NOTION_TOKEN&&process.env.NOTION_XLOG_DB&&process.env.CRON_SECRET);}
async function continuation(){
 // Never make a preview write to production; preview protection may prevent a
 // continuation, in which case the next page view resumes the durable job.
 if(process.env.VERCEL_ENV!=='production')return;
 await fetch('https://corvus.gent/api/x-stats?continue=1',{headers:{Authorization:`Bearer ${process.env.CRON_SECRET}`},signal:AbortSignal.timeout(10000),redirect:'error'});
}
export function createHandler({ready=xReady,service=createXSync({redis,hogql,enqueue:waitUntil,continueJob:continuation}),session=getSession,cronSecret=()=>process.env.CRON_SECRET}={}){
 return async function handler(req,res){
  res.setHeader('Cache-Control','private, no-store');res.setHeader('Vary','Cookie');
  if(!['GET','POST'].includes(req.method)){res.setHeader('Allow','GET, POST');return res.status(405).end();}
  const q=req.query||{},cron=q.cron==='1'||q.continue==='1',privateRequest=q.private==='1'||req.method==='POST';
  try{
   if(cron){const secret=cronSecret();if(!secret||!safeEqual(req.headers.authorization||'',`Bearer ${secret}`))return res.status(401).json({error:'unauthorized'});}
   else if(privateRequest){if(!await session(req))return res.status(401).json({error:'login required'});if(req.method==='POST'&&!ORIGINS.includes(req.headers.origin||''))return res.status(403).json({error:'forbidden'});}
   if(!ready())return res.status(200).json({ready:false});
   if(cron||req.method==='POST')return res.status(202).json({ready:true,...await service.kick({continuation:q.continue==='1'})});
   if(privateRequest){await service.kick();return res.status(200).json(await service.privatePage({date:String(q.date||''),voice:String(q.voice||''),region:String(q.region||''),page:Math.floor(Number(q.page)||1)}));}
   const cached=await service.get(q.catalog==='1'?XKEY.catalog:XKEY.cache);
   if(cached){const ttl=service.ttl?await service.ttl(q.catalog==='1'?XKEY.catalog:XKEY.cache):900;res.setHeader('Cache-Control',`public, max-age=0, s-maxage=${Math.max(1,Math.min(900,Number(ttl)||1))}`);res.setHeader('Vary','Accept-Encoding');return res.status(200).json(q.catalog==='1'?{ready:true,campaigns:cached}:cached);}
   const state=await service.kick();
   if(q.catalog==='1')return res.status(200).json({ready:true,campaigns:[],state:state.state});
   const stale=await service.get(XKEY.stale);
   return res.status(200).json(stale?{...stale,stale:true,state:state.state}:{ready:true,state:state.state});
  }catch{return res.status(503).json({ready:true,state:'unavailable'});}
 };
}
export default createHandler();
