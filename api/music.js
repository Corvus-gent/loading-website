import { redis, connected } from './_redis.js';
import { loadTracks, seedTracks, suggestions, validId, resolveLink, sameTrack, ORIGINS } from './_music-store.js';
import { ensureVoter, readVoter, ipHash, rateLimit, makeChallenge, verifyChallenge } from './_music-security.js';

const VOTE = "local first=redis.call('SADD',KEYS[1],ARGV[1]); if redis.call('TTL',KEYS[1])<0 then redis.call('EXPIRE',KEYS[1],31536000) end; if first==1 then redis.call('ZINCRBY',KEYS[2],1,ARGV[1]) end; return first";
const POLL = "if redis.call('SET',KEYS[1],ARGV[1],'NX','EX',31536000) then redis.call('HINCRBY',KEYS[2],ARGV[1],1); return 1 end; return 0";
// Limits and insertion are one transaction: concurrent requests cannot bypass the timer or cap.
const SUGGEST = `
local retry=math.max(redis.call('TTL',KEYS[1]),redis.call('TTL',KEYS[2]))
if retry>0 then return retry end
if tonumber(redis.call('GET',KEYS[3]) or '0')>=5 then return -2 end
if redis.call('HLEN',KEYS[4])>=300 then return -3 end
if redis.call('HEXISTS',KEYS[4],ARGV[1])==1 then return -4 end
redis.call('SET',KEYS[1],1,'EX',60); redis.call('SET',KEYS[2],1,'EX',60)
local n=redis.call('INCR',KEYS[3]); if redis.call('TTL',KEYS[3])<0 then redis.call('EXPIRE',KEYS[3],86400) end
redis.call('HSET',KEYS[4],ARGV[1],ARGV[2]); return 0`;

async function state(voter,ip) {
  const [catalog,list,scores,mine,poll,myPoll,voterTTL,ipTTL] = await Promise.all([
    loadTracks(), suggestions(), redis(['ZRANGE','music:votes','0','-1','WITHSCORES']), voter?redis(['SMEMBERS',`music:voted:${voter}`]):[],
    redis(['HGETALL','music:poll:counts']), voter?redis(['GET',`music:poll:voter:${voter}`]):null,
    voter?redis(['TTL',`music:cool:v:${voter}`]):0, ip?redis(['TTL',`music:cool:ip:${ip}`]):0
  ]);
  const votes = {}, counts = {spotify:0,apple:0};
  for(let i=0;i<(scores||[]).length;i+=2) votes[scores[i]]=Number(scores[i+1]);
  for(let i=0;i<(poll||[]).length;i+=2) if (poll[i] in counts) counts[poll[i]]=Number(poll[i+1]);
  return { tracks:catalog.tracks, revision:catalog.revision, suggestions:list, votes, mine:mine||[], poll:{...counts,mine:myPoll||null}, retryAfter:Math.max(0,Number(voterTTL),Number(ipTTL)), storage:true };
}
export default async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  if (!['GET','POST'].includes(req.method)) return res.status(405).json({error:'method_not_allowed'});
  if (!connected()) {
    if(req.method==='GET' && !req.query?.challenge) return res.status(200).json({tracks:await seedTracks(),suggestions:[],votes:{},mine:[],poll:{spotify:0,apple:0},storage:false});
    return res.status(503).json({error:'storage_unavailable'});
  }
  try {
    // Public statistics need catalogue/counts, never a voter cookie or seen record.
    if(req.method==='GET'&&req.query?.public==='1')return res.status(200).json(await state(null,null));
    const voter = ensureVoter(req,res), ip = ipHash(req);
    await redis(['SET',`music:seen:${voter}`,String(Date.now()),'NX','EX','3600']);
    if(req.method==='GET') {
      if(req.query?.challenge) {
        const action=req.query.challenge;
        if(!['vote','suggest','poll'].includes(action)) return res.status(400).json({error:'bad_action'});
        if(!await rateLimit(`music:challenge-rate:${ip}`,90,60)) return res.status(429).json({error:'rate_limited',retryAfter:60});
        return res.status(200).json({challenge:await makeChallenge(voter,action)});
      }
      return res.status(200).json(await state(voter,ip));
    }
    if(!ORIGINS.includes(req.headers.origin || '') || !readVoter(req)) return res.status(403).json({error:'forbidden'});
    const body=req.body || {};
    if(!['vote','suggest','poll'].includes(body.action) || body.website) return res.status(400).json({error:'bad_request'});
    if(!await rateLimit(`music:posts:${ip}`,600,86400)) return res.status(429).json({error:'daily_limit'});
    if(!await verifyChallenge(voter,body)) return res.status(403).json({error:'challenge_expired'});
    let message='voted';
    if(body.action==='poll') {
      if(!['spotify','apple'].includes(body.choice)) return res.status(400).json({error:'bad_choice'});
      await redis(['EVAL',POLL,'2',`music:poll:voter:${voter}`,'music:poll:counts',body.choice]);
    } else {
      const {tracks}=await loadTracks();
      let id=body.id;
      if(body.action==='suggest') {
        const retry=Math.max(Number(await redis(['TTL',`music:cool:v:${voter}`])),Number(await redis(['TTL',`music:cool:ip:${ip}`])));
        if(retry>0) {res.setHeader('Retry-After',String(retry)); return res.status(429).json({error:'cooldown',retryAfter:retry});}
        const track=await resolveLink(body.url);
        const existing=tracks.find(t=>sameTrack(t,track)) || (await suggestions()).find(t=>sameTrack(t,track));
        if(existing) return res.status(409).json({error:'already_listed',id:existing.id});
        id=track.id;
        const result=Number(await redis(['EVAL',SUGGEST,'4',`music:cool:v:${voter}`,`music:cool:ip:${ip}`,`music:suggday:${ip}`,'music:sugg',id,JSON.stringify(track)]));
        if(result>0) {res.setHeader('Retry-After',String(result)); return res.status(429).json({error:'cooldown',retryAfter:result});}
        if(result<0) return res.status(result===-4?409:429).json({error:result===-2?'daily_limit':result===-3?'box_full':'already_listed'});
        message='suggested';
      } else if(!validId(id) || (!tracks.some(t=>t.id===id) && !Number(await redis(['HEXISTS','music:sugg',id])))) return res.status(400).json({error:'unknown_track'});
      await redis(['EVAL',VOTE,'2',`music:voted:${voter}`,'music:votes',id]);
    }
    return res.status(200).json({...await state(voter,ip),message});
  } catch(error) { return res.status(error.status || 500).json({error:error.status?error.message:'storage_error'}); }
}
