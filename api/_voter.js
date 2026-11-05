// Shared signed vid cookie. No identity or lead contents are kept in the cookie.
import crypto from 'node:crypto';
import {languageVoteSecret} from './_secrets.js';
const sign=id=>crypto.createHmac('sha256',languageVoteSecret()).update(id).digest('base64url');
export function readVoter(req){
 const m=/(?:^|;\s*)vid=([^;]+)/.exec(req.headers.cookie||'');if(!m)return null;
 const [id,sig]=m[1].split('.');if(!id||!sig)return null;const good=sign(id);
 return Buffer.byteLength(sig)===Buffer.byteLength(good)&&crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(good))?id:null;
}
export function ensureVoter(req,res){
 const known=readVoter(req);if(known)return known;
 const id=crypto.randomBytes(16).toString('base64url');
 res.setHeader('Set-Cookie',`vid=${id}.${sign(id)}; Path=/api; Max-Age=31536000; HttpOnly; Secure; SameSite=Strict`);return id;
}
