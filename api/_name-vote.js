import crypto from 'node:crypto';
import {redis,pipeline} from './_redis.js';
import {dailyIPHash,rateLimit,serverSecret} from './_privacy.js';
import {ensureVoter} from './_music-security.js';
const REVEAL_AT='2026-11-07T23:15:00Z';
const NAMES=['CHOKEMAN','BRAINROLL','OSSMAN','SMESH','ARMBARCADE'];
const prefix=process.env.VERCEL_ENV==='preview'?'namevote:preview:v1':'namevote:v1',TTL=90*86400;
const object=raw=>Array.isArray(raw)?Object.fromEntries(Array.from({length:raw.length/2},(_,i)=>[raw[i*2],Number(raw[i*2+1])])):raw||{};
async function results(){const [raw,statsRaw]=await pipeline([['HGETALL',prefix+':counts'],['HGETALL',prefix+':stats']]);const counts=object(raw),stats=object(statsRaw),votes=NAMES.map(name=>({name,count:Number(counts[name]||0)})),total=votes.reduce((n,v)=>n+v.count,0),closed=Date.now()>=Date.parse(REVEAL_AT);return{votes,total,plays:Number(stats.plays||0),topScore:Number(stats.topScore||0),serverTime:Date.now(),revealAt:REVEAL_AT,closed,winner:closed&&total?votes.slice().sort((a,b)=>b.count-a.count)[0].name:null};}
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
 if(['play','score'].includes(body.action)){
 if(!/^[-a-zA-Z0-9_]{16,64}$/.test(body.run||''))return res.status(400).json({error:'Invalid run.'});
 const key=prefix+':run:'+hash(body.device+':'+body.run);
 if(body.action==='play')await redis(['EVAL',"if redis.call('SET',KEYS[1],ARGV[1],'NX','EX',86400) then redis.call('HINCRBY',KEYS[2],'plays',1); end; return 1",2,key,prefix+':stats',Date.now()]);
 else {if(!Number.isSafeInteger(body.score)||body.score<0||body.score>1000000)return res.status(400).json({error:'Invalid score.'});const started=Number(await redis(['GET',key]));if(!started)return res.status(409).json({error:'Start a new run first.'});if(body.score>1000+Math.max(0,Date.now()-started)/1000*500)return res.status(400).json({error:'Score is too fast.'});await redis(['EVAL',"local old=tonumber(redis.call('HGET',KEYS[1],'topScore') or '0'); if tonumber(ARGV[1])>old then redis.call('HSET',KEYS[1],'topScore',ARGV[1]); end; return 1",1,prefix+':stats',body.score]);}
 return res.status(200).json({ok:true});
 }
 if(!NAMES.includes(body.name))return res.status(400).json({error:'Choose one of the five names.'});
 if(!await rateLimit(prefix+':vote-rate:'+dailyIPHash(req,'namevote-vote'),12,60))return res.status(429).json({error:'Too many tries. Wait a minute.'});
 const selected=await redis(['EVAL',"local now=redis.call('TIME'); if tonumber(now[1])*1000>=tonumber(ARGV[3]) then return 'CLOSED' end; local p=redis.call('GET',KEYS[1]) or redis.call('GET',KEYS[2]); if p then return p end; redis.call('SET',KEYS[1],ARGV[1],'EX',ARGV[2]); redis.call('SET',KEYS[2],ARGV[1],'EX',ARGV[2]); redis.call('HINCRBY',KEYS[3],ARGV[1],1); return ARGV[1]",3,prefix+':device:'+hash(body.device),prefix+':voter:'+hash(voter),prefix+':counts',body.name,TTL,Date.parse(REVEAL_AT)]);
 if(selected==='CLOSED')return res.status(409).json({...await results(),error:'Voting is closed. The name is locked in.'});
 return res.status(200).json({...await results(),pick:selected});
 }catch{return res.status(503).json({error:'Voting is reconnecting. Your vote was not confirmed; try again.'});}
}
