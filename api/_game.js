import crypto from 'node:crypto';
import fs from 'node:fs';
import sharp from 'sharp';
import {redis,connected} from './_redis.js';
import {ensureVoter,readVoter,ipHash,rateLimit} from './_music-security.js';
import {hogql,posthogReady,REAL} from './_posthog.js';
import bank from './_game-data.js';
const data=name=>bank[name];
const countries=data('countries'),languages=data('languages'),words=data('words'),artists=data('artists');
const tracks=JSON.parse(fs.readFileSync(new URL('../music.json',import.meta.url))).tracks;
export const CYCLE=['babel','borders','wordle','flags','combo','bangle','pingle','lantern'];
export const LAUNCH='2026-11-04';
export const dateKey=(date=new Date())=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Brussels'}).format(date);
export const number=day=>Math.max(1,Math.round((Date.parse(day)-Date.parse(LAUNCH))/86400000)+1);
export const fold=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const secret=()=>process.env.GAME_SECRET||process.env.SESSION_SECRET||process.env.VOTE_SECRET||process.env.REDIS_URL||Object.entries(process.env).find(([k,v])=>/REST_API_TOKEN$/.test(k)&&v)?.[1];
const choose=(day,label,arr)=>{if(!secret())throw Error('missing secret');return arr[crypto.createHmac('sha256',secret()).update(`${day}:${label}`).digest().readUInt32BE()%arr.length];};
export function distance(a,b){const r=Math.PI/180,dlat=(b.lat-a.lat)*r,dlng=(b.lng-a.lng)*r;const km=Math.round(6371*2*Math.asin(Math.min(1,Math.sqrt(Math.sin(dlat/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(dlng/2)**2))));const bearing=(Math.atan2(Math.sin(dlng)*Math.cos(b.lat*r),Math.cos(a.lat*r)*Math.sin(b.lat*r)-Math.sin(a.lat*r)*Math.cos(b.lat*r)*Math.cos(dlng))*180/Math.PI+360)%360;return {km,arrow:['↑','↗','→','↘','↓','↙','←','↖'][Math.round(bearing/45)%8],proximity:Math.max(0,Math.round(100-km/200))};}
export function wordFeedback(guess,answer){const out=Array(5).fill('⬛'),pool=[...answer];[...guess].forEach((c,i)=>{if(c===answer[i]){out[i]='🟩';pool[i]=null;}});[...guess].forEach((c,i)=>{if(out[i]!=='🟩'){const j=pool.indexOf(c);if(j>=0){out[i]='🟨';pool[j]=null;}}});return out.join('');}
export async function puzzle(day){const n=number(day),type=CYCLE[(n-1)%8],language=choose(day,'language',languages),country=choose(day,'country',countries);const p={day,n,type,language,country};
 if(type==='wordle'||type==='lantern'){p.lang=Object.keys(words)[Math.floor((n-1)/8)%7];p.answer=choose(day,'word',words[p.lang]);}
 if(type==='bangle'){p.artist=choose(day,'artist',artists);p.track=tracks.find(t=>t.artist===p.artist.name);}
 if(type==='flags')p.rounds=Array.from({length:5},(_,i)=>{const c=choose(day,`round${i}`,countries);const options=[c,...countries.filter(x=>x!==c).sort((a,b)=>fold(a.name).localeCompare(fold(b.name))).slice((i*3)%12,(i*3)%12+3)];options.sort((a,b)=>crypto.createHmac('sha256',secret()).update(`${day}:${i}:${a.name}`).digest('hex').localeCompare(crypto.createHmac('sha256',secret()).update(`${day}:${i}:${b.name}`).digest('hex')));return {country:c,options:options.map(x=>i%2?x.capital:x.name)};});
 if(type==='pingle'){let raw=await redis(['GET',`game:city:${day}`]);if(raw===null){let city=null;if(posthogReady()){const rows=await hogql(`SELECT properties.$geoip_city_name, round(avg(toFloat(properties.$geoip_latitude)),1), round(avg(toFloat(properties.$geoip_longitude)),1), count(DISTINCT distinct_id) n FROM events WHERE event='$pageview' AND ${REAL} AND toDate(toTimeZone(timestamp,'Europe/Brussels'))=toDate('${day}')-1 AND properties.$geoip_city_name IS NOT NULL AND properties.$geoip_latitude IS NOT NULL GROUP BY properties.$geoip_country_code, properties.$geoip_subdivision_1_name, properties.$geoip_city_name HAVING n>=2 ORDER BY 1 LIMIT 3000`);const valid=rows.filter(r=>r[0]&&Number.isFinite(+r[1])&&Number.isFinite(+r[2]));if(valid.length){const r=choose(day,'city',valid);city={name:r[0],lat:+r[1],lng:+r[2]};}}raw=JSON.stringify(city);await redis(['SET',`game:city:${day}`,raw,'EX','172800']);}p.city=JSON.parse(raw);if(!p.city){p.type='borders';p.fallback=true;}}
 return p;}
const languageNames='Afrikaans,Albanian,Amharic,Arabic,Armenian,Azerbaijani,Basque,Bengali,Bosnian,Bulgarian,Burmese,Catalan,Chinese,Croatian,Czech,Danish,Dutch,English,Estonian,Finnish,French,Georgian,German,Greek,Gujarati,Hausa,Hebrew,Hindi,Hungarian,Icelandic,Indonesian,Irish,Italian,Japanese,Kannada,Kazakh,Khmer,Korean,Latvian,Lithuanian,Macedonian,Malay,Malayalam,Marathi,Nepali,Norwegian,Persian,Polish,Portuguese,Punjabi,Romanian,Russian,Serbian,Slovak,Slovenian,Somali,Spanish,Swahili,Swedish,Tagalog,Tamil,Telugu,Thai,Turkish,Ukrainian,Urdu,Vietnamese,Welsh,Zulu'.split(',');
export function publicPuzzle(p,s){const end=s.done;let hint,options=[];const tries=s.history.length;
 if(p.type==='babel'||p.type==='combo'){hint=p.language.sentences.slice(0,Math.min(5,tries+1));options=p.type==='combo'&&s.stage===1?countries.map(c=>c.name):languageNames;}
 if(p.type==='borders')hint=p.country.shape;
 if(p.type==='borders')options=countries.map(c=>c.name);
 if(p.type==='bangle'){hint=[p.track.genre,p.artist.country,`first album: ${p.artist.decade}`,p.artist.name[0],p.track.title].slice(0,Math.min(5,tries+1));options=[...new Set(tracks.map(t=>t.artist).filter(Boolean))];}
 if(p.type==='flags'&&!end){const i=tries,r=p.rounds[i];hint=i%2?`${r.country.name} → capital`:String.fromCodePoint(...[...r.country.code].map(c=>127397+c.charCodeAt(0)));options=r.options;}
 const out={day:p.day,n:p.n,type:p.type,rotation:CYCLE,tomorrow:CYCLE[p.n%8],fallback:!!p.fallback,hint,options,lang:p.lang,history:s.history,done:!!s.done,solved:!!s.solved,elapsed:s.finishedAt?Math.round((s.finishedAt-s.started)/1000):0,cells:s.cells||[],stage:s.stage||0,streak:s.streak||0,deadline:s.deadline,light:s.cells?.length||0,max:p.type==='lantern'?3:p.type==='flags'?5:6};
 if(end){out.answer=p.type==='bangle'?p.artist.name:p.type==='wordle'||p.type==='lantern'?p.answer:p.type==='pingle'?p.city.name:p.type==='babel'?p.language.name:p.type==='combo'?`${p.language.name} · ${p.language.country}`:p.type==='flags'?`${s.correct||0}/5`:p.country.name;if(p.type==='bangle')out.music=`/music/?artist=${encodeURIComponent(p.artist.name)}`;if(p.type==='pingle')out.note=`someone from ${p.city.name} was here yesterday. the lantern saw them.`;}
 return out;}
export function applyGuess(p,s,value,now=Date.now()){if(s.done)return;const text=fold(value);let solved=false,feedback='',valid=true;const i=s.history.length;
 if(p.type==='wordle'){if(!/^[a-z]{5}$/.test(text))throw Error('enter five letters');feedback=wordFeedback(text,fold(p.answer));solved=text===fold(p.answer);}
 else if(p.type==='lantern'){solved=text===fold(p.answer);feedback=solved?'🟩':'⬛';}
 else if(p.type==='flags'){const r=p.rounds[i];if(!r.options.includes(value)&&value!=='__timeout')throw Error('choose an option');if(!s.deadline)throw Error('choose start first');solved=now<=s.deadline&&value===(i%2?r.country.capital:r.country.name);s.correct=(s.correct||0)+Number(solved);feedback=solved?'✅':'❌';}
 else if(p.type==='babel'||(p.type==='combo'&&!s.stage)){if(!languageNames.some(n=>fold(n)===text))throw Error('choose a language');solved=text===fold(p.language.name);const target=countries.find(c=>c.name===p.language.country),guess=languages.find(l=>fold(l.name)===text),loc=guess&&countries.find(c=>c.name===guess.country);const d=loc?distance(loc,target):null;feedback=solved?'🟩':`🟨 ${d?d.km<1500?'🔥':d.km<5000?'🌡':'🧊':'🧊'}`;if(!solved&&p.type==='babel')s.map={lat:target.lat,lng:target.lng};}
 else if(p.type==='bangle'){if(!tracks.some(t=>fold(t.artist)===text))throw Error('choose an artist from the collection');solved=text===fold(p.artist.name);feedback=solved?'🟩':'🟨';}
 else {let guess,target=p.type==='pingle'?p.city:p.type==='combo'?countries.find(c=>c.name===p.language.country):p.country;if(p.type==='pingle'){guess=value;if(!guess||!Number.isFinite(guess.lat)||!Number.isFinite(guess.lng)||Math.abs(guess.lat)>90||Math.abs(guess.lng)>180)throw Error('pick a point on the map');}else{guess=countries.find(c=>fold(c.name)===text);if(!guess)throw Error('choose a country');}const d=distance(guess,target);solved=p.type==='pingle'?d.km<=75:guess===target;feedback=solved?'🟩':`${d.proximity>80?'🟨':'⬛'} ${d.arrow} ${d.km} km · ${d.proximity}%`;}
 s.history.push({guess:typeof value==='string'?value:`${value.lat.toFixed(1)}, ${value.lng.toFixed(1)}`,feedback,stage:s.stage||0});
 if(p.type==='flags'){s.done=s.history.length===5;s.solved=s.done&&s.correct>=3;s.deadline=now+10000;}
 else if(p.type==='combo'){if(!s.stage&&(solved||s.history.length===3)){s.languageSolved=solved;s.stage=1;s.stageStart=s.history.length;}else if(s.stage){s.done=solved||s.history.length-s.stageStart>=3;s.solved=s.done&&solved&&s.languageSolved;}}
 else{s.done=solved||s.history.length>=(p.type==='lantern'?3:6);s.solved=solved;}
 return valid;}
async function save(key,s){await redis(['SET',key,JSON.stringify(s),'EX','172800']);}
export default async function game(req,res){res.setHeader('Cache-Control','no-store');if(!connected()||!secret())return res.status(503).json({error:'the puzzle is resting. try again soon.'});const day=dateKey();if(req.query.day&&req.query.day!==day)return res.status(404).json({error:'only today is open'});if(!['GET','POST'].includes(req.method))return res.status(405).end();let lock;
 try {if(!await rateLimit(`game:rate:${ipHash(req)}`,120,60))return res.status(429).json({error:'slow down a little'});if(req.method==='POST'&&(!req.headers.origin||new URL(req.headers.origin).host!==req.headers.host))return res.status(403).end();const vid=req.method==='POST'?readVoter(req):ensureVoter(req,res);if(!vid)return res.status(401).json({error:'open today’s puzzle first'});const key=`game:state:${day}:${vid}`;lock=`${key}:lock`;const token=crypto.randomBytes(12).toString('hex');if(!await redis(['SET',lock,token,'NX','EX','15']))return res.status(409).json({error:'a guess is already being checked'});lock={key:lock,token};const p=await puzzle(day);let s=JSON.parse(await redis(['GET',key])||'null')||{history:[],cells:[],started:Date.now(),deadline:null};
 if(req.method==='POST'){const body=typeof req.body==='string'?JSON.parse(req.body):req.body;if(!body||body.day!==day)return res.status(409).json({error:'a new day has begun. reload the puzzle.'});
 if(body.action==='start'){if(p.type!=='flags')return res.status(400).end();if(!s.deadline){s.started=Date.now();s.deadline=Date.now()+10000;await save(key,s);}return res.json(publicPuzzle(p,s));}
 if(body.action==='reveal'){if(p.type!=='lantern'||s.done)return res.status(400).end();const cell=Number(body.cell);if(!Number.isInteger(cell)||cell<0||cell>=100)return res.status(400).end();if(!s.cells.includes(cell))s.cells.push(cell);await save(key,s);const x=cell%10*40,y=Math.floor(cell/10)*24;const text=fold(p.answer);const img=await sharp(Buffer.from(`<svg width="400" height="240" xmlns="http://www.w3.org/2000/svg"><rect width="400" height="240" fill="#090909"/><text x="35" y="130" font-size="52" font-family="monospace" fill="#ffd76a">${text}</text></svg>`)).png().extract({left:x,top:y,width:40,height:24}).toBuffer();res.setHeader('Content-Type','image/png');return res.send(img);}
 if(s.done)return res.json(publicPuzzle(p,s));if(body.index!==s.history.length)return res.status(409).json({error:'refresh to restore your latest guess'});if(JSON.stringify(body.value??'').length>180)return res.status(400).end();const previous=s.history.length;
 if(body.value===undefined||(!body.value&&body.value!==0))return res.status(400).json({error:'enter a guess'});
 applyGuess(p,s,body.value);
 if(s.done){s.finishedAt=Date.now();const prev=JSON.parse(await redis(['GET',`game:streak:${vid}`])||'null');const yesterday=new Date(Date.parse(day)-86400000).toISOString().slice(0,10);s.streak=s.solved?(prev?.day===yesterday?prev.streak+1:1):0;}
 const transaction=`
 local old=redis.call('GET',KEYS[1])
 if old and #cjson.decode(old).history~=tonumber(ARGV[2]) then return 0 end
 redis.call('SET',KEYS[1],ARGV[1],'EX',172800)
 for i=2,4 do
 if tonumber(ARGV[2])==0 then redis.call('HINCRBY',KEYS[i],'played',1) end
 if ARGV[3]=='1' then
 redis.call('HINCRBY',KEYS[i],'finished',1)
 if ARGV[4]=='1' then redis.call('HINCRBY',KEYS[i],'solved',1);redis.call('HINCRBY',KEYS[i],'guess:'..ARGV[5],1) end
 end
 end
 if ARGV[3]=='1' then
 redis.call('SET',KEYS[5],ARGV[6],'EX',34560000)
 if tonumber(redis.call('GET',KEYS[6]) or '0')<tonumber(ARGV[7]) then redis.call('SET',KEYS[6],ARGV[7]) end
 end
 return 1`;
 const committed=await redis(['EVAL',transaction,'6',key,`games:day:${day}`,'games:all',`games:type:${p.type}`,`game:streak:${vid}`,'games:best',JSON.stringify(s),String(previous),s.done?'1':'0',s.solved?'1':'0',String(s.history.length),JSON.stringify({day,streak:s.streak||0}),String(s.streak||0)]);
 if(!Number(committed))return res.status(409).json({error:'refresh to restore your latest guess'});
 }
 await save(key,s);const result=publicPuzzle(p,s);if(s.map)result.map=s.map;return res.json(result);
 }catch(e){return res.status(/choose|enter|pick/.test(e.message)?400:503).json({error:/choose|enter|pick/.test(e.message)?e.message:'the lantern needs a moment. try again.'});}finally{if(lock?.token)await redis(['EVAL',"if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) end return 0",'1',lock.key,lock.token]).catch(()=>{});}}
