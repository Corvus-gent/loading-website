import {redis,connected} from './_redis.js';
import {dailyIPHash} from './_privacy.js';
import {getSession} from './_session.js';
import {validateSuggestion,SUGGESTION_LIFETIME} from '../js/dontpay-shared.js';
const prefix=process.env.VERCEL_ENV==='preview'?'dontpay:preview:v1:':'dontpay:v1:';
const SAVE=`if redis.call('EXISTS',KEYS[1])==1 then return 2 end
local n=redis.call('INCR',KEYS[3]); if n==1 then redis.call('EXPIRE',KEYS[3],3600) end
if n>5 then return 0 end
local global=redis.call('INCR',KEYS[4]); if global==1 then redis.call('EXPIRE',KEYS[4],3600) end
if global>100 then return 0 end
redis.call('SET',KEYS[1],ARGV[1],'EX',ARGV[2]);redis.call('ZADD',KEYS[2],ARGV[3],ARGV[4]);
redis.call('ZREMRANGEBYSCORE',KEYS[2],'-inf',ARGV[5]);redis.call('EXPIRE',KEYS[2],ARGV[2]);return 1`;
export function createDontpayHandler({command=redis,ready=connected,session=getSession,hash=dailyIPHash,namespace=prefix,now=()=>Date.now()}={}){
 return async(req,res)=>{
  res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Content-Type-Options','nosniff');
  if(!['GET','POST'].includes(req.method)){res.setHeader('Allow','GET, POST');return res.status(405).json({error:'Method not allowed.'});}
  try{
   if(req.method==='GET'){
    if(req.query?.private!=='1')return res.status(200).json({ready:ready()});
    if((await session(req))?.email!=='gabriel@corvus.gent')return res.status(401).json({error:'Log in as the owner to read suggestions.'});
    if(!ready())return res.status(503).json({error:'Suggestions are temporarily unavailable.'});
    await command(['ZREMRANGEBYSCORE',namespace+'index','-inf',now()-SUGGESTION_LIFETIME*1000]);
    const ids=await command(['ZREVRANGE',namespace+'index','0','99'])||[];
    const records=await Promise.all(ids.map(id=>command(['GET',namespace+'entry:'+id])));
    return res.status(200).json({suggestions:records.filter(Boolean).map(JSON.parse)});
   }
   const allowed=new Set(['https://corvus.gent','https://www.corvus.gent',...['VERCEL_URL','VERCEL_BRANCH_URL','VERCEL_PROJECT_PRODUCTION_URL'].map(k=>process.env[k]&&'https://'+process.env[k])]);
   if(process.env.NODE_ENV!=='production')allowed.add('http://127.0.0.1:8792');
   if(!allowed.has(req.headers?.origin)||!/^application\/json(?:;|$)/i.test(req.headers?.['content-type']||''))return res.status(403).json({error:'Use the suggestion form on this site.'});
   let body=req.body;
   if(typeof body==='string'){if(Buffer.byteLength(body)>4096)return res.status(413).json({error:'That suggestion is too long.'});try{body=JSON.parse(body);}catch{return res.status(400).json({error:'Invalid form data.'});}}
   if(Buffer.byteLength(JSON.stringify(body??null))>4096)return res.status(413).json({error:'That suggestion is too long.'});
   let value;try{value=validateSuggestion(body);}catch(e){return res.status(400).json({error:e.message});}
   if(!ready())return res.status(503).json({error:'Not sent. You can save it on this device and retry later.'});
   const time=now(),record={...value,at:new Date(time).toISOString()},key=hash(req,'dontpay');
   const result=Number(await command(['EVAL',SAVE,4,namespace+'entry:'+value.id,namespace+'index',namespace+'rate:'+key,namespace+'rate:all',JSON.stringify(record),SUGGESTION_LIFETIME,time,value.id,time-SUGGESTION_LIFETIME*1000]));
   if(!result){res.setHeader('Retry-After','3600');return res.status(429).json({error:'The suggestion limit is reached. Save it here and try again in an hour.'});}
   return res.status(result===2?200:201).json({ok:true,id:value.id,already:result===2});
  }catch{return res.status(503).json({error:'Not sent. You can save it on this device and retry later.'});}
 };
}
export default createDontpayHandler();
