import crypto from 'node:crypto';
import {redis,pipeline} from '../_redis.js';
import {RETENTION,CATEGORIES,REACTIONS,QUICK_CHIPS,clean,source,attribution,validateCues,validateCutlist,TRANSITION_TAGS,validVersion,validatePoll,GOAL,DEADLINE,FUND_DEADLINE} from './model.js';
export const key=(...parts)=>(process.env.COMPOUND_KEY_PREFIX||'compound')+':'+parts.join(':');
const obj=a=>Array.isArray(a)?Object.fromEntries(Array.from({length:a.length/2},(_,i)=>[a[2*i],a[2*i+1]])):a||{};
const nums=a=>Object.fromEntries(Object.entries(obj(a)).map(([k,v])=>[k,Number(v)]));
export const get=async k=>{const raw=await redis(['GET',key(k)]);return raw?JSON.parse(raw):null;};
const normalVersion=v=>v?{...v,slot:v.slot||1,iteration:v.iteration||1,cues:Array.isArray(v.cues)?v.cues:[],transitions:Array.isArray(v.transitions)?v.transitions:[]}:null;
export async function version(id){if(!validVersion(id))return null;return normalVersion(await get('version:'+id));}
export async function versions(){const ids=await redis(['LRANGE',key('versions'),0,199])||[];if(!ids.length)return[];return (await redis(['MGET',...ids.map(id=>key('version',id))])).filter(Boolean).map(x=>normalVersion(JSON.parse(x)));}
export async function publish(data){
 let url;try{url=new URL(data.url);}catch{throw Error('video');}
 if(url.protocol!=='https:'||!url.hostname.endsWith('.public.blob.vercel-storage.com')||!url.pathname.startsWith('/compound/'))throw Error('video');
 if(!Number.isFinite(data.duration)||data.duration<=0||data.duration>600)throw Error('duration');
 const slot=Number(data.slot||1);if(![1,2,3].includes(slot))throw Error('slot');
 const record={slot,transitions:validateCutlist(data.cutlist||data.transitions||[],data.duration),url:url.href,label:clean(data.label,100),changelog:clean(data.changelog||data.label,600),duration:data.duration,width:Number(data.width)||720,height:Number(data.height)||1280,uploaded_at:new Date().toISOString(),cues:validateCues(data.cues||[],data.duration)};
 if(!record.label)throw Error('label');
 if(!Number(await redis(['HEXISTS',key('iterations'),slot]))){const old=(await versions()).filter(v=>v.slot===slot);await redis(['HSETNX',key('iterations'),slot,Math.max(old.length,...old.map(v=>v.iteration),0)]);}
 const script=`local n=redis.call('INCR',KEYS[1]);local id='v'..n;local v=cjson.decode(ARGV[1]);v.id=id;v.iteration=redis.call('HINCRBY',KEYS[5],tostring(v.slot),1);redis.call('HSET',KEYS[4],tostring(v.slot),id);redis.call('SET',ARGV[2]..id,cjson.encode(v));redis.call('LPUSH',KEYS[2],id);redis.call('SET',KEYS[3],id);return cjson.encode(v)`;
 return normalVersion(JSON.parse(await redis(['EVAL',script,5,key('sequence'),key('versions'),key('current_version'),key('slots'),key('iterations'),JSON.stringify(record),key('version')+':'])));
}
// Update only labels: stable transition IDs/times keep existing votes intact.
export async function renameItems(id,labels){
 if(!validVersion(id)||!Array.isArray(labels)||!labels.length||labels.length>120)throw Error('label');
 const v=await version(id);if(!v)throw Error('version');
 const seen=new Set(),safe=labels.map(item=>{const label=clean(item.label,100);if(!label||seen.has(item.id)||!v.transitions.some(t=>t.id===item.id))throw Error('label');seen.add(item.id);return{id:item.id,label};});
 const script=`local raw=redis.call('GET',KEYS[1]);if not raw then return nil end;local v=cjson.decode(raw);local labels=cjson.decode(ARGV[1]);for _,t in ipairs(v.transitions) do for _,l in ipairs(labels) do if t.id==l.id then t.label=l.label end end end;redis.call('SET',KEYS[1],cjson.encode(v),'KEEPTTL');return cjson.encode(v)`;
 return normalVersion(JSON.parse(await redis(['EVAL',script,1,key('version',id),JSON.stringify(safe)])));
}
export async function summary(id){
 const [history,current,poll,scoreRows,total,modeTotal,lateLive,lateTest,slots,revolut,standings]=await Promise.all([versions(),redis(['GET',key('current_version')]),get('live-poll'),redis(['ZREVRANGE',key('scores'),0,49,'WITHSCORES']),redis(['GET',key('fund','live')]),redis(['GET',key('fund','test')]),redis(['GET',key('fund-late','live')]),redis(['GET',key('fund-late','test')]),redis(['HGETALL',key('slots')]),get('revolut'),redis(['HGETALL',key('standings')])]);
 const selected=id==='none'?null:history.find(v=>v.id===id)||history.find(v=>v.id===current)||history[0]||null;
 const hashes=await pipeline([['HGETALL',key('global')],['HGETALL',key('prediction')],['HGETALL',key('stats',selected?.id||'none')],['HGETALL',key('heat',selected?.id||'none')]]);
 const people=scoreRows?.length?await redis(['MGET',...scoreRows.filter((_,i)=>i%2===0).map(uid=>key('helper',uid))]):[];const leaders=[];for(let i=0;i<people.length;i++){const person=people[i]?JSON.parse(people[i]):null;if(person?.handle&&!person.hidden&&leaders.length<10)leaders.push({handle:person.handle,score:Number(scoreRows[i*2+1])});}
 const mode=process.env.COMPOUND_STRIPE_MODE||(process.env.VERCEL_ENV==='production'?'live':'test');
 const slotIds=obj(slots);const cuts=[1,2,3].map(slot=>({slot,current:history.find(v=>v.id===slotIds[slot])||history.find(v=>v.slot===slot)||null,history:history.filter(v=>v.slot===slot)}));
 const rev=revolut?.[mode]||{total:0,late:0};
 const visible=[...new Set([...cuts.map(c=>c.current?.id),selected?.id].filter(Boolean))],metrics=await pipeline(visible.flatMap(id=>[['HGETALL',key('stats',id)],['HGETALL',key('heat',id)]]));
 const byVersion=Object.fromEntries(visible.map((id,i)=>[id,{stats:nums(metrics[i*2]),heat:nums(metrics[i*2+1])}]));
 return{cuts,byVersion,standings:nums(standings),current_version:current||null,versions:history,selected,global:nums(hashes[0]),prediction:nums(hashes[1]),stats:nums(hashes[2]),heat:nums(hashes[3]),helpers:leaders,livePoll:poll&&poll.expires>Date.now()?poll:null,fund:{revolut_url:revolut?.url||process.env.COMPOUND_REVOLUT_URL||null,revolut:rev.total||0,revolutLate:rev.late||0,stripe:Number(mode==='live'?total:modeTotal)||0,total:(Number(mode==='live'?total:modeTotal)||0)+(rev.total||0),late:(Number(mode==='live'?lateLive:lateTest)||0)+(rev.late||0),goal:GOAL,deadline:FUND_DEADLINE,mode,ready:Boolean(process.env[mode==='live'?'COMPOUND_PAYMENT_LINK_LIVE':'COMPOUND_PAYMENT_LINK_TEST'])},deadline:DEADLINE,updated:new Date().toISOString()};
}
export async function profile(uid,handle){const cleaned=clean(handle,60);if(cleaned&&!/^@?[a-zA-Z0-9_.\- ]{1,60}$/.test(cleaned))throw Error('handle');await redis(['SET',key('helper',uid),JSON.stringify({handle:cleaned}), 'EX',RETENTION]);const points=Number(await redis(['GET',key('score',uid)])||0);if(cleaned&&points)await redis(['ZADD',key('scores'),points,uid]);else await redis(['ZREM',key('scores'),uid]);return cleaned;}
async function score(uid,points){if(!uid||!points)return;const value=Number(await redis(['INCRBY',key('score',uid),points]));await redis(['EXPIRE',key('score',uid),RETENTION]);const person=await get('helper:'+uid);if(person?.handle&&!person.hidden)await pipeline([['ZADD',key('scores'),Math.max(0,value),uid],['EXPIRE',key('scores'),RETENTION]]);}
export async function event(name,versionId,raw,visitor,details={}){
 const a=attribution(raw),v=validVersion(versionId)?versionId:'none';
 const commands=[['HINCRBY',key('global'),name,1],['HINCRBY',key('stats',v),name,1],['HINCRBY',key('sources'),a.source+':'+name,1]];
 // Only bounded, validated metadata; never free text, contact details or full URLs.
 const safe={};if(visitor&&/^[a-f0-9-]{36}$/.test(details.visit||''))safe.visit=details.visit;for(const field of ['chip','choice','category','transition','tag','poll','option','type','t','percent','method','amount','opponent','winner'])if(details[field]!==undefined)safe[field]=typeof details[field]==='number'?details[field]:clean(details[field],60);
 if(visitor){const day=new Date().toISOString().slice(0,10),bucket=key('events',v,day),expiry=Math.floor(Date.parse(day+'T00:00:00Z')/1000)+RETENTION;commands.push(['LPUSH',bucket,JSON.stringify({event:name,version:v,visitor,...a,...safe,at:new Date().toISOString()})],['LTRIM',bucket,0,9999],['EXPIREAT',bucket,expiry]);}
 await pipeline(commands);await measure(name,v,a,safe.visit||visitor,safe);
}
// One bounded aggregate per first/last source + slug + content. Engagement is a
// distinct visit with feedback/play/CTA activity, not an event-count percentage.
async function measure(name,v,a,visitor,details){
 const engaged=!['view','link_click','donation_success','donation_refund'].includes(name);
 for(const touch of ['first','last']){
  const tags=a[touch]||a,group=JSON.stringify([touch,tags.source,tags.term||'',tags.content||'']);
  const id=crypto.createHash('sha256').update(group).digest('hex').slice(0,24),k=key('campaign',id);
  const commands=[['HSET',key('campaigns'),id,group],['EXPIRE',key('campaigns'),RETENTION],['EXPIRE',k,RETENTION]];
  const counts={};if(name==='view'){counts.visits=1;if(visitor)counts.linkedVisits=1;}if(name==='link_click')counts.clicks=1;
  if(['vote','category','transition','battle','pick','poll','prediction','quick'].includes(name))counts.votes=1;
  if(name==='army_join')counts.army=1;if(name==='donation_click')counts.donationClicks=1;
  if(name==='donation_success'){counts.donations=1;counts.cents=details.amount||0;}
  if(name==='donation_refund')counts.cents=-(details.amount||0);if(name==='donation_adjustment')counts.cents=details.amount||0;
  for(const [field,n]of Object.entries(counts))commands.unshift(['HINCRBY',k,field,n]);
  if(visitor){
   const session=key('engaged',id,visitor);
   if(engaged)commands.unshift(['EVAL',"if redis.call('SET',KEYS[1],'1','NX','EX',ARGV[1]) then redis.call('HINCRBY',KEYS[2],'engaged',1) end;return 1",2,session,k,RETENTION]);
   if(name==='play'||name.startsWith('watch:')){
    const percent=name==='play'?0:Number(name.split(':')[1]);
    commands.unshift(['EVAL',"local old=redis.call('GET',KEYS[1]);local n=tonumber(ARGV[1]);if not old then redis.call('HINCRBY',KEYS[2],'watchSamples',1) end;if not old or n>tonumber(old) then redis.call('SET',KEYS[1],n,'EX',ARGV[2]);redis.call('HINCRBY',KEYS[2],'watchSum',n-tonumber(old or '0')) end;return 1",2,key('watch',id,visitor,v),k,percent,RETENTION]);
   }
  }
  await pipeline(commands);
 }
}
export async function campaignStats(){
 const groups=obj(await redis(['HGETALL',key('campaigns')])),ids=Object.keys(groups);
 const values=await pipeline(ids.map(id=>['HGETALL',key('campaign',id)]));
 return ids.map((id,i)=>{const [touch,source,slug,content]=JSON.parse(groups[id]),n=nums(values[i]);return{touch,source,slug,content,...n,engagementRate:n.linkedVisits?Math.min(1,(n.engaged||0)/n.linkedVisits):0,avgWatch:n.watchSamples?(n.watchSum||0)/n.watchSamples:null};}).sort((a,b)=>b.engagementRate-a.engagementRate||(b.engaged||0)-(a.engaged||0));
}
export async function feedback(uid,v,data){
 const action=data.action;let field,choice,dedupe,points=1;
 if(action==='vote'){if(!['up','down'].includes(data.choice))throw Error('vote');field='vote:'+data.choice;choice=data.choice;dedupe='vote';}
 else if(action==='category'){if(!CATEGORIES.includes(data.category)||!['up','down'].includes(data.choice))throw Error('category');field='category:'+data.category+':'+data.choice;choice=data.choice;dedupe='category:'+data.category;}
 else throw Error('action');
 const script=`if not redis.call('SET',KEYS[1],ARGV[1],'EX',ARGV[2],'NX') then return 0 end;redis.call('HINCRBY',KEYS[2],ARGV[3],1);return 1`;
 const added=Number(await redis(['EVAL',script,2,key('done',v,uid,dedupe),key('stats',v),choice,RETENTION,field]));
 if(added){await score(uid,points);const why=clean(data.why,280);if(why)await saveText(uid,v,why,action==='category'?data.category:'vote',0);}
 return{added:!!added,choice:added?choice:await redis(['GET',key('done',v,uid,dedupe)])||choice};
}
export async function saveText(uid,v,value,category='idea',points=3){
 const text=clean(value,500);if(text.length<(category==='idea'?8:1))throw Error('text');
 const digest=crypto.createHash('sha256').update(text.toLowerCase()).digest('hex');
 if(!await redis(['SET',key('text-once',v,uid,digest),'1','EX',RETENTION,'NX']))return{added:false};
 const id=crypto.randomUUID(),p=await get('helper:'+uid),entry={id,version:v,text,category,handle:p?.handle||'anon',uid,at:new Date().toISOString(),hidden:false};
 await pipeline([['SET',key('text',id),JSON.stringify(entry),'EX',RETENTION],['LPUSH',key('texts',v),id],['LTRIM',key('texts',v),0,499],['EXPIRE',key('texts',v),RETENTION],['HINCRBY',key('stats',v),'texts',1]]);
 const eligible=points&&await redis(['SET',key('text-credit',v,uid),'1','EX',RETENTION,'NX']);if(eligible){await score(uid,points);entry.points=points;await redis(['SET',key('text',id),JSON.stringify(entry),'KEEPTTL']);}
 return{added:true,id};
}
export async function reaction(uid,v,type,t){
 if(!REACTIONS.includes(type))throw Error('reaction');
 const script="if not redis.call('SET',KEYS[1],'1','EX',ARGV[1],'NX') then return 0 end;redis.call('HINCRBY',KEYS[2],ARGV[2],1);return 1";
 return{added:!!Number(await redis(['EVAL',script,2,key('reaction-once',v,uid,t,type),key('heat',v),RETENTION,t+':'+type]))};
}
export async function pushPoll(v,data){const poll={id:'live-'+crypto.randomUUID(),version:v,...validatePoll(data),created:Date.now(),expires:Date.now()+120000};await redis(['SET',key('live-poll'),JSON.stringify(poll),'EX',120]);await pipeline([['SET',key('poll',poll.id),JSON.stringify(poll),'EX',RETENTION],['LPUSH',key('polls',v),poll.id],['LTRIM',key('polls',v),0,99],['EXPIRE',key('polls',v),RETENTION]]);return poll;}
export async function answer(uid,v,id,option){
 const record=await version(v);let poll=record?.cues?.find(c=>c.id===id);if(id.startsWith('live-')){poll=await get('poll:'+id);if((poll?.version!==v&&poll?.version!=='all')||poll.expires<Date.now())throw Error('poll expired');}
 if(!poll||!Number.isInteger(option)||option<0||option>=poll.options.length)throw Error('poll');
 const field='poll:'+id+':'+option;
 const script="if not redis.call('SET',KEYS[1],ARGV[1],'EX',ARGV[2],'NX') then return 0 end;redis.call('HINCRBY',KEYS[2],ARGV[3],1);return 1";
 return{added:!!Number(await redis(['EVAL',script,2,key('poll-once',poll.version==='all'?'all':v,id,uid),key('stats',v),option,RETENTION,field]))};
}
export async function predict(uid,data){
 if(!['yes','no'].includes(data.win)||!Number.isInteger(data.final)||data.final<1||data.final>999)throw Error('prediction');
 const value=JSON.stringify({win:data.win,final:data.final});
 const script=`if not redis.call('SET',KEYS[1],ARGV[1],'EX',ARGV[2],'NX') then return 0 end;redis.call('HINCRBY',KEYS[2],'win:'..ARGV[3],1);redis.call('HINCRBY',KEYS[2],'final:v'..ARGV[4],1);return 1`;
 return{added:!!Number(await redis(['EVAL',script,2,key('prediction',uid),key('prediction'),value,RETENTION,data.win,data.final]))};
}
export async function privateStats(v){
 const history=await versions();v=v||await redis(['GET',key('current_version')])||'none';const ids=await redis(['LRANGE',key('texts',v),0,199])||[];
 const texts=ids.length?(await redis(['MGET',...ids.map(id=>key('text',id))])).filter(Boolean).map(JSON.parse).filter(x=>!x.hidden).map(({uid,...x})=>x):[];
 const pollLists=await pipeline([['LRANGE',key('polls',v),0,99],['LRANGE',key('polls','all'),0,99]]),pollIds=[...new Set(pollLists.flat().filter(Boolean))];const livePolls=pollIds.length?(await redis(['MGET',...pollIds.map(id=>key('poll',id))])).filter(Boolean).map(JSON.parse):[];const polls=[...(history.find(x=>x.id===v)?.cues||[]),...livePolls];
 const stats=await pipeline(history.map(x=>['HGETALL',key('stats',x.id)]));
 return{...await summary(v),campaigns:await campaignStats(),polls,perVersion:history.map((x,i)=>({...x,stats:nums(stats[i])})),sources:nums(await redis(['HGETALL',key('sources')])),donations:nums(await redis(['HGETALL',key('donation-sources',process.env.COMPOUND_STRIPE_MODE||(process.env.VERCEL_ENV==='production'?'live':'test'))])),texts};
}

