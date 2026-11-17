import { connected, redis } from './_redis.js';

const editions = new Set(['lamplighter','sigil','arcade']);

export default async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  if(req.query?.trial === 'main-logo') return mainLogo(req,res);
  if(req.query?.trial === 'arcade') return arcadeTrial(req,res);
  if(req.method !== 'POST') {
    res.setHeader('Allow','POST');
    return res.status(405).end();
  }
  const { slug, part = '' } = req.body || {};
  if(!editions.has(slug) || typeof part !== 'string' || part.length > 240) {
    return res.status(400).json({error:'Invalid pick'});
  }
  if(!connected()) return res.status(503).json({error:'Voting unavailable'});
  try {
    await redis(['XADD','corvus:logo-lab:v1','MAXLEN','~',10000,'*','slug',slug,'part',part.trim()]);
    return res.status(201).json({saved:true});
  } catch {
    return res.status(503).json({error:'Voting unavailable'});
  }
}

const variants = ['a','b','c'];
const counts = 'corvus:{arcade-trial-v1}:counts';
const participants = 'corvus:{arcade-trial-v1}:participants';
const record = `
local state = redis.call('HGET',KEYS[1],ARGV[1])
local action = ARGV[2]
if action == 'show' then
  if not state then
    redis.call('HSET',KEYS[1],ARGV[1],'seen')
    redis.call('HINCRBY',KEYS[2],ARGV[3]..':shown',1)
  end
  return state or 'seen'
end
if not state then return 'unseen' end
if state == 'seen' then
  redis.call('HSET',KEYS[1],ARGV[1],action)
  redis.call('HINCRBY',KEYS[2],ARGV[3]..':'..action,1)
  return action
end
return state
`;
async function arcadeTrial(req,res) {
  if (!connected()) return res.status(503).end();
  try {
    if (req.method === 'GET') {
      const fields = variants.flatMap(v => ['shown','yes','no'].map(k=>v+':'+k));
      const values = await redis(['HMGET',counts,...fields]);
      return res.json(variants.map((variant,i)=>({variant,shown:Number(values[i*3]),yes:Number(values[i*3+1]),no:Number(values[i*3+2])})));
    }
    if (req.method !== 'POST') {res.setHeader('Allow','GET, POST');return res.status(405).end();}
    const {id,action}=req.body || {};
    if(typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id) || !['show','yes','no'].includes(action)) return res.status(400).end();
    const variant=variants[parseInt(id.slice(0,8),16)%3];
    const state=await redis(['EVAL',record,'2',participants,counts,id,action,variant]);
    if(state==='unseen') return res.status(409).end();
    return res.json({variant,answered:state!=='seen'});
  } catch {return res.status(503).end();}
}

async function mainLogo(req,res) {
  if (!connected()) return res.status(503).end();
  const votes='corvus:{main-logo-v1}:votes', totals='corvus:{main-logo-v1}:totals';
  try {
    if(req.method==='GET') {
      const values=await redis(['HMGET',totals,'a','b','c']);
      return res.json(values.map(Number));
    }
    if(req.method!=='POST') return res.status(405).end();
    const {id,choice}=req.body||{};
    if(typeof id!=='string'||!/^([a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12})$/.test(id)||!variants.includes(choice))return res.status(400).end();
    const script="if redis.call('HSETNX',KEYS[1],ARGV[1],ARGV[2])==1 then redis.call('HINCRBY',KEYS[2],ARGV[2],1) end return redis.call('HGET',KEYS[1],ARGV[1])";
    const saved=await redis(['EVAL',script,'2',votes,totals,id,choice]);
    return res.json({saved});
  }catch{return res.status(503).end();}
}
