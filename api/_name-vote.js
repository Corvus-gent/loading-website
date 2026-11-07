import crypto from 'node:crypto';
import {redis} from './_redis.js';
import {dailyIPHash,rateLimit,serverSecret} from './_privacy.js';
import {ensureVoter} from './_music-security.js';
const NAMES=['CHOKEMAN','BRAINROLL','OSSMAN','SMESH','ARMBARCADE'];
const prefix=process.env.VERCEL_ENV==='preview'?'namevote:preview:v1':'namevote:v1',TTL=90*86400;
async function results(){const raw=await redis(['HGETALL',prefix+':counts']);const counts=Array.isArray(raw)?Object.fromEntries(Array.from({length:raw.length/2},(_,i)=>[raw[i*2],Number(raw[i*2+1])])):raw||{};const votes=NAMES.map(name=>({name,count:Number(counts[name]||0)}));return{votes,total:votes.reduce((n,v)=>n+v.count,0)};}
export default async function handler(req,res){
 res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
 try{
 if(req.method==='GET')return res.status(200).json(await results());
 if(req.method!=='POST'){res.setHeader('Allow','GET, POST');return res.status(405).json({error:'Use GET or POST.'});}
 const origins=['https://corvus.gent','https://www.corvus.gent',...['VERCEL_URL','VERCEL_BRANCH_URL'].map(k=>process.env[k]&&'https://'+process.env[k])];
 if(process.env.NODE_ENV!=='production')origins.push('http://127.0.0.1:4392');
 if(!origins.includes(req.headers.origin)||!String(req.headers['content-type']).startsWith('application/json'))return res.status(403).json({error:'Vote from this page.'});
 if(!await rateLimit(prefix+':rate:'+dailyIPHash(req,'namevote'),12,60)){res.setHeader('Retry-After','60');return res.status(429).json({error:'Too many tries. Come back in a minute.'});}
 if(Number(req.headers['content-length'])>1024)return res.status(413).json({error:'Request too large.'});
 let body;try{body=typeof req.body==='string'?JSON.parse(req.body):req.body;}catch{return res.status(400).json({error:'Invalid vote.'});}
 if(!body||!NAMES.includes(body.name)||!/^[-a-zA-Z0-9_]{16,64}$/.test(body.device||''))return res.status(400).json({error:'Choose one of the five names.'});
 const voter=ensureVoter(req,res),hash=v=>crypto.createHmac('sha256',serverSecret()).update('namevote:'+v).digest('hex');
 const selected=await redis(['EVAL',"local p=redis.call('GET',KEYS[1]) or redis.call('GET',KEYS[2]); if p then return p end; redis.call('SET',KEYS[1],ARGV[1],'EX',ARGV[2]); redis.call('SET',KEYS[2],ARGV[1],'EX',ARGV[2]); redis.call('HINCRBY',KEYS[3],ARGV[1],1); return ARGV[1]",3,prefix+':device:'+hash(body.device),prefix+':voter:'+hash(voter),prefix+':counts',body.name,TTL]);
 return res.status(200).json({...await results(),pick:selected});
 }catch{return res.status(503).json({error:'Voting is reconnecting. Your vote was not confirmed; try again.'});}
}
