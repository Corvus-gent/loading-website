import crypto from 'node:crypto';
import {redis} from '../_redis.js';
import {dailyIPHash} from '../_privacy.js';
import {safeEqual} from '../_session.js';
export const namespace=()=>process.env.NEST_NAMESPACE||(process.env.VERCEL_ENV==='production'?'nest:v1:':'nest:preview:v1:');
export const key=s=>namespace()+s;
export const budgetUnits=()=>{const n=Number(process.env.NEST_BUDGET_USD??3);return Number.isFinite(n)&&n>=0?Math.floor(n*1e6):0;};
export const isAdmin=req=>!!process.env.ADMIN_KEY&&safeEqual(String(req.headers['x-admin-key']||req.query?.admin||''),process.env.ADMIN_KEY);
// Integer microdollars. UTF-8 bytes overestimate text tokens, with overhead and 10% margin.
export const worstUnits=(messages,cap=6000)=>Math.ceil((Buffer.byteLength(JSON.stringify(messages))+1024)*.1+cap*.5)*1.1;
const RESERVE=`if redis.call('EXISTS',KEYS[4])==1 then return 'paused' end
if ARGV[4]~='1' and redis.call('EXISTS',KEYS[2])==1 then return 'daily' end
local used=tonumber(redis.call('GET',KEYS[1]) or '0');local amount=tonumber(ARGV[1]);if used+amount>tonumber(ARGV[2]) then return 'budget' end
redis.call('INCRBY',KEYS[1],amount);redis.call('SET',KEYS[3],amount,'EX',604800)
if ARGV[4]~='1' then redis.call('SET',KEYS[2],ARGV[3],'EX',172800) end;return 'ok'`;
export async function reserve(req,amount,kind='build',command=redis){
 amount=Math.ceil(amount);const id=crypto.randomBytes(16).toString('hex'),day=new Date().toISOString().slice(0,10),daily=key('daily:'+kind+':'+day+':'+dailyIPHash(req,'nest'));
 const status=await command(['EVAL',RESERVE,4,key('budget:used'),daily,key('reservation:'+id),key('paused'),amount,budgetUnits(),id,isAdmin(req)?1:0]);
 if(status!=='ok')throw Object.assign(Error(status),{public:true});return {id,amount,daily};
}
export async function settle(ticket,costUnits,command=redis){
 // Missing usage or an uncertain network result keeps the whole reservation.
 if(!Number.isFinite(costUnits)||costUnits<0)return;
 await command(['EVAL',`local a=redis.call('GET',KEYS[1]);if not a then return 0 end;local actual=math.ceil(tonumber(ARGV[1]));redis.call('INCRBY',KEYS[2],actual-tonumber(a));redis.call('DEL',KEYS[1]);return 1`,2,key('reservation:'+ticket.id),key('budget:used'),Math.ceil(costUnits)]);
}
export async function pause(seconds,command=redis){await command(['SET',key('paused'),'1','EX',seconds]);}
export async function budgetStatus(command=redis){const [used,paused]=await Promise.all([command(['GET',key('budget:used')]),command(['EXISTS',key('paused')])]);return {budget_usd:budgetUnits()/1e6,reserved_or_spent_usd:Number(used||0)/1e6,paused:!!Number(paused)};}
