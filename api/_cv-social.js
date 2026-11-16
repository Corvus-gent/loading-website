import {redis,connected} from './_redis.js';
import {hogql,posthogReady} from './_posthog.js';
const PREFIX='cv:social:v1';
export const names={'ibjjf.com':'IBJJF','chipotle.com':'Chipotle','instagram.com':'Instagram','tiktok.com':'TikTok','youtube.com':'YouTube','x.com':'X','linkedin.com':'LinkedIn','github.com':'GitHub','pidgy-ai.com':'Pidgy','alkmist.com':'Alkmist','compound.mov':'Compound','arcade.software':'Arcade','corgicafe.com':'Corgi Cafe','united.com':'United','starlink.com':'Starlink','producthunt.com':'Product Hunt','mail.google.com':'Gmail'};
export function domain(raw){try{const u=new URL(raw,'https://corvus.gent');if(!['https:','http:'].includes(u.protocol))return null;let h=u.hostname.replace(/^www\./,'');if(h==='corvus.gent'){return u.pathname.replace(/\/$/,'')==='/go/compound-impact'?'compound.mov':null;}return Object.hasOwn(names,h)?h:null;}catch{return null;}}
const record=`
if redis.call('SET',KEYS[1],1,'NX','EX',86400)==false then return 0 end
if ARGV[1]=='visit' then redis.call('INCR',KEYS[2]) else redis.call('ZINCRBY',KEYS[3],1,ARGV[2]);redis.call('INCR',KEYS[4]) end
return 1`;
export function createHandler({store=redis,ready=connected,query=hogql,historyReady=posthogReady,now=Date.now,prefix=PREFIX}={}){return async(req,res)=>{
 res.setHeader('Cache-Control','no-store');
 if(!['GET','POST'].includes(req.method))return res.status(405).json({error:'method'});
 if(!ready())return res.status(503).json({error:'Stats unavailable'});
 try{
  // Snapshot pre-publication pageviews once; new visits use only our Redis counter.
  let since=await store(['GET',prefix+':since']);
  if(!since){await store(['SET',prefix+':since',new Date(now()).toISOString(),'NX']);since=await store(['GET',prefix+':since']);}
  if(req.method==='POST'){
   if(!['https://corvus.gent','https://www.corvus.gent'].includes(req.headers.origin))return res.status(403).json({error:'origin'});
   let b=req.body;if(typeof b==='string'){try{b=JSON.parse(b);}catch{b=null;}}
   if(!b||!['visit','click'].includes(b.action)||!/^[-a-zA-Z0-9]{16,80}$/.test(b.id||''))return res.status(400).json({error:'invalid event'});
   const host=b.action==='click'?domain(b.href):'';if(b.action==='click'&&!host)return res.status(400).json({error:'invalid destination'});
   await store(['EVAL',record,4,prefix+':event:'+b.id,prefix+':visits',prefix+':domains',prefix+':clicks',b.action,host]);
  }
  let historical=await store(['GET',prefix+':historical']);
  if(historical===null&&historyReady()){
   const rows=await query(`SELECT count() FROM events WHERE event='$pageview' AND properties.$host IN ('corvus.gent','www.corvus.gent') AND (properties.$pathname IN ('/cv/social-media','/cv/social-media/','/cv/social-media/index.html')) AND timestamp < toDateTime('${since.slice(0,19).replace('T',' ')}')`);
   await store(['SET',prefix+':historical',String(Number(rows[0]?.[0]||0)),'NX']);historical=await store(['GET',prefix+':historical']);
  }
  const values=await store(['MGET',prefix+':visits',prefix+':clicks']);
  const ranked=await store(['ZREVRANGE',prefix+':domains',0,4,'WITHSCORES']);
  const top=[];for(let i=0;i<ranked.length;i+=2)top.push({domain:ranked[i],name:names[ranked[i]]||ranked[i],clicks:Number(ranked[i+1])});
  return res.status(200).json({visits:Number(values[0]||0)+Number(historical||0),clicks:Number(values[1]||0),since,top});
 }catch{return res.status(503).json({error:'Stats unavailable'});}
};}
export default createHandler();
