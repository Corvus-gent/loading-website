import {createHmac, randomUUID, timingSafeEqual} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {pageTier, tiers, tierPath, tasteSeconds} from '../../js/site/page-tiers.js';
import {sessionSecret} from '../_secrets.js';
import {redis} from '../_redis.js';
import {armyAuth} from '../_army/_auth.js';
import {army, get, isMember, memberRank} from './store.js';
import {key} from './security.js';
import {ACTION_LINKS,ACTION_STYLES} from '../../js/site/action-config.js';

const age = 90 * 86400;
const cookieName = 'corvus_layer';
const sign = value => createHmac('sha256', sessionSecret()).update('layer-v1:' + value).digest('base64url');
function readSession(req) {
  const value = /(?:^|;\s*)corvus_layer=([^;]+)/.exec(req.headers.cookie || '')?.[1] || '';
  const [data, signature] = value.split('.');
  if (data && data.length < 1000 && signature?.length === 43) {
    const expected = Buffer.from(sign(data)), actual = Buffer.from(signature);
    if (actual.length === expected.length && timingSafeEqual(actual, expected)) {
      try {
        const session = JSON.parse(Buffer.from(data, 'base64url').toString());
        if (session.exp > Date.now()) return session;
      } catch {}
    }
  }
  return {id:randomUUID(), tier:'visitor'};
}
function writeSession(res, session) {
  session.exp = Date.now() + age * 1000;
  const data = Buffer.from(JSON.stringify(session)).toString('base64url');
  const cookie = cookieName + '=' + data + '.' + sign(data) + '; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=' + age;
  res.setHeader('Set-Cookie', [].concat(res.getHeader('Set-Cookie') || [], cookie));
}
export function confirmEmail(req, res, subscriber) {
  const session = readSession(req);
  session.subscriber = subscriber;
  session.tier = 'email';
  writeSession(res, session);
}
export function memberTier(user) {
  if (!user || user.status === 'deleting') return 'visitor';
  if (isMember(user)) {
    const rank = memberRank(user);
    if (['legatus','praetor','senator','consul','imperator'].includes(rank)) return 'call';
    if (rank === 'centurio') return 'hacker';
    return 'soldier';
  }
  return user.verifiedAt ? 'email' : 'visitor';
}
async function currentTier(req, session) {
  const member = memberTier(await armyAuth(army()).session(req));
  if (member !== 'visitor') return member;
  return session.subscriber && (await get('subscriber:' + session.subscriber))?.status === 'confirmed' ? 'email' : 'visitor';
}
export function localDay(now, zone) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone:zone, year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hourCycle:'h23'
  }).formatToParts(now).map(p=>[p.type,p.value]));
  const midnight = Date.UTC(+parts.year, +parts.month - 1, +parts.day);
  return new Date(midnight - (Number(parts.hour)*60 + Number(parts.minute) < 242 ? 86400000 : 0)).toISOString().slice(0,10);
}
function validZone(value) {
  if (typeof value !== 'string' || value.length > 80) return false;
  try { localDay(Date.now(), value); return true; } catch { return false; }
}
// Bill the union of active intervals on all pages/tabs. The short lease expires
// automatically on disconnect. A normal hide or navigation stops it immediately.
const meterScript = `
local now, limit, lease = tonumber(ARGV[1]), tonumber(ARGV[2]), tonumber(ARGV[3])
local previous = redis.call('HMGET', KEYS[1], 'at', 'used')
local last = tonumber(previous[1]) or now
now = math.max(now, last)
local used = tonumber(previous[2]) or 0
local active = redis.call('ZREVRANGE', KEYS[2], 0, 0, 'WITHSCORES')
local untilTime = tonumber(active[2]) or last
used = math.min(limit, used + math.max(0, math.min(now, untilTime) - last))
redis.call('ZREMRANGEBYSCORE', KEYS[2], '-inf', now)
if ARGV[5] == 'pause' then redis.call('ZREM', KEYS[2], ARGV[4])
elseif used < limit then redis.call('ZADD', KEYS[2], now + math.min(lease, limit-used), ARGV[4]) end
redis.call('HSET', KEYS[1], 'at', now, 'used', used)
redis.call('EXPIRE', KEYS[1], 172800)
redis.call('EXPIRE', KEYS[2], 172800)
return limit-used`;
export function meter(id, zone, tab, operation, now = Date.now()) {
  const prefix = key('taste:{' + id + ':' + localDay(now,zone) + '}');
  return redis(['EVAL',meterScript,2,prefix,prefix+':tabs',now,tasteSeconds*1000,15000,tab,operation]);
}
function screen(res, status, text, body) {
  res.setHeader('Content-Type','text/html; charset=utf-8');
  return res.status(status).send('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+text+' | Corvus</title><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/css/site/shell.css">'+ACTION_STYLES+'<body>'+ACTION_LINKS+'<main class="site-page"><p class="site-eyebrow">corvus / legion</p><h1>'+text+'</h1>'+body+'</main><footer class="site-next site-quiet-footer"><a href="/"><img src="/logo.png" width="28" height="28" alt="Corvus home"></a><a href="/map/">map</a><a href="#lang-switcher">language</a><a href="/privacy/">privacy</a></footer><script type="module" src="/js/i18n/bar.js"></script></body></html>');
}
export async function layer(req, res, args, page = false) {
  res.setHeader('Cache-Control','private, no-store, max-age=0');
  res.setHeader('Vary','Cookie');
  const path = tierPath(args.path);
  if (!path) return res.status(404).end();
  const session = readSession(req), required = pageTier[path];
  session.tier = await currentTier(req, session);
  const admitted = tiers.indexOf(session.tier) >= tiers.indexOf(required);
  let timer = '';
  if (!admitted && required !== 'soldier') {
    writeSession(res,session);
    if (!page) return res.status(403).json({required});
    const action = required === 'email' ? '<a href="/daily/#signup">Confirm your email →</a>' : '<a href="/legion/">See the Legion ranks →</a>';
    return screen(res,403,'The '+required+' layer.',action+'<p><a href="/army/access/">Already a member? Sign in →</a></p>');
  }
  if (!admitted) {
    if (!session.zone && !validZone(args.zone)) {
      writeSession(res,session);
      if (!page) return res.status(409).json({reload:true});
      return screen(res,200,'Your daily taste.','<script src="/js/site/taste-zone.js"></script><noscript><p>The preview needs JavaScript to time your visit. <a href="/legion/">Enter the Legion →</a></p></noscript>');
    }
    // Pin the timezone to the server session, including old copies of signed cookies.
    if (!session.zone) {
      const zoneKey = key('taste-zone:'+session.id);
      await redis(['SET',zoneKey,args.zone,'NX','EX',age]);
      session.zone = await redis(['GET',zoneKey]);
    }
    const tab = page ? randomUUID() : args.tab;
    if (!/^[0-9a-f-]{36}$/.test(tab || '')) return res.status(400).json({error:'Invalid tab.'});
    const operation = !page && args.operation === 'pause' ? 'pause' : 'read';
    const remaining = Number(await meter(session.id,session.zone,tab,operation));
    writeSession(res,session);
    if (!page) return res.status(remaining ? 200 : 402).json({remaining});
    if (!remaining) return screen(res,402,'402 · payment required','<p>come back tomorrow or become a soldier</p><p>Your daily taste returns at 04:02 local time.</p><a href="/legion/">Become a soldier →</a>');
    const seconds = Math.ceil(remaining/1000);
    timer = '<aside class="layer-clock" data-tab="'+tab+'" data-remaining="'+remaining+'"><span>'+Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0')+'</span> · payment required</aside><script type="module" src="/js/site/taste.js"></script>';
  } else {
    writeSession(res,session);
    if (!page) return res.status(200).json({admitted:true});
  }
  const html = await readFile(process.cwd()+path+'/index.html','utf8');
  res.setHeader('Content-Type','text/html; charset=utf-8');
  return res.status(200).send(html.replace('</body>',timer+'</body>'));
}
