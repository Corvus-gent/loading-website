import crypto from 'node:crypto';
import {redis,pipeline} from './_redis.js';
import {dailyIPHash,rateLimit,serverSecret} from './_privacy.js';
import {ensureVoter} from './_music-security.js';
const REVEAL_AT='2026-11-07T23:15:00Z';
const NAMES=['CHOKEMAN','BRAINROLL','OSSMAN','SMESH','ARMBARCADE'];
const prefix=process.env.VERCEL_ENV==='preview'?'namevote:preview:v1':'namevote:v1',TTL=90*86400;
const object=raw=>Array.isArray(raw)?Object.fromEntries(Array.from({length:raw.length/2},(_,i)=>[raw[i*2],Number(raw[i*2+1])])):raw||{};
async function board(){const ids=await redis(['ZREVRANGE',prefix+':board',0,29])||[];if(!ids.length)return[];const rows=await pipeline(ids.map(id=>['GET',prefix+':entry:'+id]));return rows.flatMap(v=>{try{const r=JSON.parse(v);return r?[{name:r.name,score:r.score}]:[];}catch{return[];}}).slice(0,10).map((r,i)=>({...r,rank:i+1}));}
async function ideas(){const ids=await redis(['ZREVRANGE',prefix+':ideas',0,19])||[];if(!ids.length)return[];const rows=await pipeline(ids.flatMap(id=>[['GET',prefix+':feedback:'+id],['ZSCORE',prefix+':ideas',id]]));return ids.flatMap((id,i)=>{try{const r=JSON.parse(rows[i*2]);return r?.type==='idea'?[{id,text:r.text,votes:Number(rows[i*2+1]||0)}]:[];}catch{return[];}});}
async function results(){const [raw,statsRaw]=await pipeline([['HGETALL',prefix+':counts'],['HGETALL',prefix+':stats']]);const counts=object(raw),stats=object(statsRaw),votes=NAMES.map(name=>({name,count:Number(counts[name]||0)})),total=votes.reduce((n,v)=>n+v.count,0),closed=Date.now()>=Date.parse(REVEAL_AT);return{votes,total,plays:Number(stats.plays||0),topScore:Number(stats.topScore||0),leaderboard:await board(),ideas:await ideas(),serverTime:Date.now(),revealAt:REVEAL_AT,closed,winner:closed&&total?votes.slice().sort((a,b)=>b.count-a.count)[0].name:null};}
export default async function handler(req,res){
 res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
 try{
 if(req.method==='GET')return res.status(200).json(await results());
 if(req.method!=='POST'){res.setHeader('Allow','GET, POST');return res.status(405).json({error:'Use GET or POST.'});}
 const origins=['https://corvus.gent','https://www.corvus.gent',...['VERCEL_URL','VERCEL_BRANCH_URL'].map(k=>process.env[k]&&'https://'+process.env[k])];
 if(process.env.NODE_ENV!=='production')origins.push('http://127.0.0.1:4392');
 if(!origins.includes(req.headers.origin)||!String(req.headers['content-type']).startsWith('application/json'))return res.status(403).json({error:'Vote from this page.'});
 if(!await rateLimit(prefix+':rate:'+dailyIPHash(req,'namevote'),120,60)){res.setHeader('Retry-After','60');return res.status(429).json({error:'Too many tries. Come back in a minute.'});}
 if(Number(req.headers['content-length'])>1024)return res.status(413).json({error:'Request too large.'});
 let body;try{body=typeof req.body==='string'?JSON.parse(req.body):req.body;}catch{return res.status(400).json({error:'Invalid vote.'});}
 if(!body||!/^[-a-zA-Z0-9_]{16,64}$/.test(body.device||''))return res.status(400).json({error:'Choose one of the five names.'});
 const voter=ensureVoter(req,res),hash=v=>crypto.createHmac('sha256',serverSecret()).update('namevote:'+v).digest('hex');
 if(body.action==='feedback'){
 if(!['idea','bug'].includes(body.type)||typeof body.text!=='string'||body.text.trim().length<3||body.text.length>600)return res.status(400).json({error:'Write 3–600 characters.'});
 if(!await rateLimit(prefix+':feedback-rate:'+dailyIPHash(req,'arcade-feedback'),5,60))return res.status(429).json({error:'Five messages per minute. Take a breath.'});
 const id=crypto.randomUUID(),text=body.text.replace(/https?:\/\/\S+/gi,'[link removed]').replace(/[\u0000-\u001f<>]/g,' ').trim();
 await redis(['SET',prefix+':feedback:'+id,JSON.stringify({type:body.type,text,at:Date.now()}),'EX',TTL]);if(body.type==='idea')await redis(['ZADD',prefix+':ideas',0,id]);else await redis(['ZADD',prefix+':bugs',Date.now(),id]);await redis(['EXPIRE',prefix+':'+(body.type==='idea'?'ideas':'bugs'),TTL]);return res.status(200).json({ok:true});
 }
 if(body.action==='idea-vote'){
 if(!/^[a-f0-9-]{36}$/.test(body.id||''))return res.status(400).json({error:'Invalid idea.'});const raw=await redis(['GET',prefix+':feedback:'+body.id]);if(!raw||JSON.parse(raw).type!=='idea')return res.status(404).json({error:'Idea unavailable.'});
 await redis(['EVAL',"if redis.call('SET',KEYS[1],'1','NX','EX',ARGV[2]) then redis.call('ZINCRBY',KEYS[2],1,ARGV[1]); end; return 1",2,prefix+':idea-voter:'+hash(voter)+':'+body.id,prefix+':ideas',body.id,TTL]);return res.status(200).json({ok:true});
 }
 if(['play','score','result'].includes(body.action)){
 if(!/^[-a-zA-Z0-9_]{16,64}$/.test(body.run||''))return res.status(400).json({error:'Invalid run.'});
 const key=prefix+':run:'+hash(body.device+':'+body.run);
 if(body.action==='play')await redis(['EVAL',"if redis.call('SET',KEYS[1],ARGV[1],'NX','EX',86400) then redis.call('HINCRBY',KEYS[2],'plays',1); end; return 1",2,key,prefix+':stats',Date.now()]);
 else {if(!Number.isSafeInteger(body.score)||body.score<0||body.score>1000000)return res.status(400).json({error:'Invalid score.'});const started=Number(await redis(['GET',key]));if(!started)return res.status(409).json({error:'Start a new run first.'});if(body.score>1000+Math.max(0,Date.now()-started)/1000*500)return res.status(400).json({error:'Score is too fast.'});await redis(['EVAL',"local old=tonumber(redis.call('HGET',KEYS[1],'topScore') or '0'); if tonumber(ARGV[1])>old then redis.call('HSET',KEYS[1],'topScore',ARGV[1]); end; return 1",1,prefix+':stats',body.score]);}
 if(body.action==='result'){
 const name=String(body.name||'').replace(/[^\p{L}\p{N} _.-]/gu,'').trim().slice(0,16);if(!name)return res.status(400).json({error:'Enter a short name.'});const id=hash(body.device);
 await redis(['EVAL',"local old=tonumber(redis.call('ZSCORE',KEYS[1],ARGV[1]) or '-1'); if tonumber(ARGV[2])>=old then redis.call('ZADD',KEYS[1],ARGV[2],ARGV[1]); redis.call('SET',KEYS[2],ARGV[3],'EX',ARGV[4]); redis.call('EXPIRE',KEYS[1],ARGV[4]); end; return 1",2,prefix+':board',prefix+':entry:'+id,id,body.score,JSON.stringify({name,score:body.score,at:Date.now()}),TTL]);
 return res.status(200).json({ok:true,rank:Number(await redis(['ZREVRANK',prefix+':board',id]))+1,leaderboard:await board()});
 }
 return res.status(200).json({ok:true});
 }
 if(!NAMES.includes(body.name))return res.status(400).json({error:'Choose one of the five names.'});
 if(!await rateLimit(prefix+':vote-rate:'+dailyIPHash(req,'namevote-vote'),12,60))return res.status(429).json({error:'Too many tries. Wait a minute.'});
 const selected=await redis(['EVAL',"local now=redis.call('TIME'); if tonumber(now[1])*1000>=tonumber(ARGV[3]) then return 'CLOSED' end; local p=redis.call('GET',KEYS[1]) or redis.call('GET',KEYS[2]); if p then return p end; redis.call('SET',KEYS[1],ARGV[1],'EX',ARGV[2]); redis.call('SET',KEYS[2],ARGV[1],'EX',ARGV[2]); redis.call('HINCRBY',KEYS[3],ARGV[1],1); return ARGV[1]",3,prefix+':device:'+hash(body.device),prefix+':voter:'+hash(voter),prefix+':counts',body.name,TTL,Date.parse(REVEAL_AT)]);
 if(selected==='CLOSED')return res.status(409).json({...await results(),error:'Voting is closed. The name is locked in.'});
 return res.status(200).json({...await results(),pick:selected});
 }catch{return res.status(503).json({error:'Voting is reconnecting. Your vote was not confirmed; try again.'});}
}
