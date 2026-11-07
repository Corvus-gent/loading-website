import crypto from 'node:crypto';
import {redis,pipeline} from './_redis.js';
import {dailyIPHash,rateLimit} from './_privacy.js';
import {getSession} from './_session.js';
const LIFE=90*86400, events=['view','app_open','github_click','like','dislike','comment','feedback','share'];
const sources=['x','linkedin','instagram','tiktok','corvus','share','direct','other'];
const clean=(v,n)=>String(v||'').replace(/[\u0000-\u001f\u007f<>]/g,'').trim().slice(0,n);
const obj=a=>Object.fromEntries(Array.isArray(a)?Array.from({length:a.length/2},(_,i)=>[a[i*2],Number(a[i*2+1])]):Object.entries(a||{}).map(([k,v])=>[k,Number(v)]));
async function records(kind){const ids=await redis(['ZREVRANGE','hack:'+kind,'0','49'])||[];if(!ids.length)return[];const vals=await pipeline(ids.flatMap(id=>[['GET','hack:'+kind+':'+id],['GET','hack:hidden:'+id],['GET','hack:likes:'+id]]));return ids.flatMap((id,i)=>{try{const item=JSON.parse(vals[i*3]);return item&&!vals[i*3+1]?[{...item,id,likes:Number(vals[i*3+2]||0)}]:[];}catch{return[];}});}
export default async function handler(req,res){
 res.setHeader('Content-Type','application/json');
 try{
 if(req.method==='GET'){
  const privateView=req.query.private==='1';let authorized=false;
  if(privateView){authorized=(await getSession(req))?.email==='gabriel@corvus.gent';if(!authorized)return res.status(401).json({error:'Log in to see private feedback.'});}
  res.setHeader('Cache-Control',privateView?'private, no-store':'public, s-maxage=15, stale-while-revalidate=60');
  const [all,bySource,comments,feedback]=await Promise.all([redis(['HGETALL','hack:totals']),redis(['HGETALL','hack:sources']),records('comments'),authorized?records('feedback'):[]]);
  return res.status(200).json({totals:obj(all),sources:obj(bySource),comments,feedback,private:authorized});
 }
 if(req.method!=='POST')return res.status(405).json({error:'Method not allowed.'});
 res.setHeader('Cache-Control','no-store');
 const origin=req.headers.origin,allowed=new Set(['https://corvus.gent','https://stats.corvus.gent',...['VERCEL_URL','VERCEL_BRANCH_URL'].map(k=>process.env[k]&&'https://'+process.env[k])]);
 if(process.env.NODE_ENV!=='production')allowed.add('http://127.0.0.1:4196');
 if(!allowed.has(origin)||!String(req.headers['content-type']).startsWith('application/json'))return res.status(403).json({error:'Please use the form on this site.'});
 const body=typeof req.body==='string'?JSON.parse(req.body):req.body||{};
 if(JSON.stringify(body).length>5000)return res.status(413).json({error:'That message is too long.'});
 const action=body.action,hash=dailyIPHash(req,'hack');
 if(!events.includes(action)&&action!=='comment_like')return res.status(400).json({error:'Unknown action.'});
 if(!await rateLimit('hack:rate:'+hash,60,60))return res.status(429).json({error:'Take a breath. Try again in a minute.'});
 if(body.website)return res.status(400).json({error:'Please leave the hidden field empty.'});
 const source=sources.includes(body.source)?body.source:'other';
 if(['comment','feedback'].includes(action)){
  const text=clean(body.text,1000),name=clean(body.name,40)||'anonymous',email=clean(body.email,254);
  if(!text||body.started> Date.now()-3000||!Number.isFinite(body.started))return res.status(400).json({error:'Write a message and wait a moment before sending.'});
  if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return res.status(400).json({error:'Check the optional email address.'});
  if(!await rateLimit('hack:post:'+hash,1,60))return res.status(429).json({error:'One message per minute. Try again shortly.'});
  const id=crypto.randomUUID(),kind=action==='comment'?'comments':'feedback',record={name,text,at:new Date().toISOString(),...(action==='feedback'&&email?{email}:{})};
  await pipeline([['SET','hack:'+kind+':'+id,JSON.stringify(record),'EX',LIFE],['ZADD','hack:'+kind,Date.now(),id],['ZREMRANGEBYSCORE','hack:'+kind,'-inf',Date.now()-LIFE*1000],['EXPIRE','hack:'+kind,LIFE]]);
 }
 if(action==='comment_like'){
  const id=String(body.id||'');if(!/^[a-f0-9-]{36}$/.test(id)||!await redis(['EXISTS','hack:comments:'+id]))return res.status(404).json({error:'Comment unavailable.'});
  if(await redis(['SET','hack:vote:'+hash+':'+id,'1','EX',86400,'NX']))await pipeline([['INCR','hack:likes:'+id],['EXPIRE','hack:likes:'+id,LIFE]]);
  return res.status(200).json({ok:true});
 }
 if(['like','dislike'].includes(action)&&!await redis(['SET','hack:vote:'+hash,'1','EX',86400,'NX']))return res.status(200).json({ok:true,already:true});
 await pipeline([['HINCRBY','hack:totals',action,1],['HINCRBY','hack:sources',source+':'+action,1]]);
 return res.status(200).json({ok:true});
 }catch{return res.status(503).json({error:'The crow lost its connection. Try again shortly.'});}
}
