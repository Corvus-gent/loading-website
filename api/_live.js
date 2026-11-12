import {hackLiveMode} from '../hack/live-mode-config.js';
import { SOCIALS } from '../live/socials.js';
import { LIVE, STREAM_ID } from '../live.config.js';
import { waitUntil } from '@vercel/functions';
import { redis } from './_redis.js';
import { dailyIPHash } from './_privacy.js';

export const STREAM_LINKS = Object.freeze({
  twitch: 'https://www.twitch.tv/gabe_maxxing',
  instagram: 'https://www.instagram.com/gabe.maxxing',
  twitter: 'https://x.com/gabe_maxxing'
});

// App access tokens stay in function memory, never in browser responses or logs.
export function createStatusReader({ env=process.env, fetcher=fetch, now=Date.now, mode=LIVE, stream=STREAM_ID }={}) {
  let token, tokenUntil=0, cached, cacheUntil=0, pending;
  const manual=()=>({live:mode===true,source:'manual',session:'manual-'+stream});
  return async function read() {
    if(mode!=='auto'||!env.TWITCH_CLIENT_ID||!env.TWITCH_CLIENT_SECRET)return manual();
    if(cached&&now()<cacheUntil)return cached;
    if(pending)return pending;
    pending=(async()=>{
      try {
        if(!token||now()>=tokenUntil){
          const r=await fetcher('https://id.twitch.tv/oauth2/token',{method:'POST',body:new URLSearchParams({client_id:env.TWITCH_CLIENT_ID,client_secret:env.TWITCH_CLIENT_SECRET,grant_type:'client_credentials'}),signal:AbortSignal.timeout(4000)});
          if(!r.ok)throw Error('token unavailable');
          const d=await r.json();if(typeof d.access_token!=='string'||!d.access_token)throw Error('token unavailable');
          token=d.access_token;tokenUntil=now()+Math.max(0,(Number(d.expires_in)||0)-60)*1000;
        }
        const r=await fetcher('https://api.twitch.tv/helix/streams?user_login=gabe_maxxing',{headers:{'Client-Id':env.TWITCH_CLIENT_ID,Authorization:'Bearer '+token},signal:AbortSignal.timeout(4000)});
        if(r.status===401){token=null;tokenUntil=0;}
        if(!r.ok)throw Error('status unavailable');
        const d=await r.json();if(!Array.isArray(d.data))throw Error('invalid status');
        const live=d.data.find(s=>s.user_login?.toLowerCase()==='gabe_maxxing'&&s.type==='live');
        cached={live:!!live,source:'twitch',session:live?'twitch-'+String(live.id||live.started_at):'offline'};
      }catch{cached={...manual(),source:'fallback'};}
      cacheUntil=now()+60000;return cached;
    })().finally(()=>{pending=null;});
    return pending;
  };
}
const readStatus=createStatusReader();
const readLandingTwitch=createStatusReader({mode:'auto'});
async function countClick(req,slug){
  if(req.method!=='GET'||/bot|crawler|spider|preview|headless|curl|wget/i.test(req.headers?.['user-agent']||'')||/prefetch/i.test(req.headers?.purpose||req.headers?.['sec-purpose']||''))return;
  const prefix=process.env.VERCEL_ENV==='production'?'live:clicks':'live:preview:clicks',day=new Date().toISOString().slice(0,10),hash=dailyIPHash(req,'live-'+slug);
  await redis(['EVAL',"if redis.call('SET',KEYS[1],'1','NX','EX',1800) then redis.call('HINCRBY',KEYS[2],ARGV[1],1);redis.call('HINCRBY',KEYS[3],ARGV[1],1) end;return 1",3,prefix+':dedupe:'+slug+':'+hash,prefix+':all',prefix+':'+day,slug]);
}
export default async function handler(req,res){
  if(req.query.form==='interview'||req.query.interviews==='1')return (await import('./_live-interviews.js')).default(req,res);
  res.setHeader('Cache-Control','no-store');
  if(!['GET','HEAD'].includes(req.method)){res.setHeader('Allow','GET, HEAD');return res.status(405).json({error:'Use GET.'});}
  if(req.query.slug){
    if(!Object.hasOwn(STREAM_LINKS,req.query.slug))return res.status(404).json({error:'Unknown stream.'});
    waitUntil(countClick(req,req.query.slug).catch(()=>{}));
    res.setHeader('Location',STREAM_LINKS[req.query.slug]);return res.status(302).end();
  }
  res.setHeader('Cache-Control','public, max-age=0, s-maxage=60');
  if(req.query.landing==='1'){
    const platforms=Object.fromEntries(SOCIALS.filter(s=>s.primary).map(s=>[s.platform,s.isLive]));
    const twitch=await readLandingTwitch();
    if(twitch.source==='twitch')platforms.twitch=twitch.live;
    return res.status(200).json({platforms,live:Object.values(platforms).some(Boolean),hackMode:hackLiveMode(process.env.HACK_LIVE_MODE)});
  }
  return res.status(200).json(await readStatus());
}
