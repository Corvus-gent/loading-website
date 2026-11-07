import crypto from 'node:crypto';
import {serverSecret,dailyIPHash,rateLimit} from '../_privacy.js';
import {ensureVoter} from '../_voter.js';
export const equal=(a,b)=>typeof a==='string'&&typeof b==='string'&&Buffer.byteLength(a)===Buffer.byteLength(b)&&crypto.timingSafeEqual(Buffer.from(a),Buffer.from(b));
const secret=()=>process.env.COMPOUND_AUTH_SECRET||serverSecret();
const sign=v=>crypto.createHmac('sha256',secret()).update('compound:'+v).digest('base64url');
export function identity(req,res){return sign('voter:'+ensureVoter(req,res));}
export function sameOrigin(req){
 const origins=['https://corvus.gent','https://www.corvus.gent',...['VERCEL_URL','VERCEL_BRANCH_URL'].map(k=>process.env[k]&&'https://'+process.env[k])];
 if(process.env.NODE_ENV!=='production')origins.push('http://127.0.0.1:4201');
 return origins.includes(req.headers.origin);
}
export async function limit(req,kind,max=60,seconds=60){return rateLimit('compound:rate:'+kind+':'+dailyIPHash(req,'compound-'+kind),max,seconds);}
export function authorized(req,role='stats'){
 const bearer=String(req.headers.authorization||'').replace(/^Bearer /,'');
 if(process.env.COMPOUND_ADMIN_PASSWORD&&equal(bearer,process.env.COMPOUND_ADMIN_PASSWORD))return true;
 const match=/(?:^|;\s*)compound_auth=([^;]+)/.exec(req.headers.cookie||'');if(!match)return false;
 const [body,sig]=match[1].split('.');if(!body||!equal(sig,sign(body)))return false;
 try{const s=JSON.parse(Buffer.from(body,'base64url').toString());return s.exp>Date.now()&&s.exp<Date.now()+4*3600000+1000&&(s.role==='admin'||s.role===role);}catch{return false;}
}
export function login(res,role,password){
 const expected=role==='admin'?process.env.COMPOUND_ADMIN_PASSWORD:process.env.COMPOUND_STATS_PASSWORD;
 if(!expected||!equal(password,expected))return false;
 const body=Buffer.from(JSON.stringify({role,exp:Date.now()+4*3600000,nonce:crypto.randomBytes(12).toString('hex')})).toString('base64url');
 res.setHeader('Set-Cookie',`compound_auth=${body}.${sign(body)}; Path=/api/compound; Max-Age=14400; HttpOnly; Secure; SameSite=Strict`);return true;
}
