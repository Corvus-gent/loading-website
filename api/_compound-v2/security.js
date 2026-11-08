import crypto from 'node:crypto';
import {serverSecret,dailyIPHash,rateLimit} from '../_privacy.js';
import {equal,identity} from '../_compound/security.js';
export {identity};
const secret=()=>process.env.COMPOUND_V2_ADMIN_PASSWORD||process.env.COMPOUND_ADMIN_PASSWORD;
const sign=x=>crypto.createHmac('sha256',serverSecret()).update('compound-v2:'+x+':'+secret()).digest('base64url');
export function authorized(req){
 if(!secret())return false;
 const bearer=String(req.headers.authorization||'').replace(/^Bearer /,'');if(equal(bearer,secret()))return true;
 const raw=/(?:^|;\s*)compound_v2_admin=([^;]+)/.exec(req.headers.cookie||'')?.[1];if(!raw)return false;
 const parts=raw.split('.');if(parts.length!==3||!/^\d{13}$/.test(parts[0])||!equal(parts[2],sign(parts[0]+'.'+parts[1])))return false;
 return Number(parts[0])>Date.now()&&Number(parts[0])<=Date.now()+14401000;
}
export function login(res,password){if(!secret()||!equal(password,secret()))return false;const value=(Date.now()+14400000)+'.'+crypto.randomBytes(12).toString('hex');res.setHeader('Set-Cookie',`compound_v2_admin=${value}.${sign(value)}; Path=/api; Max-Age=14400; HttpOnly; Secure; SameSite=Strict`);return true;}
export function logout(res){res.setHeader('Set-Cookie','compound_v2_admin=; Path=/api; Max-Age=0; HttpOnly; Secure; SameSite=Strict');}
export function sameOrigin(req){return['https://corvus.gent','https://www.corvus.gent',...['VERCEL_URL','VERCEL_BRANCH_URL','VERCEL_PROJECT_PRODUCTION_URL'].map(k=>process.env[k]&&'https://'+process.env[k]),...(process.env.NODE_ENV!=='production'?['http://127.0.0.1:4420']:[])].includes(req.headers.origin);}
export const prefix=process.env.COMPOUND_V2_PREFIX||(process.env.VERCEL_ENV==='production'?'compound:v2':'compound:v2:preview');
export const limit=(req,kind,max=100,seconds=60)=>rateLimit(prefix+':rate:'+kind+':'+dailyIPHash(req,'compound-v2-'+kind),max,seconds);
export function analytics(body,req){const enabled=(body.analytics===true||body.analytics==='session')&&req.headers['sec-gpc']!=='1'&&req.headers.dnt!=='1';return{enabled,visitor:enabled&&/^[a-f0-9-]{36}$/.test(body.visitor||'')?body.visitor:null};}
