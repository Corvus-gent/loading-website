import crypto from 'node:crypto';
import {redis,pipeline} from '../_redis.js';
import {key as vkey} from '../_compound-v2/store.js';
export const RETENTION=90*86400;
export const key=part=>vkey('interviews:'+part);
export function fields(raw){
 const out={};for(const[k,max]of Object.entries({builder:80,project:100,description:220})){if(typeof raw[k]!=='string'||!raw[k].trim()||raw[k].length>max)throw Error('Fill in the builder, robot and one-line description.');out[k]=raw[k].trim().replace(/[\u0000-\u001f\u007f]/g,' ');}
 for(const[k,re]of [['x_handle',/^[A-Za-z0-9_]{1,15}$/],['ig_handle',/^[A-Za-z0-9_.]{1,30}$/]]){const value=String(raw[k]||'').trim().replace(/^@/,'');if(value&&!re.test(value))throw Error('Use a handle, without a profile URL.');out[k]=value;}
 out.clip_url='';if(raw.clip_url){let u;try{u=new URL(raw.clip_url);}catch{throw Error('Use a full HTTPS clip URL.');}if(u.protocol!=='https:'||u.username||u.password||u.href.length>1500||['localhost','127.0.0.1'].includes(u.hostname))throw Error('Use a public HTTPS clip URL.');out.clip_url=u.href;}
 if(raw.consent!==true)throw Error('Confirm that the builder agreed to be filmed and posted.');return out;
}
export async function list(){const ids=await redis(['ZREVRANGEBYSCORE',key('index'),'+inf',Date.now()-RETENTION*1000]);return ids.length?(await pipeline(ids.map(n=>['GET',key('record:'+n)]))).filter(Boolean).map(JSON.parse):[];}
export async function get(n){if(!/^[1-9]\d{0,3}$/.test(String(n)))return null;const raw=await redis(['GET',key('record:'+n)]);return raw?JSON.parse(raw):null;}
export function publicRow(row){return{n:row.n,title:'Interview #'+row.n+': '+row.project,builder:row.builder,project:row.project,description:row.description,x_handle:row.x_handle,ig_handle:row.ig_handle,clip_url:row.clip_url,photo_url:row.photo_url||'',url:'https://corvus.gent/hack/3?interview='+row.n+'#int-'+row.n,published_at:row.created_at,updated_at:row.updated_at,slug:row.slug};}
export async function save(raw,{photo_url,remove_photo=false}={}){
 const clean=fields(raw),now=new Date().toISOString(),n=raw.n?Number(raw.n):0;
 if(n&&(!Number.isInteger(n)||n<1||n>9999))throw Error('Invalid interview.');
 if(!n&&!/^[a-f0-9-]{36}$/.test(raw.request_id||''))throw Error('Reload the form and try again.');
 const hash=crypto.createHash('sha256').update(JSON.stringify({...clean,photo:raw.photo||'',remove_photo})).digest('hex');
 const data={...clean,photo_url:photo_url||'',consent:true,consent_at:now,created_at:now,created_ms:Date.now(),updated_at:now};
 const result=await redis(['EVAL',`
local n=tonumber(ARGV[1]);local row=cjson.decode(ARGV[2]);local previous=nil;local oldPhoto=''
if n==0 then
 local retry=redis.call('GET',KEYS[4]);if retry then local d=cjson.decode(retry);if d.hash~=ARGV[8] then return {-3,''} end;local existing=redis.call('GET',ARGV[3]..d.n);if not existing then return {-2,''} end;return {0,existing} end
 if redis.call('HLEN',KEYS[1])>=1000 then return {-4,''} end
 n=tonumber(redis.call('GET',KEYS[3]) or '0');for _,slug in ipairs(redis.call('HKEYS',KEYS[1])) do local x=tonumber(string.match(slug,'^x%-gm%-en%-int(%d+)$'));if x and x>n then n=x end end;n=n+1;if n>9999 then return {-4,''} end
 redis.call('SET',KEYS[3],n)
else
 local old=redis.call('GET',ARGV[3]..n);if not old then return {-2,''} end;previous=cjson.decode(old);if previous.updated_at~=ARGV[6] then return {-3,''} end
 row.created_at=previous.created_at;row.created_ms=previous.created_ms or tonumber(ARGV[5]);row.consent_at=previous.consent_at;oldPhoto=previous.photo_url or '';if ARGV[7]=='keep' then row.photo_url=oldPhoto end
end
row.n=n;row.slug='x-gm-en-int'..n
local videoRaw=redis.call('HGET',KEYS[1],row.slug);local video=videoRaw and cjson.decode(videoRaw) or {slug=row.slug,platform='x',account='gm',lang='en',hook='int',n=n,post_url='',compound_url='',views=0,likes=0,comments=0,shares=0,is_example=false,awaiting_url=true,metric_source='pending'}
video.interview_n=n;video.interview_clip_url=row.clip_url;video.updated_at=row.updated_at
local encoded=cjson.encode(row);redis.call('SET',ARGV[3]..n,encoded,'EX',ARGV[4]);redis.call('ZADD',KEYS[2],row.created_ms,n);redis.call('ZREMRANGEBYSCORE',KEYS[2],'-inf',tonumber(ARGV[5])-tonumber(ARGV[4])*1000);redis.call('EXPIRE',KEYS[2],ARGV[4]);redis.call('HSET',KEYS[1],row.slug,cjson.encode(video))
if ARGV[1]=='0' then redis.call('SET',KEYS[4],cjson.encode({n=n,hash=ARGV[8]}),'EX',86400) end
return {1,encoded,oldPhoto}`,4,vkey('videos'),key('index'),key('sequence'),key('retry:'+String(raw.request_id||n)),n,JSON.stringify(data),key('record:'),RETENTION,Date.now(),String(raw.updated_at||''),photo_url?'replace':remove_photo?'remove':'keep',hash]);
 const status=Number(result[0]);if(status<0)throw Error(status===-3?'This entry changed. Reload before saving.':status===-2?'Interview not found.':'The interview registry is full.');return{row:JSON.parse(result[1]),created:status===1,oldPhoto:result[2]||''};
}
export async function remove(n,updated_at){const old=await get(n);if(!old)throw Error('Interview not found.');const result=await redis(['EVAL',`local raw=redis.call('GET',KEYS[1]);if not raw then return 0 end;local old=cjson.decode(raw);if old.updated_at~=ARGV[2] then return -1 end;redis.call('DEL',KEYS[1]);redis.call('ZREM',KEYS[2],ARGV[1]);redis.call('HDEL',KEYS[3],old.slug);return 1`,3,key('record:'+n),key('index'),vkey('videos'),n,String(updated_at||'')]);if(Number(result)!==1)throw Error('This entry changed. Reload before deleting.');return old;}
