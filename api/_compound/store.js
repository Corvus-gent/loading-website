import crypto from 'node:crypto';
import {redis,pipeline} from '../_redis.js';
import {RETENTION,CATEGORIES,REACTIONS,clean,source,attribution,validateCues,validVersion,validatePoll,GOAL,DEADLINE,FUND_DEADLINE} from './model.js';
export const key=(...parts)=>(process.env.COMPOUND_KEY_PREFIX||'compound')+':'+parts.join(':');
const obj=a=>Array.isArray(a)?Object.fromEntries(Array.from({length:a.length/2},(_,i)=>[a[2*i],a[2*i+1]])):a||{};
const nums=a=>Object.fromEntries(Object.entries(obj(a)).map(([k,v])=>[k,Number(v)]));
export const get=async k=>{const raw=await redis(['GET',key(k)]);return raw?JSON.parse(raw):null;};
const normalVersion=v=>v?{...v,cues:Array.isArray(v.cues)?v.cues:[]}:null;
export async function version(id){if(!validVersion(id))return null;return normalVersion(await get('version:'+id));}
export async function versions(){const ids=await redis(['LRANGE',key('versions'),0,199])||[];if(!ids.length)return[];return (await redis(['MGET',...ids.map(id=>key('version',id))])).filter(Boolean).map(x=>normalVersion(JSON.parse(x)));}
export async function publish(data){
 let url;try{url=new URL(data.url);}catch{throw Error('video');}
 if(url.protocol!=='https:'||!url.hostname.endsWith('.public.blob.vercel-storage.com')||!url.pathname.startsWith('/compound/'))throw Error('video');
 if(!Number.isFinite(data.duration)||data.duration<=0||data.duration>600)throw Error('duration');
 const record={url:url.href,label:clean(data.label,100),changelog:clean(data.changelog||data.label,600),duration:data.duration,width:Number(data.width)||720,height:Number(data.height)||1280,uploaded_at:new Date().toISOString(),cues:validateCues(data.cues||[],data.duration)};
 if(!record.label)throw Error('label');
 const script=`local n=redis.call('INCR',KEYS[1]);local id='v'..n;local v=cjson.decode(ARGV[1]);v.id=id;redis.call('SET',ARGV[2]..id,cjson.encode(v));redis.call('LPUSH',KEYS[2],id);redis.call('SET',KEYS[3],id);return cjson.encode(v)`;
 return normalVersion(JSON.parse(await redis(['EVAL',script,3,key('sequence'),key('versions'),key('current_version'),JSON.stringify(record),key('version')+':'])));
}
export async function summary(id){
 const [history,current,poll,scoreRows,total,modeTotal]=await Promise.all([versions(),redis(['GET',key('current_version')]),get('live-poll'),redis(['ZREVRANGE',key('scores'),0,49,'WITHSCORES']),redis(['GET',key('fund','live')]),redis(['GET',key('fund','test')])]);
 const selected=id==='none'?null:history.find(v=>v.id===id)||history.find(v=>v.id===current)||history[0]||null;
 const hashes=await pipeline([['HGETALL',key('global')],['HGETALL',key('prediction')],['HGETALL',key('stats',selected?.id||'none')],['HGETALL',key('heat',selected?.id||'none')]]);
 const people=scoreRows?.length?await redis(['MGET',...scoreRows.filter((_,i)=>i%2===0).map(uid=>key('helper',uid))]):[];const leaders=[];for(let i=0;i<people.length;i++){const person=people[i]?JSON.parse(people[i]):null;if(person?.handle&&!person.hidden&&leaders.length<10)leaders.push({handle:person.handle,score:Number(scoreRows[i*2+1])});}
 const mode=process.env.COMPOUND_STRIPE_MODE||(process.env.VERCEL_ENV==='production'?'live':'test');
 return{current_version:current||null,versions:history,selected,global:nums(hashes[0]),prediction:nums(hashes[1]),stats:nums(hashes[2]),heat:nums(hashes[3]),helpers:leaders,livePoll:poll&&poll.expires>Date.now()?poll:null,fund:{total:Number(mode==='live'?total:modeTotal)||0,goal:GOAL,deadline:FUND_DEADLINE,mode,ready:Boolean(process.env[mode==='live'?'COMPOUND_PAYMENT_LINK_LIVE':'COMPOUND_PAYMENT_LINK_TEST'])},deadline:DEADLINE,updated:new Date().toISOString()};
}
export async function profile(uid,handle){const cleaned=clean(handle,60);if(cleaned&&!/^@?[a-zA-Z0-9_.\- ]{1,60}$/.test(cleaned))throw Error('handle');await redis(['SET',key('helper',uid),JSON.stringify({handle:cleaned}), 'EX',RETENTION]);return cleaned;}
async function score(uid,points){if(!uid||!points)return;await pipeline([['ZINCRBY',key('scores'),points,uid],['EXPIRE',key('scores'),RETENTION]]);}
export async function event(name,versionId,raw,visitor){
 const a=attribution(raw),v=validVersion(versionId)?versionId:'none';
 const commands=[['HINCRBY',key('global'),name,1],['HINCRBY',key('stats',v),name,1],['HINCRBY',key('sources'),a.source+':'+name,1]];
 if(visitor){commands.push(['LPUSH',key('events',v),JSON.stringify({event:name,version:v,visitor,...a,at:new Date().toISOString()})],['LTRIM',key('events',v),0,9999],['EXPIRE',key('events',v),RETENTION]);}
 await pipeline(commands);
}
export async function feedback(uid,v,data){
 const action=data.action;let field,choice,dedupe,points=1;
 if(action==='vote'){if(!['up','down'].includes(data.choice))throw Error('vote');field='vote:'+data.choice;choice=data.choice;dedupe='vote';}
 else if(action==='category'){if(!CATEGORIES.includes(data.category)||!['up','down'].includes(data.choice))throw Error('category');field='category:'+data.category+':'+data.choice;choice=data.choice;dedupe='category:'+data.category;}
 else throw Error('action');
 const script=`if not redis.call('SET',KEYS[1],ARGV[1],'EX',ARGV[2],'NX') then return 0 end;redis.call('HINCRBY',KEYS[2],ARGV[3],1);return 1`;
 const added=Number(await redis(['EVAL',script,2,key('done',v,uid,dedupe),key('stats',v),choice,RETENTION,field]));
 if(added){await score(uid,points);const why=clean(data.why,280);if(why)await saveText(uid,v,why,action==='category'?data.category:'vote',0);}
 return{added:!!added};
}
export async function saveText(uid,v,value,category='idea',points=3){
 const text=clean(value,500);if(text.length<(category==='idea'?8:1))throw Error('text');
 const digest=crypto.createHash('sha256').update(text.toLowerCase()).digest('hex');
 if(!await redis(['SET',key('text-once',v,uid,digest),'1','EX',RETENTION,'NX']))return{added:false};
 const id=crypto.randomUUID(),p=await get('helper:'+uid),entry={id,version:v,text,category,handle:p?.handle||'anon',uid,at:new Date().toISOString(),hidden:false};
 await pipeline([['SET',key('text',id),JSON.stringify(entry),'EX',RETENTION],['LPUSH',key('texts',v),id],['LTRIM',key('texts',v),0,499],['EXPIRE',key('texts',v),RETENTION],['HINCRBY',key('stats',v),'texts',1]]);
 const eligible=points&&await redis(['SET',key('text-credit',v,uid),'1','EX',RETENTION,'NX']);if(eligible)await score(uid,points);
 return{added:true,id};
}
export async function reaction(uid,v,type,t){
 if(!REACTIONS.includes(type))throw Error('reaction');
 const script="if not redis.call('SET',KEYS[1],'1','EX',ARGV[1],'NX') then return 0 end;redis.call('HINCRBY',KEYS[2],ARGV[2],1);return 1";
 return{added:!!Number(await redis(['EVAL',script,2,key('reaction-once',v,uid,t,type),key('heat',v),RETENTION,t+':'+type]))};
}
export async function pushPoll(v,data){const poll={id:'live-'+crypto.randomUUID(),version:v,...validatePoll(data),created:Date.now(),expires:Date.now()+120000};await redis(['SET',key('live-poll'),JSON.stringify(poll),'EX',120]);await pipeline([['SET',key('poll',poll.id),JSON.stringify(poll),'EX',RETENTION],['LPUSH',key('polls',v),poll.id],['LTRIM',key('polls',v),0,99],['EXPIRE',key('polls',v),RETENTION]]);return poll;}
export async function answer(uid,v,id,option){
 const record=await version(v);let poll=record?.cues?.find(c=>c.id===id);if(id.startsWith('live-')){poll=await get('poll:'+id);if(poll?.version!==v||poll.expires<Date.now())throw Error('poll expired');}
 if(!poll||!Number.isInteger(option)||option<0||option>=poll.options.length)throw Error('poll');
 const field='poll:'+id+':'+option;
 const script="if not redis.call('SET',KEYS[1],ARGV[1],'EX',ARGV[2],'NX') then return 0 end;redis.call('HINCRBY',KEYS[2],ARGV[3],1);return 1";
 return{added:!!Number(await redis(['EVAL',script,2,key('poll-once',v,id,uid),key('stats',v),option,RETENTION,field]))};
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
 const pollIds=await redis(['LRANGE',key('polls',v),0,99])||[];const livePolls=pollIds.length?(await redis(['MGET',...pollIds.map(id=>key('poll',id))])).filter(Boolean).map(JSON.parse):[];const polls=[...(history.find(x=>x.id===v)?.cues||[]),...livePolls];
 const stats=await pipeline(history.map(x=>['HGETALL',key('stats',x.id)]));
 return{...await summary(v),polls,perVersion:history.map((x,i)=>({...x,stats:nums(stats[i])})),sources:nums(await redis(['HGETALL',key('sources')])),donations:nums(await redis(['HGETALL',key('donation-sources',process.env.COMPOUND_STRIPE_MODE||(process.env.VERCEL_ENV==='production'?'live':'test'))])),texts};
}
