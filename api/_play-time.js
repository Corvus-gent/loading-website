import crypto from 'node:crypto';
import {redis} from './_redis.js';
import {serverSecret} from './_privacy.js';
// Session and visitor clocks are shared by all tabs and instances. Never admit
// more than wall-clock time, never more than 15 seconds in a single packet.
const tickLua="local owner=redis.call('HGET',KEYS[1],'visitor'); if not owner or owner~=ARGV[1] then return {-1,0,0,0,0} end; if redis.call('HGET',KEYS[1],'ended')=='1' then return {0,tonumber(redis.call('HGET',KEYS[1],'seconds') or '0'),tonumber(redis.call('HGET',KEYS[2],'seconds') or '0'),0,0} end; local seq=tonumber(ARGV[2]); if seq<=tonumber(redis.call('HGET',KEYS[1],'seq') or '0') then return {0,tonumber(redis.call('HGET',KEYS[1],'seconds') or '0'),tonumber(redis.call('HGET',KEYS[2],'seconds') or '0'),0,0} end; local tm=redis.call('TIME'); local now=tonumber(tm[1])*1000+math.floor(tonumber(tm[2])/1000); local last=tonumber(redis.call('HGET',KEYS[2],'last') or now); last=math.max(last,tonumber(redis.call('HGET',KEYS[1],'started') or now)); local elapsed=math.max(0,math.floor((now-last)/1000)); local n=math.min(15,tonumber(ARGV[3]),elapsed); redis.call('HSET',KEYS[1],'seq',seq); if n>0 then redis.call('HINCRBY',KEYS[1],'seconds',n); redis.call('HINCRBY',KEYS[2],'seconds',n); redis.call('HINCRBY',KEYS[3],'total_play_seconds',n); redis.call('HSET',KEYS[2],'last',now) end; local ended=0; if ARGV[4]=='1' then redis.call('HSET',KEYS[1],'ended',1); ended=1 end; redis.call('EXPIRE',KEYS[1],172800); return {n,tonumber(redis.call('HGET',KEYS[1],'seconds') or '0'),tonumber(redis.call('HGET',KEYS[2],'seconds') or '0'),tonumber(redis.call('HGET',KEYS[3],'total_play_seconds') or '0'),ended}";
export async function applyPlayTime(prefix,voter,b,headers){
 if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(b.session||''))throw Error('Invalid session');
 const session=prefix+':play-session:'+b.session,visitor=prefix+':play-time:'+voter;
 if(b.action==='play_start'){
  const added=await redis(['EVAL',"if redis.call('EXISTS',KEYS[1])==0 then redis.call('HSET',KEYS[1],'visitor',ARGV[1],'seq',0,'seconds',0); redis.call('EXPIRE',KEYS[1],172800) end; if redis.call('HGET',KEYS[1],'visitor')~=ARGV[1] then return 0 end; local tm=redis.call('TIME'); local now=tonumber(tm[1])*1000+math.floor(tonumber(tm[2])/1000); redis.call('HSETNX',KEYS[1],'started',now); redis.call('HSETNX',KEYS[2],'last',now); local player=redis.call('SADD',KEYS[3],ARGV[1]); return {1,player}",3,session,visitor,prefix+':players',voter]);if(!added)throw Error('Invalid session');return {accepted_seconds:0,started_player:Boolean(Number(added[1])),visitor_play_seconds:Number(await redis(['HGET',visitor,'seconds'])||0)};
 }
 if(!Number.isSafeInteger(b.seq)||b.seq<1||!Number.isFinite(b.seconds)||b.seconds<0)throw Error('Invalid heartbeat');
 const end=b.action==='play_session_end';if(!end&&(!b.visible||!b.active))return {accepted_seconds:0};
 const [accepted,duration,total,,ended]=await redis(['EVAL',tickLua,3,session,visitor,prefix+':stats',voter,b.seq,Math.min(15,Math.floor(b.seconds)),end?'1':'0']);if(Number(accepted)<0)throw Error('Start a session first');
 if(ended&&duration>0&&b.analytics===true&&headers.dnt!=='1'&&headers['sec-gpc']!=='1'){
  // Explicitly requested person-level play metric, scoped to consented play
  // sessions. No raw visitor IDs, comments, email, IP or other profile data.
  const distinct=crypto.createHmac('sha256',serverSecret()).update('curiosity-play:'+voter).digest('hex');
  try{await fetch('https://eu.i.posthog.com/capture/',{method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(2500),body:JSON.stringify({api_key:'phc_tqJYxREMXWjzQusx6xNPuEa2fNCzKmVpAURSHKnVbpro',event:'play_session_end',distinct_id:'curiosity-play-'+distinct,properties:{$host:'corvus.gent',$pathname:'/curiositycraft/play',$current_url:'https://corvus.gent/curiositycraft/play',distinct_id:'curiosity-play-'+distinct,experience:'curiositycraft',duration_seconds:duration,total_play_seconds:total,$set:{total_play_seconds:total},$process_person_profile:true,$geoip_disable:true,$insert_id:crypto.createHash('sha256').update('play-end:'+b.session).digest('hex')},timestamp:new Date().toISOString()})});}catch{/* Redis is authoritative; analytics is best-effort. */}
 }
 return {accepted_seconds:Number(accepted),duration_seconds:Number(duration),visitor_play_seconds:Number(total)};
}
