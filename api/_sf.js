import crypto from 'node:crypto';
import {redis as defaultRedis,connected} from './_redis.js';
import {getSession} from './_session.js';
import {dailyIPHash,ORIGINS} from './_privacy.js';
import {readVoter,ensureVoter} from './_voter.js';
import {zeroBits} from './_music-security.js';
import {sfStore,validateLead} from './_sf-store.js';
import {SF_END} from '../js/sf-trip.js';
import {hogql,posthogReady,REAL} from './_posthog.js';
export const SF_EVENTS=['sf_note_seen','sf_note_open','sf_note_click','sf_form_start','sf_form_submit'];
export const SF_FUNNEL_SQL=`SELECT event,count() FROM events WHERE ${REAL} AND timestamp >= toDateTime('2026-11-04 00:00:00') AND (event IN ('sf_note_seen','sf_note_open','sf_form_start','sf_form_submit') OR (event='$pageview' AND properties.$pathname='/sf/')) GROUP BY event`;
export function createSFHandler({redis=defaultRedis,ready=connected,session=getSession,now=Date.now,store=sfStore({redis,now}),query=hogql,analyticsReady=posthogReady,bits=16}={}){
 return async function handler(req,res){
  res.setHeader('Cache-Control','private, no-store');res.setHeader('Vary','Cookie');
  if(!['GET','POST','PATCH'].includes(req.method))return res.status(405).json({error:'method_not_allowed'});
  if(!ready())return res.status(503).json({error:'unavailable'});
  const q=req.query||{},body=req.body||{},privateRequest=q.private==='1'||req.method==='PATCH';
  try{
   if(privateRequest){
    const user=await session(req);if(user?.email?.toLowerCase()!=='gabriel@corvus.gent')return res.status(403).json({error:'forbidden'});
    if(req.method==='GET'){
     let funnel=null;try{if(analyticsReady())funnel=Object.fromEntries(await query(SF_FUNNEL_SQL));}catch{}
     return res.status(200).json({...await store.list(q.page),funnel});
    }
    if(req.method!=='PATCH'||!ORIGINS.includes(req.headers.origin||''))return res.status(403).json({error:'forbidden'});
    if(!/^[a-f0-9-]{36}$/.test(body.id||''))return res.status(400).json({error:'invalid_fields'});
    if(body.action==='retry-mail')return res.status(200).json({ok:await store.notify(body.id)});
    if(typeof body.done!=='boolean')return res.status(400).json({error:'invalid_fields'});
    const ok=await store.mark(body.id,body.done);return res.status(ok?200:404).json({ok});
   }
   if(now()>=SF_END)return res.status(410).json({error:'trip_over'});
   // Only a same-origin form request can mint a challenge/cookie; ordinary page
   // visits never receive a new identifier from this feature.
   if(!ORIGINS.includes(req.headers.origin||''))return res.status(403).json({error:'forbidden'});
   const ip=dailyIPHash(req,'sf',new Date(now()));
   if(req.method==='GET'||body.action==='challenge'){
    if(req.method!=='POST'||body.action!=='challenge')return res.status(400).json({error:'invalid_fields'});
    const n=Number(await redis(['EVAL',"local n=redis.call('INCR',KEYS[1]);if redis.call('TTL',KEYS[1])<0 then redis.call('EXPIRE',KEYS[1],600) end;return n",'1',`sf:challenge-rate:${ip}`]));
    if(n>30)return res.status(429).json({error:'rate_limited',retryAfter:600});
    const voter=ensureVoter(req,res),id=crypto.randomBytes(18).toString('base64url'),salt=crypto.randomBytes(24).toString('hex'),notBefore=now()+3000;
    await redis(['SET',`sf:challenge:${id}`,JSON.stringify({voter,salt,bits,notBefore}),'EX','300']);
    const retryAfter=Math.max(0,Number(await redis(['TTL',`sf:cool:v:${voter}`])),Number(await redis(['TTL',`sf:cool:ip:${ip}`])));
    return res.status(200).json({challenge:{id,salt,bits,notBefore},retryAfter});
   }
   if(body.website||JSON.stringify(body).length>6000)return res.status(400).json({error:'invalid_fields'});
   const voter=readVoter(req);if(!voter)return res.status(403).json({error:'verification'});
   let data;try{data=validateLead(body);}catch(e){return res.status(400).json({error:e.message});}
   if(!/^[a-f0-9-]{36}$/.test(body.requestId||'')||!/^[A-Za-z0-9_-]{24}$/.test(body.challenge||'')||!Number.isSafeInteger(body.nonce)||body.nonce<0)return res.status(400).json({error:'verification'});
   const raw=await redis(['GETDEL',`sf:challenge:${body.challenge}`]);if(!raw)return res.status(403).json({error:'verification'});
   const ch=JSON.parse(raw);
   if(ch.voter!==voter||now()<ch.notBefore||zeroBits(crypto.createHash('sha256').update(`${ch.salt}:${body.nonce}`).digest())<ch.bits)return res.status(403).json({error:'verification'});
   const [code,value]=await store.save(data,{voter,ip,requestId:body.requestId});
   if(Number(code)===429){res.setHeader('Retry-After',String(value));return res.status(429).json({error:'rate_limited',retryAfter:Number(value)});}
   if(Number(code)===503)return res.status(503).json({error:'unavailable'});
   await store.notify(value);
   return res.status(201).json({ok:true,retryAfter:60});
  }catch{return res.status(503).json({error:'unavailable'});}
 };
}
export default createSFHandler();
