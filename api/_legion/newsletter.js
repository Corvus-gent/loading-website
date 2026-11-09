import {redis,pipeline} from '../_redis.js';
import {normalizeEmail} from '../../js/army/domain.js';
import {key,sha,token,validToken} from './security.js';
import {get,put,now} from './store.js';
import {sendMail} from './mail.js';
export async function subscribe(email,origin='https://corvus.gent'){
 email=normalizeEmail(email);const hash=sha(email),existing=await get('subscriber:'+hash);if(existing?.status==='confirmed')return {ok:true,message:'Check your inbox. If needed, the crow sent a confirmation.'};
 const allowed=await redis(['SET',key('subscribe-cooldown:'+hash),'1','NX','EX',3600]);if(!allowed)return {ok:true,message:'Check your inbox. If needed, the crow sent a confirmation.'};
 const raw=token(),unsubscribe=token();
 await put('subscriber:'+hash,{email,status:'pending',created_at:existing?.created_at||now(),confirmation:sha(raw),unsubscribe:sha(unsubscribe)},172800);
 await redis(['SET',key('confirm:'+sha(raw)),hash,'EX',172800]);await redis(['SET',key('unsubscribe:'+sha(unsubscribe)),hash,'EX',366*86400]);await redis(['ZADD',key('subscribers'),Date.now(),hash]);
 const sent=await sendMail({to:email,subject:'one small signal from the crow',text:'You asked for occasional Corvus transmissions. Confirm here:\n\n'+origin+'/letters/confirm/?token='+raw+'\n\nNo confirmation, no transmissions. This link expires in 48 hours.\n\nChanged your mind? '+origin+'/letters/unsubscribe/?token='+unsubscribe+'\n\nCorvus · gabriel@corvus.gent'},'confirm-'+sha(raw));
 if(!sent.ok){await redis(['DEL',key('subscribe-cooldown:'+hash)]);throw Error('mail');}
 return {ok:true,message:'Check your inbox. Confirm once to hear from the crow.'};
}
export async function confirm(raw){if(!validToken(raw))throw Error('expired');const result=await redis(['EVAL',`local h=redis.call('GET',KEYS[1]);if not h then return 0 end;local k=ARGV[1]..h;local s=redis.call('GET',k);if not s then return 0 end;local r=cjson.decode(s);if r.confirmation~=ARGV[2] then return 0 end;r.status='confirmed';r.confirmed_at=ARGV[3];r.confirmation=nil;redis.call('SET',k,cjson.encode(r),'EX',31536000);redis.call('DEL',KEYS[1]);return 1`,1,key('confirm:'+sha(raw)),key('subscriber:'),sha(raw),now()]);if(!result)throw Error('expired');return {ok:true,message:'Confirmed. The crow will write when there is something worth saying.'};}
export async function unsubscribe(raw){if(!validToken(raw))return {ok:true};const hash=await redis(['GET',key('unsubscribe:'+sha(raw))]);if(hash){await redis(['DEL',key('subscriber:'+hash),key('unsubscribe:'+sha(raw)),key('subscribe-cooldown:'+hash)]);await redis(['ZREM',key('subscribers'),hash]);}return {ok:true,message:'Unsubscribed. The crow is quiet.'};}
export async function subscribers(){const ids=await redis(['ZREVRANGE',key('subscribers'),0,9999]);const rows=ids.length?await pipeline(ids.map(h=>['GET',key('subscriber:'+h)])):[];return rows.filter(Boolean).map(JSON.parse).map(({email,status,created_at,confirmed_at})=>({email,status,created_at,confirmed_at}));}
