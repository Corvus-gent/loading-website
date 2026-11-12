import {createHmac, randomUUID} from 'node:crypto';
import {redis, pipeline} from '../_redis.js';
import {sessionSecret} from '../_secrets.js';
import {safeEqual} from '../_session.js';
import {key, token, sha} from './security.js';
import {sendMail} from './mail.js';
import {DAY, INTERVAL, ORIGIN, destinations, templates, enabled} from './re-engage-config.js';

// Read the existing signed email-layer cookie; never issue an identifier here.
export function subscriberSession(req, now = Date.now()) {
  const cookie = /(?:^|;\s*)corvus_layer=([^;]+)/.exec(req.headers.cookie || '')?.[1];
  if (!cookie || cookie.length > 1400) return null;
  const parts = cookie.split('.');
  if (parts.length !== 2) return null;
  const [data, signature] = parts;
  const expected = createHmac('sha256', sessionSecret()).update('layer-v1:' + data).digest('base64url');
  if (!safeEqual(signature, expected)) return null;
  try {
    const s = JSON.parse(Buffer.from(data, 'base64url').toString());
    return Number.isFinite(s.exp) && s.exp > now && /^[a-f0-9]{64}$/.test(s.subscriber || '') ? s.subscriber : null;
  } catch { return null; }
}
export async function recordVisit(req, body, now = Date.now()) {
  if (!enabled()) return;
  const hash = subscriberSession(req, now);
  if (!hash) return;
  const suppressed = body.suppress === true || req.headers.dnt === '1' || req.headers['sec-gpc'] === '1';
  const path = typeof body.path === 'string' ? body.path.replace(/\/+$/, '') || '/' : '';
  if (!suppressed && (!/^\/[a-z0-9/_-]{0,200}$/.test(path) || /^\/(?:api|admin|army|letters|clients)(?:\/|$)|^\/legion\/(?:edit|join)(?:\/|$)/.test(path))) return;
  const page = destinations.find(p => p.path.replace(/\/$/, '') === path)?.id || '';
  await redis(['EVAL', `local raw=redis.call('GET',KEYS[1]);if not raw then return 0 end
local s=cjson.decode(raw);if s.status~='confirmed' then return 0 end
local r=s.reengage or {};r.suppressed=ARGV[1]=='1'
if not r.suppressed then
 r.lastSeen=tonumber(ARGV[2]);r.stage=0;r.offered={};local seen=r.seen or {}
 if ARGV[3]~='' then local found=false;for _,v in ipairs(seen) do if v==ARGV[3] then found=true end end;if not found then table.insert(seen,ARGV[3]) end end
 r.seen=seen
end
s.reengage=r;redis.call('SET',KEYS[1],cjson.encode(s),'KEEPTTL');return 1`, 1, key('subscriber:' + hash), suppressed ? '1' : '0', now, page]);
}
export function candidate(s, observedFrom, now, cooldown = 0) {
  if (s.status !== 'confirmed' || !Number.isFinite(observedFrom)) return null;
  const r = s.reengage || {}, confirmed = Date.parse(s.confirmed_at);
  if (!Number.isFinite(confirmed) || r.suppressed) return null;
  const since = Math.max(confirmed, observedFrom, Number(r.lastSeen) || 0);
  if (now - Math.max(Number(r.lastAttempt) || 0, cooldown) < INTERVAL) return null;
  const template = templates.filter(t => now - since >= t.days * DAY).at(-1);
  if (!template || template.days <= (r.stage || 0)) return null;
  const seen = Array.isArray(r.seen) ? r.seen : [], offered = Array.isArray(r.offered) ? r.offered : [];
  const page = destinations.find(p => !seen.includes(p.id) && !offered.includes(p.id));
  return page ? {template, page, epoch:Number(r.lastSeen) || 0} : null;
}
const reserveScript = `local raw=redis.call('GET',KEYS[1]);if not raw then return 0 end
local s=cjson.decode(raw);if s.status~='confirmed' then return 0 end
local r=s.reengage or {};local now=tonumber(ARGV[1])
local previous=tonumber(redis.call('GET',KEYS[3])) or 0;if now-previous<tonumber(ARGV[5]) then return 0 end
if r.suppressed or (r.lastSeen or 0)~=tonumber(ARGV[2]) or (r.stage or 0)>=tonumber(ARGV[3]) then return 0 end
if r.lastAttempt and now-r.lastAttempt<tonumber(ARGV[5]) then return 0 end
for _,v in ipairs(r.seen or {}) do if v==ARGV[4] then return 0 end end
for _,v in ipairs(r.offered or {}) do if v==ARGV[4] then return 0 end end
local ttl=redis.call('TTL',KEYS[1]);if ttl==0 or ttl==-2 then return 0 end
r.lastAttempt=now;r.stage=tonumber(ARGV[3]);local offered=r.offered or {};table.insert(offered,ARGV[4]);r.offered=offered;s.reengage=r
redis.call('SET',KEYS[1],cjson.encode(s),'KEEPTTL')
redis.call('SET',KEYS[2],ARGV[6],'EX',ttl>0 and ttl or 31536000)
redis.call('SET',KEYS[3],ARGV[1],'PX',ARGV[5]);return 1`;

