import crypto from 'node:crypto';
import {redis,pipeline} from './_redis.js';
import {rateLimit,dailyIPHash} from './_privacy.js';
const ids=['spawn-worlds','ai-drawings','character-voices','build-challenges','multiplayer','parent-report','teacher-mode','why-monster'];
const root=process.env.VERCEL_ENV==='preview'?'worldcraft:preview':'worldcraft';
const prefix=root+':features:v2';
const langs=['en','es','zh','fr','pt','nl','hi','ta'];
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const object=x=>Array.isArray(x)?Object.fromEntries(Array.from({length:x.length/2},(_,i)=>[x[i*2],x[i*2+1]])):x||{};
const cookie=req=>String(req.headers.cookie||'').match(/(?:^|;\s*)wc_visitor=([a-f0-9-]{36})(?:;|$)/)?.[1];
const rewards=[
 ...['hackathon-corgi','giant-duck','golden-gate','marina-cybertruck','amplitude'].map((photo,i)=>({id:'photo-'+i,kind:'photo',title:['Gabe meets the real corgi','Gabe vs the giant duck','Golden Gabe Bridge','Cybertruck sidequest','Onstage in SF'][i],image:'/sf/larp/photos/'+photo+'.webp',text:'A real frame from Gabe’s SF LARP adventures.',href:'/sf/larp'})),
 {id:'fact-fog',kind:'fact',title:'SF fact: nature’s fog machine',text:'Cool ocean air can bring fog through the Golden Gate. The city’s hills make a patchwork of microclimates.'},
 {id:'fact-cable',kind:'fact',title:'SF fact: a moving cable',text:'San Francisco’s cable cars grip a moving cable beneath the street. The first line opened in 1873.'},
 {id:'raven',kind:'badge',title:'You found the raven 🐦‍⬛',text:'Curiosity badge unlocked: you asked for more. Screenshot your badge and keep wondering.'},
 {id:'arcade',kind:'easter-egg',title:'A secret arcade door',text:'Take a curiosity break in the Corvus arcade.',href:'/games/'},
 {id:'shoutout',kind:'entry',title:'Gabe’s X shout-out draw entry',text:'You’re in the draw for a shout-out from Gabe on X. An adult can leave a private email with a feature comment so we can contact a selected entry; nothing is posted automatically.'},
 {id:'call',kind:'entry',title:'1:1 call raffle ticket',text:'A ticket for the 1:1 call draw. An optional adult/parent email lets Gabe contact a selected entry.'},
 {id:'spawn',kind:'entry',title:'Gabe spawns: thank-you draw ticket',text:'A ticket for the in-person thank-you draw. Any visit is by mutual agreement; optional adult/parent email is used only to arrange it.'}
];
// Atomic: one unseen reward per qualifying action, even during concurrent requests.
const grantLua="if redis.call('LLEN',KEYS[5])==0 then return '' end; redis.call('LPOP',KEYS[5]); for i=1,#ARGV do if redis.call('SADD',KEYS[1],ARGV[i])==1 then redis.call('LPUSH',KEYS[2],ARGV[i]); redis.call('LPUSH',KEYS[3],cjson.encode({visitor=KEYS[4],reward=ARGV[i],at=redis.call('TIME')[1]})); return ARGV[i] end end; return ''";
async function grant(voter){const shuffled=rewards.map(r=>r.id);for(let i=shuffled.length-1;i>0;i--){const j=crypto.randomInt(i+1);[shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]];}return await redis(['EVAL',grantLua,5,prefix+':rewards:'+voter,prefix+':reward-order:'+voter,prefix+':reward-log',voter,prefix+':pending-rewards:'+voter,...shuffled]);}
async function snapshot(visitor){const voter=visitor?hash(visitor):null;const [countsRaw,statsRaw,commentIds,visitors,players,onboarded,active,languageRaw]=await pipeline([['HGETALL',prefix+':counts'],['HGETALL',prefix+':stats'],['ZREVRANGE',prefix+':comments',0,19],['SCARD',prefix+':visitors'],['SCARD',prefix+':players'],['SCARD',prefix+':onboarded'],['ZCOUNT',prefix+':active',Date.now()-45000,'+inf'],['HGETALL',prefix+':languages']]);const counts=object(countsRaw),stats=object(statsRaw);const rows=commentIds?.length?await pipeline(commentIds.flatMap(id=>[['GET',prefix+':comment:'+id],['ZSCORE',prefix+':comments',id]])):[];const comments=commentIds.map((id,i)=>({...JSON.parse(rows[i*2]),id,likes:Math.floor(Number(rows[i*2+1]||0))}));let picks=[],commentedFeatures=[],liked=[],revealed=[],shared=[];if(voter){[picks,commentedFeatures,liked,revealed,shared]=await pipeline([['SMEMBERS',prefix+':voter:'+voter],['SMEMBERS',prefix+':commented:'+voter],['SMEMBERS',prefix+':liked:'+voter],['LRANGE',prefix+':reward-order:'+voter,0,-1],['SMEMBERS',prefix+':shared:'+voter]]);}const languageCounts=object(languageRaw);return {languages:langs.map(lang=>({lang,visitors:Number(languageCounts[lang+':visitors']||0),votes:Number(languageCounts[lang+':votes']||0),comments:Number(languageCounts[lang+':comments']||0)})),mode:'features',counts:Object.fromEntries(ids.map(id=>[id,Number(counts[id]||0)])),picks,commentedFeatures,liked,shared,comments,rewards:revealed.map(id=>rewards.find(r=>r.id===id)).filter(Boolean),rewardsLeft:rewards.length-revealed.length,scoreboard:{visitors:Number(visitors),players:Number(players),votes:ids.reduce((n,id)=>n+Number(counts[id]||0),0),comments:Number(stats.comments||0),likes:Number(stats.likes||0),shares:Number(stats.shares||0),onboarded:Number(onboarded),active:Number(active)}};}
function commentLanguage(text){
 if(/[\u0b80-\u0bff]/.test(text))return 'ta';if(/[\u0900-\u097f]/.test(text))return 'hi';if(/[\u3400-\u9fff]/.test(text))return 'zh';
 const tokens=text.toLowerCase().match(/[\p{L}’']+/gu)||[];const vocab={nl:['mijn','kind','zou','leuk','graag','geweldig','vinden','meer','toevoegen','het','een','met','voor','ik','dit','dochter','zoon'],en:['my','kid','would','love','add','missing','the','this','more','with','for','i','kids','great','fun'],es:['mi','hijo','hija','gustaría','añadir','falta','quiero','niños','para','una','más'],fr:['mon','enfant','aimerait','ajouter','manque','les','une','pour','avec','des','je'],pt:['meu','filho','filha','gostaria','adicionar','falta','crianças','para','uma','mais']};let best=null,score=0;for(const [code,words]of Object.entries(vocab)){const n=tokens.reduce((n,w)=>n+Number(words.includes(w)),0);if(n>score){score=n;best=code;}}return best||'und';
}
function validateText(raw){const text=String(raw||'').trim();if(text.length<3||text.length>600)throw Error('Write 3–600 characters.');if(/(?:@|https?:\/\/|www\.)/i.test(text)||/(?:\+?\d[\s().-]*){7,}/.test(text))throw Error('Keep contact details and links out of public comments.');return text;}
export default async function handler(req,res){res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');try{
 if(req.query.admin==='1'){
  const password=process.env.WORLDCRAFT_ADMIN_PASSWORD||process.env.ADMIN_PASSWORD;if(!password)return res.status(503).json({error:'Set WORLDCRAFT_ADMIN_PASSWORD in Vercel to enable admin.'});
  if(!await rateLimit(prefix+':admin:'+dailyIPHash(req,'worldcraft-admin'),20,60))return res.status(429).json({error:'Try again in a minute.'});
  if(hash(req.headers.authorization||'')!==hash('Bearer '+password))return res.status(401).json({error:'Incorrect admin password.'});if(req.method!=='GET')return res.status(405).json({error:'Use GET.'});
  const rewardEntries=(await redis(['LRANGE',prefix+':reward-log',0,999])||[]).map(JSON.parse);const contacts=rewardEntries.length?await pipeline(rewardEntries.map(r=>['HGET',prefix+':emails',r.visitor])):[];
  return res.status(200).json({...(await snapshot()),entries:(await redis(['LRANGE',prefix+':private',0,999])||[]).map(JSON.parse),rewardEntries:rewardEntries.map((r,i)=>({...r,email:contacts[i]||null})),legacyDemoVotes:object(await redis(['HGETALL',root+':v1:counts'])),legacyEntries:(await redis(['LRANGE',root+':v1:private',0,999])||[]).map(JSON.parse),limit:1000});
 }
 if(req.method==='GET'){const id=String(req.headers['x-worldcraft-visitor']||'');return res.status(200).json(await snapshot(cookie(req)||(/^[a-f0-9-]{36}$/.test(id)?id:null)));}
 if(req.method!=='POST'){res.setHeader('Allow','GET, POST');return res.status(405).json({error:'Use GET or POST.'});}
 const origins=['https://corvus.gent','https://www.corvus.gent',...[process.env.VERCEL_URL,process.env.VERCEL_BRANCH_URL].filter(Boolean).map(x=>'https://'+x)];if(process.env.NODE_ENV!=='production')origins.push('http://127.0.0.1:'+(process.env.WORLDCRAFT_TEST_PORT||4176));
 if(!origins.includes(req.headers.origin)||!String(req.headers['content-type']).startsWith('application/json'))return res.status(403).json({error:'Use the Curiosity Craft page.'});
 if(!await rateLimit(prefix+':rate:'+dailyIPHash(req,'worldcraft'),120,60))return res.status(429).json({error:'Please wait a minute.'});
 if(Number(req.headers['content-length']||0)>4096)return res.status(413).json({error:'Message too long.'});
 let b;try{b=typeof req.body==='string'?JSON.parse(req.body):req.body||{};}catch{return res.status(400).json({error:'Invalid request.'});}
 if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(b.visitor||''))return res.status(400).json({error:'Invalid visitor.'});
 const visitor=cookie(req)||b.visitor,voter=hash(visitor),lang=langs.includes(b.lang)?b.lang:'en';res.setHeader('Set-Cookie',`wc_visitor=${visitor}; Path=/api/worldcraft; HttpOnly; SameSite=Lax; Max-Age=31536000${process.env.NODE_ENV==='production'?'; Secure':''}`);let changed=0,newReward='',events=[];
 if(b.action==='visit'||b.action==='play'){
  await redis(['EVAL',"if redis.call('SADD',KEYS[1],ARGV[1])==1 then redis.call('HINCRBY',KEYS[2],ARGV[2],1) end; return 1",2,prefix+':langvisitors:'+lang,prefix+':languages',voter,lang+':visitors']);const added=await redis(['SADD',prefix+':visitors',voter]);if(added)events.push('visit');
  if(b.action==='play'){changed=await redis(['SADD',prefix+':players',voter]);if(changed)events.push('play');await redis(['ZADD',prefix+':active',Date.now(),voter]);await redis(['ZREMRANGEBYSCORE',prefix+':active','-inf',Date.now()-45000]);}
 }else if(b.action==='vote'){
  if(!ids.includes(b.feature))return res.status(400).json({error:'Choose a feature.'});
  changed=await redis(['EVAL',"if redis.call('SADD',KEYS[1],ARGV[1])==1 then redis.call('HINCRBY',KEYS[2],ARGV[1],1); redis.call('HINCRBY',KEYS[3],ARGV[2],1); return 1 end; return 0",3,prefix+':voter:'+voter,prefix+':counts',prefix+':languages',b.feature,lang+':votes']);if(changed)events.push('vote');
 }else if(b.action==='comment'||b.action==='suggest'){
  let text;try{text=validateText(b.text);}catch(e){return res.status(400).json({error:e.message});}
  const suggestion=b.action==='suggest',feature=suggestion?'suggestion':b.feature;
  if(!suggestion&&(!ids.includes(feature)||!await redis(['SISMEMBER',prefix+':voter:'+voter,feature])))return res.status(409).json({error:'Upvote that feature before commenting to unlock a reward.'});
  const email=suggestion?'':String(b.email||'').trim();if(email&&(!b.adult||!b.consent||email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))return res.status(400).json({error:'An adult or parent must consent and enter a valid email.'});
  const detectedLang=commentLanguage(text);const id=crypto.randomUUID(),entry={feature,text,lang:detectedLang,type:suggestion?'suggestion':'comment',at:new Date().toISOString()};
  changed=await redis(['EVAL',"if redis.call('SADD',KEYS[1],ARGV[1])==0 then return 0 end; redis.call('SET',KEYS[2],ARGV[2]); redis.call('ZADD',KEYS[3],ARGV[3],ARGV[4]); redis.call('HINCRBY',KEYS[4],'comments',1); redis.call('HINCRBY',KEYS[7],ARGV[7],1); redis.call('SADD',KEYS[5],ARGV[5]); redis.call('LPUSH',KEYS[6],ARGV[6]); if ARGV[8]=='1' then redis.call('RPUSH',KEYS[8],ARGV[1]) end; if ARGV[9]~='' then redis.call('HSET',KEYS[9],ARGV[5],ARGV[9]) end; return 1",9,prefix+':commented:'+voter,prefix+':comment:'+id,prefix+':comments',prefix+':stats',prefix+':onboarded',prefix+':private',prefix+':languages',prefix+':pending-rewards:'+voter,prefix+':emails',feature,JSON.stringify(entry),Date.now()/1e15,id,voter,JSON.stringify({...entry,id,email:email||null,raffle:Boolean(email),adultConsent:Boolean(email&&b.adult&&b.consent)}),(detectedLang==='und'?lang:detectedLang)+':comments',suggestion?'0':'1',email]);
  if(changed){events.push('comment');if(email)await redis(['HSET',prefix+':emails',voter,email]);if(!suggestion)newReward=await grant(voter);}
 }else if(b.action==='like'){
  if(!/^[a-f0-9-]{36}$/.test(b.id||''))return res.status(400).json({error:'Choose a comment.'});
  changed=await redis(['EVAL',"if redis.call('EXISTS',KEYS[1])==0 then return 0 end; if redis.call('SADD',KEYS[2],ARGV[1])==0 then return 0 end; redis.call('ZINCRBY',KEYS[3],1,ARGV[1]); redis.call('HINCRBY',KEYS[4],'likes',1); return 1",4,prefix+':comment:'+b.id,prefix+':liked:'+voter,prefix+':comments',prefix+':stats',b.id]);if(changed)events.push('like');
 }else if(b.action==='share'){
  if(!['x','linkedin','whatsapp','copy'].includes(b.platform))return res.status(400).json({error:'Choose a share button.'});
  changed=await redis(['EVAL',"if redis.call('SADD',KEYS[1],ARGV[1])==0 then return 0 end; redis.call('HINCRBY',KEYS[2],'shares',1); redis.call('RPUSH',KEYS[3],ARGV[1]); return 1",3,prefix+':shared:'+voter,prefix+':stats',prefix+':pending-rewards:'+voter,b.platform]);if(changed){events.push('share');newReward=await grant(voter);}
 }else return res.status(400).json({error:'Unknown action.'});
 if(!newReward)newReward=await grant(voter);if(newReward)events.push('reward_revealed');return res.status(200).json({...(await snapshot(visitor)),changed:Boolean(changed),events,newReward:rewards.find(r=>r.id===newReward)||null});
}catch{return res.status(503).json({error:'Live counts are reconnecting. Please retry; only confirmed actions count.'});}}
