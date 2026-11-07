import crypto from 'node:crypto';
import {redis,pipeline} from '../_redis.js';
import {dailyIPHash,rateLimit} from '../_privacy.js';
import {ensureVoter} from '../_voter.js';
const RETAIN=90*86400,COUNTERS=['views','github','app','likes','comments'];
const text=(v,max)=>String(v||'').replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,max);
const object=v=>Array.isArray(v)?Object.fromEntries(Array.from({length:v.length/2},(_,i)=>[v[2*i],v[2*i+1]])):v||{};
export default async function hack(req,res){
 res.setHeader('Cache-Control','no-store');
 try{
 if(req.method==='GET'){
  res.setHeader('Cache-Control','public, s-maxage=5, stale-while-revalidate=15');
  const [values,ids]=await Promise.all([redis(['MGET',...COUNTERS.map(k=>'hack:engage:'+k)]),redis(['ZREVRANGE','hack:engage:wall','0','49'])]);
  const raw=ids?.length?await pipeline(ids.map(id=>['HGETALL','hack:engage:comment:'+id])):[];
  const comments=raw.map((v,i)=>({...object(v),id:ids[i]})).filter(c=>c.text&&c.hidden!=='1').map(c=>({id:c.id,name:c.name,text:c.text,at:c.at,votes:Number(c.votes||0)}));
  return res.status(200).json({counts:Object.fromEntries(COUNTERS.map((k,i)=>[k,Number(values[i]||0)])),comments});
 }
 if(req.method!=='POST')return res.status(405).json({error:'method not allowed'});
 const origin=req.headers.origin,allowed=['https://corvus.gent','https://www.corvus.gent',...['VERCEL_URL','VERCEL_BRANCH_URL'].map(k=>process.env[k]&&'https://'+process.env[k])];
 if(process.env.NODE_ENV!=='production')allowed.push('http://127.0.0.1:4197');
 if(!allowed.includes(origin)||!String(req.headers['content-type']).startsWith('application/json'))return res.status(403).json({error:'please use the page'});
 const body=typeof req.body==='string'?JSON.parse(req.body):req.body||{};
 if(JSON.stringify(body).length>2048)return res.status(413).json({error:'message too long'});
 const ip=dailyIPHash(req,'hack-engage');if(!await rateLimit('hack:engage:rate:'+ip,90,60))return res.status(429).json({error:'slow down a little'});
 const action=body.action;
 if(['view','github','app'].includes(action)){await redis(['INCR','hack:engage:'+(action==='view'?'views':action)]);return res.status(200).json({ok:true});}
 if(action==='comment'){
  if(body.website)return res.status(400).json({error:'leave the hidden field empty'});
  if(typeof body.text!=='string'||!body.text.trim()||body.text.length>280)return res.status(400).json({error:'write 1–280 characters'});
  if(!await rateLimit('hack:engage:post:'+ip,3,60))return res.status(429).json({error:'three comments per minute. try again shortly.'});
  const id=crypto.randomUUID(),key='hack:engage:comment:'+id;
  await pipeline([['HSET',key,'name',text(body.name,40)||'anon','text',text(body.text,280),'at',new Date().toISOString(),'votes','0','hidden','0'],['EXPIRE',key,RETAIN],['ZADD','hack:engage:wall',Date.now(),id],['ZREMRANGEBYSCORE','hack:engage:wall','-inf',Date.now()-RETAIN*1000],['EXPIRE','hack:engage:wall',RETAIN],['INCR','hack:engage:comments']]);
  return res.status(200).json({ok:true,id});
 }
 if(action==='like'||action==='upvote'){
  const id=String(body.id||'');if(action==='upvote'&&!/^[a-f0-9-]{36}$/.test(id))return res.status(400).json({error:'invalid comment'});
  const voter=ensureVoter(req,res),voteKey='hack:engage:voted:'+voter+':'+(action==='like'?'project':id);
  const script=action==='like'?"if redis.call('SET',KEYS[1],'1','NX','EX',ARGV[1]) then redis.call('INCR',KEYS[2]);return 1 end;return 0":"if redis.call('EXISTS',KEYS[2])==0 or redis.call('HGET',KEYS[2],'hidden')=='1' then return -1 end;if redis.call('SET',KEYS[1],'1','NX','EX',ARGV[1]) then redis.call('HINCRBY',KEYS[2],'votes',1);return 1 end;return 0";
  const n=Number(await redis(['EVAL',script,2,voteKey,action==='like'?'hack:engage:likes':'hack:engage:comment:'+id,action==='like'?365*86400:RETAIN]));
  return res.status(n<0?404:200).json(n<0?{error:'comment unavailable'}:{ok:true,already:n===0});
 }
 return res.status(400).json({error:'unknown action'});
 }catch{return res.status(503).json({error:'the connection dropped. try again shortly.'});}
}
