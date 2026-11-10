import {redis} from '../_redis.js';
import {key} from './security.js';
export async function sendMail({to,subject,text},id){
 if(process.env.LEGION_TEST_MAIL==='1')return {ok:true,test:true};
 if(!process.env.RESEND_API_KEY)return {ok:false};
 const day=new Date().toISOString().slice(0,10);
 const count=Number(await redis(['EVAL',"local n=redis.call('INCR',KEYS[1]);if n==1 then redis.call('EXPIRE',KEYS[1],86400) end;return n",1,key('mail:'+day)]));if(count>80)return {ok:false};
 try{const r=await fetch('https://api.resend.com/emails',{method:'POST',signal:AbortSignal.timeout(7000),headers:{Authorization:'Bearer '+process.env.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':'legion-'+id},body:JSON.stringify({from:'Corvus <crow@corvus.gent>',to:[to],subject,text})});return {ok:r.ok};}catch{return {ok:false};}
}
