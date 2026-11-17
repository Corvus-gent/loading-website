import {sendTransactional, emailConfigured} from '../../lib/email/send.js';
import {redis} from '../_redis.js';
import {key} from './security.js';
export async function sendMail({to,subject,text},id){
 if(process.env.LEGION_TEST_MAIL==='1')return {ok:true,test:true};
 if(!emailConfigured())return {ok:false,skipped:true};
 const day=new Date().toISOString().slice(0,10);
 const count=Number(await redis(['EVAL',"local n=redis.call('INCR',KEYS[1]);if n==1 then redis.call('EXPIRE',KEYS[1],86400) end;return n",1,key('mail:'+day)]));if(count>80)return {ok:false};
 try{const r=await sendTransactional({to:[to],subject,text},{idempotencyKey:'legion-'+id});return {ok:r.ok};}catch{return {ok:false};}
}
