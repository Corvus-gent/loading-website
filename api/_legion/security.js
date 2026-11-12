import crypto from 'node:crypto';
import {redis} from '../_redis.js';
import {serverSecret,dailyIPHash,rateLimit} from '../_privacy.js';
import {safeEqual} from '../_session.js';
export const prefix=()=>process.env.LEGION_NAMESPACE||(process.env.VERCEL_ENV==='production'?'legion:v2:':'legion:preview:v2:');
export const key=s=>prefix()+s;
export const sha=v=>crypto.createHash('sha256').update(String(v)).digest('hex');
export const token=()=>crypto.randomBytes(32).toString('base64url');
export const validToken=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{43,128}$/.test(v);
export const clean=(v,max=300)=>typeof v==='string'?v.trim().replace(/[\x00-\x1f\x7f]/g,' ').slice(0,max):'';
export const limited=(req,scope,max=30,seconds=60)=>rateLimit(key('rate:'+scope+':'+dailyIPHash(req,'legion:'+scope)),max,seconds);
export function sameOrigin(req){return ['https://corvus.gent','https://www.corvus.gent',...['VERCEL_URL','VERCEL_BRANCH_URL'].map(k=>process.env[k]&&'https://'+process.env[k]),...(process.env.LEGION_TEST_ORIGIN?[process.env.LEGION_TEST_ORIGIN]:[])].includes(req.headers.origin);}
export function cookies(res,name,value,age){const prev=res.getHeader?.('Set-Cookie')||[];res.setHeader('Set-Cookie',[...(Array.isArray(prev)?prev:[prev]),`${name}=${value}; Path=/; Max-Age=${age}; HttpOnly; Secure; SameSite=Strict`]);}
const passwordStamp=()=>crypto.createHmac('sha256',serverSecret()).update('admin:'+process.env.ADMIN_PASSWORD).digest('hex');
export async function authorized(req){
 if(!process.env.ADMIN_PASSWORD)return false;
 const s=/(?:^|;\s*)corvus_admin=([^;]+)/.exec(req.headers.cookie||'')?.[1];if(!validToken(s))return false;
 const v=await redis(['GET',key('admin:'+sha(s))]);return v&&safeEqual(v,passwordStamp());
}
export async function login(req,res,password){
 if(!await limited(req,'login',5,900)||!await rateLimit(key('login-global'),100,900))throw Error('rate');
 if(!process.env.ADMIN_PASSWORD||!safeEqual(sha(password||''),sha(process.env.ADMIN_PASSWORD)))throw Error('unauthorized');
 const s=token();await redis(['SET',key('admin:'+sha(s)),passwordStamp(),'EX',28800]);cookies(res,'corvus_admin',s,28800);return {ok:true};
}
export async function logout(req,res){const s=/(?:^|;\s*)corvus_admin=([^;]+)/.exec(req.headers.cookie||'')?.[1];if(s)await redis(['DEL',key('admin:'+sha(s))]);cookies(res,'corvus_admin','',0);return {ok:true};}
export function csvCell(v){const s=String(v??'');return '"'+(/^[=+\-@\t\r]/.test(s)?"'":'')+s.replaceAll('"','""')+'"';}