export async function hideText(id){const item=await get('text:'+id);if(!item)return false;if(!item.hidden){item.hidden=true;await redis(['SET',key('text',id),JSON.stringify(item),'KEEPTTL']);if(item.points)await score(item.uid,-item.points);}return true;}

export async function setRevolut(data){
 const mode=process.env.COMPOUND_STRIPE_MODE||(process.env.VERCEL_ENV==='production'?'live':'test');
 const total=Number(data.total),late=Number(data.late||0);
 if(!Number.isInteger(total)||total<0||total>10000000||!Number.isInteger(late)||late<0||late>10000000)throw Error('amount');
 let url='';if(data.url){try{const u=new URL(data.url);if(u.protocol!=='https:'||!['revolut.me','www.revolut.me'].includes(u.hostname)||u.username||u.password||u.pathname==='/')throw Error();url=u.href;}catch{throw Error('revolut link');}}
 const old=await get('revolut')||{},next={...old,url:url||old.url||process.env.COMPOUND_REVOLUT_URL||null,[mode]:{total,late,updated:new Date().toISOString()}};
 const before=JSON.parse(await redis(['EVAL',"local old=redis.call('GET',KEYS[1]);redis.call('SET',KEYS[1],ARGV[1]);return old or '{}'",1,key('revolut'),JSON.stringify(next)]));const delta=total+late-(before[mode]?.total||0)-(before[mode]?.late||0);if(delta)await event('donation_adjustment','none',data.attribution||{source:'other',content:'manual-revolut'},null,{method:'revolut',amount:delta});return next[mode];
}
export async function watched(uid,v){
 await pipeline([['SADD',key('watched',uid),v],['EXPIRE',key('watched',uid),RETENTION]]);
 return{watched:await redis(['SMEMBERS',key('watched',uid)])};
}
export async function duel(uid,data){
 const winner=await version(data.winner),other=data.action==='battle'?await version(data.opponent):null;
 if(!winner)throw Error('version');
 if(data.action==='battle'&&(!other||other.slot===winner.slot))throw Error('battle');
 const pool=data.action==='battle'?[winner.id,other.id].sort().join('-'):(await summary()).cuts.map(c=>c.current?.id||'none').join('-');
 const field=data.action+':'+winner.id;
 const script="if not redis.call('SET',KEYS[1],ARGV[1],'NX','EX',ARGV[2]) then return 0 end;redis.call('HINCRBY',KEYS[2],ARGV[3],1);return 1";
 const added=Number(await redis(['EVAL',script,2,key('duel',data.action,uid,pool),key('standings'),winner.id,RETENTION,field]));
 if(added)await score(uid,1);return{added:!!added,winner:added?winner.id:await redis(['GET',key('duel',data.action,uid,pool)])};
}
export async function transition(uid,v,data){
 const item=v.transitions.find(t=>t.id===data.transition);if(!item)throw Error('transition');
 if(data.action==='transition'){
  if(!['up','down'].includes(data.choice))throw Error('vote');
  const k=key('transition-once',v.id,uid,item.id);
  const added=Number(await redis(['EVAL',"if not redis.call('SET',KEYS[1],ARGV[1],'EX',ARGV[2],'NX') then return 0 end;redis.call('HINCRBY',KEYS[2],ARGV[3],1);return 1",2,k,key('stats',v.id),data.choice,RETENTION,'transition:'+item.id+':'+data.choice]));
  if(added)await score(uid,1);return{added:!!added,choice:added?data.choice:await redis(['GET',k])};
 }
 if(data.action==='transition_tag'){
  if(!TRANSITION_TAGS.includes(data.tag))throw Error('tag');
  return{added:!!Number(await redis(['EVAL',"if not redis.call('SET',KEYS[1],'1','EX',ARGV[1],'NX') then return 0 end;redis.call('HINCRBY',KEYS[2],ARGV[2],1);return 1",2,key('transition-tag',v.id,uid,item.id,data.tag),key('stats',v.id),RETENTION,'transition:'+item.id+':tag:'+data.tag]))};
 }
 if(clean(data.text,280).length<8)throw Error('text');return saveText(uid,v.id,data.text,'transition:'+item.id,3);
}

