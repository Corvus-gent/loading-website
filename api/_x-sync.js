import {randomUUID} from 'node:crypto';
import {aggregate,rowFromPage,clickQuery} from './_x-data.js';
import {notionClient,validateSchema,uuid,SyncError} from './_x-notion.js';
export const XKEY={cache:'x:public:v1',stale:'x:public:last:v1',catalog:'x:campaigns:v1',manifest:'x:private:v1',job:'x:job:v1',lock:'x:lock:v1',start:'x:start:v1',error:'x:error:v1'};
const RETENTION=86400,CHUNK=50;
const chunkKey=(id,n)=>`x:rows:v1:${id}:${n}`;
const clickKey=(id,n)=>`x:clicks:v1:${id}:${n}`;
const unlock=`if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) else return 0 end`;
const renew=`if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('EXPIRE',KEYS[1],ARGV[2]) else return 0 end`;
const parse=raw=>raw?JSON.parse(raw):null;
export function createXSync({redis,hogql,database=process.env.NOTION_XLOG_DB,now=Date.now,makeNotion=options=>notionClient(options),enqueue,continueJob=async()=>{},budgetMs=45000,sleep=ms=>new Promise(r=>setTimeout(r,ms))}={}){
 const get=async key=>parse(await redis(['GET',key]));
 const set=(key,value,ttl=RETENTION)=>redis(['SET',key,JSON.stringify(value),'EX',String(ttl)]);
 const save=job=>set(XKEY.job,job);
 async function chunks(id,count,clicks=false){const result=[];for(let i=0;i<count;i++){const part=await get(clicks?clickKey(id,i):chunkKey(id,i));if(!part)throw new SyncError('snapshot_expired');result.push(...part);}return result;}
 async function publish(job){
  const pub=await get(`x:result:v1:${job.id}`);if(!pub)throw new SyncError('snapshot_expired');
  await set(XKEY.cache,pub,900);await set(XKEY.stale,pub);
  await set(XKEY.catalog,job.campaigns||[],900);
 }
 async function step(job,notion){
  if(job.stage==='discover'){
   if(!uuid(database))throw new SyncError('notion_configuration');
   const db=await notion(`databases/${database}`),sources=db.data_sources||[];
   if(sources.length!==1||!uuid(sources[0].id))throw new SyncError('notion_data_source');
   const schema=await notion(`data_sources/${sources[0].id}`);validateSchema(schema.properties);
   job.source=sources[0].id;job.stage='read';await save(job);return;
  }
  if(job.stage==='read'){
   const page=await notion(`data_sources/${job.source}/query`,'POST',{page_size:100,sorts:[{timestamp:'created_time',direction:'ascending'}],...(job.cursor?{start_cursor:job.cursor}:{})});
   if(!Array.isArray(page.results)||page.has_more&&!page.next_cursor)throw new SyncError('notion_pagination');
   const rows=page.results.filter(p=>!p.archived&&!p.in_trash).map(rowFromPage);
   for(let i=0;i<rows.length;i+=CHUNK){await set(chunkKey(job.id,job.chunks),rows.slice(i,i+CHUNK));job.chunks++;}
   job.cursor=page.next_cursor||null;if(!page.has_more)job.stage='clicks';await save(job);return;
  }
  if(job.stage==='clicks'){
   const rows=await hogql(clickQuery(job.started,job.clickOffset));
   if(!Array.isArray(rows))throw new SyncError('posthog_unavailable');
   await set(clickKey(job.id,job.clickChunks),rows);job.clickChunks++;job.clickOffset+=rows.length;
   if(rows.length<1000)job.stage='aggregate';await save(job);return;
  }
  if(job.stage==='aggregate'){
   const rows=await chunks(job.id,job.chunks),clicks=await chunks(job.id,job.clickChunks,true);
   const data=aggregate(rows,clicks,job.started);job.campaigns=data.campaigns;
   for(let i=0;i<job.chunks;i++)await set(chunkKey(job.id,i),data.rows.slice(i*CHUNK,(i+1)*CHUNK));
   await set(`x:result:v1:${job.id}`,data.public);
   const previous=await get(XKEY.manifest);
   await set(XKEY.manifest,{id:job.id,chunks:job.chunks,total:data.rows.length,updated:job.started});
   await publish(job);
   // Remove the previous private snapshot once its replacement is complete.
   if(previous&&previous.id!==job.id)for(let i=0;i<previous.chunks;i++)await redis(['DEL',chunkKey(previous.id,i)]);
   job.stage='write';job.writeChunk=0;job.writeRow=0;await save(job);return;
  }
  if(job.stage==='write'){
   if(job.writeChunk>=job.chunks){job.stage='done';await save(job);return;}
   const rows=await get(chunkKey(job.id,job.writeChunk));if(!rows)throw new SyncError('snapshot_expired');
   const r=rows[job.writeRow];
   if(!r){job.writeChunk++;job.writeRow=0;await save(job);return;}
   const changed=r.valid&&(!r.saved.synced_at||r.saved.clicks===null||Math.abs(r.saved.clicks-r.clicks)>1e-8||r.saved.clicks_pidgy===null||Math.abs(r.saved.clicks_pidgy-r.clicks_pidgy)>1e-8||r.saved.estimated!==r.estimated);
   if(changed){
    if(!uuid(r.id))throw new SyncError('notion_page');
    const syncedAt=new Date(now()).toISOString();
    await notion(`pages/${r.id}`,'PATCH',{properties:{clicks:{number:r.clicks},clicks_pidgy:{number:r.clicks_pidgy},clicks_estimated:{checkbox:r.estimated},synced_at:{date:{start:syncedAt}}}});
    r.saved={clicks:r.clicks,clicks_pidgy:r.clicks_pidgy,estimated:r.estimated,synced_at:syncedAt};await set(chunkKey(job.id,job.writeChunk),rows);job.written++;
   }
   job.writeRow++;await save(job);return;
  }
 }
 async function work(job,token){
  const deadline=now()+budgetMs,notion=makeNotion({now,deadline,sleep});let resume=false;
  try{
   if(job.notBefore>now())await sleep(Math.min(job.notBefore-now(),Math.max(0,budgetMs-13000)));
   while((!job.notBefore||now()>=job.notBefore)&&job.stage!=='done'&&now()<deadline-12000){
    if(!await redis(['EVAL',renew,'1',XKEY.lock,token,'270']))return;
    await step(job,notion);
   }
   if(job.stage==='done'){
    await publish(job);await redis(['DEL',XKEY.job,XKEY.error]);
    for(let i=0;i<job.clickChunks;i++)await redis(['DEL',clickKey(job.id,i)]);
   }else resume=true;
  }catch(error){
   if(error.code==='yield'){job.notBefore=error.retryAt||now();await save(job);resume=true;}
   else {
    await set(XKEY.error,{code:error instanceof SyncError?error.code:'sync_failed',at:new Date(now()).toISOString()},900).catch(()=>{});
    // A removed page or changed schema must not trap the next day's jobs on
    // an obsolete cursor. Transient failures keep their resumable checkpoint.
    if(['notion_access','notion_schema','notion_configuration','notion_data_source','notion_pagination','snapshot_expired'].includes(error.code))await redis(['DEL',XKEY.job]);
   }
  }finally{
   await redis(['EVAL',unlock,'1',XKEY.lock,token]).catch(()=>{});
  }
  if(resume)await continueJob().catch(()=>{});
 }
 async function kick({continuation=false}={}){
  const token=randomUUID();if(!await redis(['SET',XKEY.lock,token,'NX','EX','270']))return {state:'syncing'};
  try{
   if(await get(XKEY.error)){await redis(['EVAL',unlock,'1',XKEY.lock,token]);return {state:'unavailable',retryAfter:Math.max(1,Number(await redis(['TTL',XKEY.error])))};}
   let job=await get(XKEY.job);
   if(!job){
    if(continuation){await redis(['EVAL',unlock,'1',XKEY.lock,token]);return {state:'idle'};}
    if(!await redis(['SET',XKEY.start,'1','NX','EX','900'])){await redis(['EVAL',unlock,'1',XKEY.lock,token]);return {state:'cooldown',retryAfter:Math.max(1,Number(await redis(['TTL',XKEY.start])))};}
    job={id:randomUUID(),started:new Date(now()).toISOString(),stage:'discover',cursor:null,chunks:0,clickOffset:0,clickChunks:0,written:0};await save(job);
   }
   enqueue(work(job,token));return {state:'syncing'};
  }catch(error){await redis(['EVAL',unlock,'1',XKEY.lock,token]).catch(()=>{});throw error;}
 }
 async function privatePage({date='',voice='',region='',page=1}={}){
  let manifest=await get(XKEY.manifest);const error=await get(XKEY.error),job=await get(XKEY.job);
  if(!manifest)return {ready:true,rows:[],total:0,page:1,pages:0,updated:null,state:job?'syncing':'empty',error:error?.code||null};
  let rows;
  try{rows=await chunks(manifest.id,manifest.chunks);}catch(error){
   const latest=await get(XKEY.manifest);
   if(error.code!=='snapshot_expired'||!latest||latest.id===manifest.id)throw error;
   manifest=latest;rows=await chunks(manifest.id,manifest.chunks);
  }
  const voices=[...new Set(rows.map(r=>r.voice))].sort();
  rows=rows.filter(r=>(!date||r.date===date)&&(!voice||r.voice===voice)&&(!region||r.region===region)).sort((a,b)=>b.date.localeCompare(a.date)||(b.hour||0)-(a.hour||0)||a.id.localeCompare(b.id));
  const pages=Math.ceil(rows.length/50);page=Math.max(1,Math.min(pages||1,Number(page)||1));
  return {ready:true,rows:rows.slice((page-1)*50,page*50).map(({saved,...r})=>({...r,synced_at:saved.synced_at})),total:rows.length,page,pages,voices,updated:manifest.updated,state:job?'syncing':'idle',written:job?.written||0,error:error?.code||null};
 }
 return {kick,privatePage,get,ttl:key=>redis(['TTL',key])};
}
