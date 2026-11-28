import {createHmac, randomBytes, randomInt} from 'node:crypto';
import {sessionSecret} from './_secrets.js';
import {safeEqual} from './_session.js';
import {sendCode} from './_login-mail.js';
import {sendFormMail} from './_forms/mail.js';
import {readRecord, writeRecord} from './_week-store.js';

export const OWNER = 'gabriel@corvus.gent';
export const allowedOrigin = origin => ['https://admin.corvus.gent','https://corvus.gent'].includes(origin);
const digest = (purpose, value) => createHmac('sha256',sessionSecret()).update('week:' + purpose + ':' + value).digest('hex');
const COOKIE = '__Host-corvus-week';
const sessionId = req => (req.headers.cookie || '').split(';').map(v => v.trim()).find(v => v.startsWith(COOKIE+'='))?.slice(COOKIE.length + 1);
const setCookie = (res, value, age) => res.setHeader('Set-Cookie', COOKIE+'='+value+'; Path=/; Max-Age='+age+'; Secure; HttpOnly; SameSite=Strict');
const matches = (state, id) => /^[a-f0-9]{64}$/.test(id || '') && state?.sessions.some(s => s.until > Date.now() && safeEqual(s.hash,digest('session',id)));
export async function hasWeekSession(req) {
  const id = sessionId(req);
  if (!id || !/^[a-f0-9]{64}$/.test(id)) return false;
  return Boolean(matches((await readRecord('owner')).data,id));
}

async function change(update) {
  for (let i = 0; i < 4; i++) {
    const {data, etag} = await readRecord('owner');
    const now = Date.now(), state = data || {requests:[],sessions:[],otp:null};
    state.sessions = state.sessions.filter(s => s.until > now);
    state.requests = state.requests.filter(n => n > now - 15 * 60000);
    const result = update(state,now);
    if (!result.write || await writeRecord('owner',state,etag)) return result.status;
  }
  return 409;
}

export default async function weekAuth(req, res) {
  res.setHeader('Cache-Control','no-store');
  if (req.method === 'GET') return res.status(200).json({email:await hasWeekSession(req) ? OWNER : null});
  if (req.method !== 'POST') { res.setHeader('Allow','GET, POST'); return res.status(405).end(); }
  if (!allowedOrigin(req.headers.origin)) return res.status(403).end();
  if (req.headers['content-type']?.split(';')[0] !== 'application/json') return res.status(415).end();
  const {action,email,code} = req.body || {};
  if (action === 'logout') {
    const id = sessionId(req);
    if (id) {
      const status = await change(state => {
        if (!matches(state,id)) return {status:200};
        state.sessions = state.sessions.filter(s => !safeEqual(s.hash,digest('session',id)));
        return {write:true,status:200};
      });
      if (status !== 200) return res.status(status).end();
    }
    setCookie(res,'',0); return res.status(200).json({ok:true});
  }
  if (action === 'request') {
    if (email !== OWNER) return res.status(200).json({ok:true});
    const otp = String(randomInt(1000000)).padStart(6,'0');
    const status = await change((state,now) => {
      if (state.requests.length >= 3) return {status:429};
      state.requests.push(now);
      state.otp = {until:now+180000, tries:0, hash:digest('otp',otp)};
      return {write:true,status:200};
    });
    if (status !== 200) return res.status(status).end();
    try { await sendCode(OWNER,otp); }
    catch { await sendFormMail({subject:'Je inlogcode voor de Corvus-weekeditor',text:'Je code is '+otp+'. Geldig gedurende drie minuten.'}); }
    return res.status(200).json({ok:true});
  }
  if (action !== 'verify' || email !== OWNER || typeof code !== 'string' || !/^\d{6}$/.test(code)) return res.status(400).end();
  const id = randomBytes(32).toString('hex');
  const status = await change((state,now) => {
    if (!state.otp || state.otp.until <= now) return {status:400};
    if (!safeEqual(state.otp.hash,digest('otp',code))) {
      if (++state.otp.tries >= 3) state.otp = null;
      return {write:true,status:400};
    }
    state.otp = null;
    state.sessions.push({hash:digest('session',id),until:now+7*86400000});
    return {write:true,status:200};
  });
  if (status !== 200) return res.status(status).end();
  setCookie(res,id,7*86400);
  return res.status(200).json({email:OWNER,ok:true});
}