// Public notes are explicitly submitted to the wall. Historical private ideas stay private.
export async function quickNote(uid,v,data){
 const chip=data.chip||'note',text=clean(data.text,500);
 if(!QUICK_CHIPS.includes(chip))throw Error('chip');
 if(chip==='note'&&text.length<3)throw Error('text');
 const id=crypto.randomUUID(),entry={id,version:v,chip,category:'quick:'+chip,text,uid,points:1,at:new Date().toISOString(),hidden:false};
 const once=chip==='note'?crypto.createHash('sha256').update(text.toLowerCase()).digest('hex'):chip;
 const script="local old=redis.call('GET',KEYS[1]);if old then return old end;redis.call('SET',KEYS[1],ARGV[1],'EX',ARGV[3]);redis.call('SET',KEYS[2],ARGV[2],'EX',ARGV[3]);for i=3,4 do redis.call('LPUSH',KEYS[i],ARGV[1]);redis.call('LTRIM',KEYS[i],0,499);redis.call('EXPIRE',KEYS[i],ARGV[3]) end;redis.call('HINCRBY',KEYS[5],ARGV[4],1);return ARGV[1]";
 const saved=await redis(['EVAL',script,5,key('quick-once',v,uid,once),key('text',id),key('feedback'),key('texts',v),key('stats',v),id,JSON.stringify(entry),RETENTION,'quick:'+chip]);
 if(saved===id)await score(uid,1);
 return{added:saved===id,id:saved};
}
export async function noteText(uid,v,id,value){
 if(!/^[a-f0-9-]{36}$/.test(id||''))throw Error('text');
 const text=clean(value,500);if(text.length<3)throw Error('text');
 const script="local raw=redis.call('GET',KEYS[1]);if not raw then return 0 end;local n=cjson.decode(raw);if n.uid~=ARGV[1] or n.version~=ARGV[2] or n.hidden or not n.chip then return 0 end;n.text=ARGV[3];redis.call('SET',KEYS[1],cjson.encode(n),'KEEPTTL');return 1";
 const added=Number(await redis(['EVAL',script,1,key('text',id),uid,v,text]));
 if(!added)throw Error('text');
 if(await redis(['SET',key('text-credit',v,uid),'1','EX',RETENTION,'NX'])){
  const credited=Number(await redis(['EVAL',"local raw=redis.call('GET',KEYS[1]);if not raw then return 0 end;local n=cjson.decode(raw);if n.hidden then return 0 end;n.points=(n.points or 0)+3;redis.call('SET',KEYS[1],cjson.encode(n),'KEEPTTL');return 1",1,key('text',id)]));if(credited)await score(uid,3);
 }
 return{added:true,id};
}
export async function feedbackFeed(limit=5){
 const rows=[];
 for(let offset=0;offset<500&&rows.length<limit;offset+=20){
  const ids=await redis(['LRANGE',key('feedback'),offset,offset+19])||[];if(!ids.length)break;
  const batch=(await redis(['MGET',...ids.map(id=>key('text',id))])).filter(Boolean).map(JSON.parse).filter(n=>!n.hidden);
  rows.push(...batch.slice(0,limit-rows.length));if(ids.length<20)break;
 }
 if(!rows.length)return[];
 const people=await redis(['MGET',...rows.map(n=>key('helper',n.uid))]);
 return rows.map((n,i)=>{const p=people[i]?JSON.parse(people[i]):null;return{id:n.id,version:n.version,chip:n.chip,text:n.text,at:n.at,handle:p?.hidden?'anonymous soldier':p?.handle||'anonymous soldier'};});
}