export async function runReengagement({now=Date.now(), send=sendMail, log=console.info, dryOffset=0} = {}) {
  const live = enabled(), lock = randomUUID();
  const summary = {dryRun:!live, scanned:0, candidates:0, attempted:0, sent:0, failed:0};
  if (live && !await redis(['SET',key('reengage:lock'),lock,'NX','EX',120])) return {...summary, busy:true};
  try {
    // Start a fresh observation window on activation: old lists are never backfilled.
    const previous = Number(await redis(['GET',key('reengage:last-run')])) || 0;
    const restarting = !previous || now - previous > 2 * DAY;
    if (live) {
      if (restarting) await redis(['SET',key('reengage:observed-from'),now]);
      await redis(['SET',key('reengage:last-run'),now]);
    }
    const observed = await redis(['GET',key('reengage:observed-from')]);
    const observedFrom = observed === null ? NaN : restarting ? now : Number(observed);
    const total = Number(await redis(['ZCARD',key('subscribers')]));
    const cursor = live ? Number(await redis(['GET',key('reengage:cursor')])) || 0 : dryOffset;
    const offset = cursor >= total ? 0 : cursor;
    const ids = await redis(['ZRANGE',key('subscribers'),offset,offset+99]);
    const rows = ids.length ? await pipeline(ids.flatMap(id => [['GET',key('subscriber:' + id)],['GET',key('reengage:cooldown:' + id)]])) : [];
    const pending = [];
    for (let i=0; i<ids.length; i++) {
      summary.scanned++;
      if (!rows[i*2]) continue;
      const s = JSON.parse(rows[i*2]), c = candidate(s, observedFrom, now, Number(rows[i*2+1]) || 0);
      if (!c) continue;
      summary.candidates++;
      if (!live) { log('reengage dry-run', {subscriber:ids[i].slice(0,12), days:c.template.days, path:c.page.path}); continue; }
      if (pending.length < 20) pending.push({hash:ids[i], s, c});
    }
    // Four workers bound a run to at most twenty provider calls (seven-second timeout).
    let index = 0;
    const workers = await Promise.allSettled(Array.from({length:4}, async () => {
      while (index < pending.length) {
        const {hash, s, c} = pending[index++], raw = token();
        const reserved = await redis(['EVAL',reserveScript,3,key('subscriber:' + hash),key('unsubscribe:' + sha(raw)),key('reengage:cooldown:' + hash),now,c.epoch,c.template.days,c.page.id,INTERVAL,hash]);
        if (!reserved) continue;
        summary.attempted++;
        // Unsubscribe or a return during reservation cancels this still-unsent letter.
        const latest = await redis(['GET',key('subscriber:' + hash)]);
        const current = latest && JSON.parse(latest);
        if (!current || current.status !== 'confirmed' || current.reengage?.suppressed || (Number(current.reengage?.lastSeen) || 0) !== c.epoch) continue;
        const unsubscribeUrl = ORIGIN + '/letters/unsubscribe/?token=' + raw;
        const text = c.template.text + '\n\n' + ORIGIN + c.page.path + '\n\n— the crow\nCorvus · occasional letters you confirmed.\nUnsubscribe: ' + unsubscribeUrl;
        let result;
        try { result = await send({to:s.email, subject:c.template.subject, text, unsubscribeUrl},'reengage-' + hash + '-' + now); } catch { result = {ok:false}; }
        if (result.ok) summary.sent++; else summary.failed++;
        // Keep the reservation even after timeout/failure: acceptance may be ambiguous.
      }
    }));
    if (workers.some(w => w.status === 'rejected')) throw Error('re-engagement storage unavailable');
    const nextOffset = offset + ids.length >= total ? 0 : offset + ids.length;
    if (live) await redis(['SET',key('reengage:cursor'),nextOffset]);
    return {...summary, observing:Number.isFinite(observedFrom), nextOffset};
  } finally {
    if (live) await redis(['EVAL',"if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) end;return 0",1,key('reengage:lock'),lock]);
  }
}
