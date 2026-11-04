#!/usr/bin/env node
// One-way, non-destructive-to-source Redis copy. No keys/values/credentials are logged.
import {createClient} from 'redis';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {secureEndpoint} from '../api/_redis.js';

const SNAPSHOT=`local ttl=redis.call('PTTL',KEYS[1]); if ttl==-2 then return nil end
local value=redis.call('DUMP',KEYS[1]); if not value then return nil end
local now=redis.call('TIME'); local expires=0
if ttl>=0 then expires=tonumber(now[1])*1000+math.floor(tonumber(now[2])/1000)+ttl end
return {redis.call('TYPE',KEYS[1]).ok,value,expires}`;
const hash=b=>createHash('sha256').update(b).digest('hex');
const cmd=(client,args)=>client.sendCommand(args,{returnBuffers:true});
const integer=x=>Number(Buffer.isBuffer(x)?x.toString():x);
function endpoint(raw){
 secureEndpoint(raw);const u=new URL(raw);
 if(u.search||u.hash)throw Error('unsupported URL options');
 const db=u.pathname.replace(/^\//,'')||'0';if(!/^\d+$/.test(db))throw Error('invalid database');
 return `${u.hostname.toLowerCase()}:${u.port||'6379'}/${Number(db)}`;
}
async function* scan(client){
 let cursor='0';const seen=new Set();
 do {const [next,keys]=await cmd(client,['SCAN',cursor,'COUNT','200']);cursor=String(next);
  for(const key of keys){const id=hash(key);if(!seen.has(id)){seen.add(id);yield key;}}
 }while(cursor!=='0');
}
async function snapshot(client,key){
 const row=await cmd(client,['EVAL',SNAPSHOT,'1',key]);
 return row?{type:String(row[0]),value:row[1],expires:integer(row[2])}:null;
}
async function content(client,key,snap){
 // RDB bytes of unordered collections can differ after RESTORE despite equal data.
 let rows;
 if(snap.type==='hash'){
  rows=await cmd(client,['HGETALL',key]);const pairs=[];
  for(let i=0;i<rows.length;i+=2)pairs.push([rows[i].toString('base64'),rows[i+1].toString('base64')]);
  pairs.sort((a,b)=>a[0].localeCompare(b[0]));return hash(JSON.stringify(pairs));
 }
 if(snap.type==='set'){rows=await cmd(client,['SMEMBERS',key]);return hash(JSON.stringify(rows.map(x=>x.toString('base64')).sort()));}
 if(snap.type==='list')rows=await cmd(client,['LRANGE',key,'0','-1']);
 if(snap.type==='zset')rows=await cmd(client,['ZRANGE',key,'0','-1','WITHSCORES']);
 if(rows)return hash(JSON.stringify(rows.map(x=>x.toString('base64'))));
 if(snap.type==='string')return hash(await cmd(client,['GET',key])||Buffer.alloc(0));
 // Streams/modules use their serialized representation, including group metadata.
 return hash(snap.value);
}
export async function compareDatabases(source,target){
 const result={checked:0,missing:0,extra:0,valueMismatch:0,expiryMismatch:0,expiredDuringCheck:0};
 const sourceKeys=new Map(),targetKeys=new Map();
 for await(const key of scan(source))sourceKeys.set(hash(key),key);
 for await(const key of scan(target))targetKeys.set(hash(key),key);
 for(const [id,key]of new Map([...sourceKeys,...targetKeys])){
  let a=await snapshot(source,key),b=await snapshot(target,key);
  // Allow a key to expire between reads; never treat an actual lost key as expiry.
  if(a&&!b){a=await snapshot(source,key);if(!a){result.expiredDuringCheck++;continue;}}
  if(!a&&b){b=await snapshot(target,key);if(!b){result.expiredDuringCheck++;continue;}}
  if(!a&&!b)continue;
  if(!a){result.extra++;continue;}if(!b){result.missing++;continue;}
  result.checked++;
  if(a.type!==b.type || (!a.value.equals(b.value) && await content(source,key,a)!==await content(target,key,b)))result.valueMismatch++;
  if((a.expires===0)!==(b.expires===0)||Math.abs(a.expires-b.expires)>5)result.expiryMismatch++;
 }
 result.sourceCount=integer(await cmd(source,['DBSIZE']));result.targetCount=integer(await cmd(target,['DBSIZE']));
 result.countsMatch=result.sourceCount===result.targetCount;
 result.ok=result.countsMatch&&!result.missing&&!result.extra&&!result.valueMismatch&&!result.expiryMismatch;
 return result;
}
export async function migrateRedis({sourceURL,targetURL,dryRun=true,verifyOnly=false,resume=false,sourcePaused=false}){
 if(!sourceURL||!targetURL)throw Error('both URLs required');
 if(endpoint(sourceURL)===endpoint(targetURL))throw Error('same database');
 if(!dryRun&&!verifyOnly&&!sourcePaused)throw Error('pause source writers first');
 const clients=[sourceURL,targetURL].map(url=>createClient({url,socket:{connectTimeout:10000,reconnectStrategy:false}}).on('error',()=>{}));
 const [source,target]=clients;
 try {
  await source.connect();await target.connect();
  // Catch aliases of the same server where INFO is available, without exposing it.
  const infos=await Promise.allSettled(clients.map(c=>cmd(c,['INFO','server'])));
  if(infos.every(r=>r.status==='fulfilled')){
   const ids=infos.map(r=>/^run_id:(.+)$/m.exec(String(r.value))?.[1].trim());
   if(ids[0]&&ids[0]===ids[1]&&endpoint(sourceURL).split('/').at(-1)===endpoint(targetURL).split('/').at(-1))throw Error('same database alias');
  }
  const report={dryRun,verifyOnly,sourceBefore:integer(await cmd(source,['DBSIZE'])),targetBefore:integer(await cmd(target,['DBSIZE'])),scanned:0,copied:0,expired:0,bytes:0,types:{}};
  if(verifyOnly)return {...report,verification:await compareDatabases(source,target)};
  if(report.targetBefore&&!resume)throw Error('destination must be empty; use resume only for this migration');
  for await(const key of scan(source)){
   const data=await snapshot(source,key);if(!data){report.expired++;continue;}
   report.scanned++;report.bytes+=data.value.length;report.types[data.type]=(report.types[data.type]||0)+1;
   if(dryRun)continue;
   const restore=['RESTORE',key,String(data.expires),data.value,'ABSTTL'];if(resume)restore.push('REPLACE');
   await cmd(target,restore);report.copied++;
  }
  report.sourceAfter=integer(await cmd(source,['DBSIZE']));report.targetAfter=integer(await cmd(target,['DBSIZE']));
  report.verification=dryRun?null:await compareDatabases(source,target);
  return report;
 }finally{await Promise.allSettled(clients.filter(c=>c.isOpen).map(c=>c.disconnect()));}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const args=process.argv.slice(2),allowed=['--dry-run','--apply','--verify','--resume','--source-paused'];
 try{
  if(args.some(a=>!allowed.includes(a))||['--dry-run','--apply','--verify'].filter(a=>args.includes(a)).length>1)throw Error('arguments');
  const report=await migrateRedis({sourceURL:process.env.OLD_REDIS_URL,targetURL:process.env.NEW_REDIS_URL,dryRun:!args.includes('--apply')&&!args.includes('--verify'),verifyOnly:args.includes('--verify'),resume:args.includes('--resume'),sourcePaused:args.includes('--source-paused')});
  console.log(JSON.stringify(report,null,2));
  if(report.verification&&!report.verification.ok){console.error('Verification differs. Keep traffic paused; do not switch databases. Values and keys are intentionally omitted.');process.exitCode=2;}
 }catch{
  console.error('Migration stopped. Check OLD_REDIS_URL/NEW_REDIS_URL (TLS), distinct databases, empty destination (or deliberate --resume), --source-paused for --apply, and DUMP/RESTORE ABSTTL compatibility. Source was not modified. No keys, values or credentials logged. A partial target can be resumed while writers remain paused.');process.exitCode=1;
 }
}
