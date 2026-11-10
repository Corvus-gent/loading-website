import crypto from 'node:crypto';
import {redis as defaultRedis} from '../_redis.js';
import {digest, id, recruitCode, namespace, validID} from './_security.js';
import {DAY, RETENTION, dayKey, weekKey, application, points, publicSoldier, FEATHERS, dailyMission, missionReward} from '../../js/army/domain.js';

export function armyStore({redis = defaultRedis, now = Date.now, prefix = namespace()} = {}) {
  const key = suffix => prefix + suffix;
  const run = args => redis(args.map(String));
  const timestamp = () => new Date(now()).toISOString();
  const get = async suffix => { const raw = await run(['GET', key(suffix)]); return raw ? JSON.parse(raw) : null; };
  const normalize = user => user ? {...user, feathers: Array.isArray(user.feathers) ? user.feathers : []} : null;
  const getUser = async uid => validID(uid) ? normalize(await get('u:' + uid)) : null;
  const ttl = user => Math.max(1, Math.ceil((Date.parse(user.expires) - now()) / 1000));
  async function own(uid, suffix, value, seconds) {
    const owner = await getUser(uid); if (!owner || owner.status === 'deleting') throw Error('session');
    seconds = Math.min(seconds, ttl(owner));
    const k = key(suffix), registry = key('owned:' + uid);
    const written=await run(['EVAL', `local owner=redis.call('GET',KEYS[3]);if not owner or cjson.decode(owner).status=='deleting' then return 0 end;for _,k in ipairs(redis.call('SRANDMEMBER',KEYS[2],8)) do if redis.call('EXISTS',k)==0 then redis.call('SREM',KEYS[2],k) end end;redis.call('SET',KEYS[1],ARGV[1],'EX',ARGV[2]);redis.call('SADD',KEYS[2],KEYS[1]);redis.call('EXPIRE',KEYS[2],ARGV[3]);return 1`, 3, k, registry, key('u:'+uid), JSON.stringify(value), seconds, Math.max(seconds, 367 * DAY)]);
    if(!Number(written))throw Error('session');
    return value;
  }
  async function lock(uid, fn, seconds = 15) {
    const token = id(), k = key('lock:' + uid);
    if (!await run(['SET', k, token, 'NX', 'EX', seconds])) throw Error('busy');
    try { return await fn(); } finally { await run(['EVAL', "if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) end return 0", 1, k, token]); }
  }
  async function persist(user) {
    const seconds = ttl(user), registry = key('owned:' + user.id);
    const fields = [['u:' + user.id, user], ['code:' + user.code, user.id]];
    if (user.username) fields.push(['name:' + user.username, user.id]);
    if (user.email) fields.push(['email:' + digest(user.email), user.id]);
    const commands = fields.flatMap(([suffix, value]) => [key(suffix), JSON.stringify(value)]);
    await run(['EVAL', `for i=1,#ARGV-4,2 do redis.call('SET',ARGV[i],ARGV[i+1],'EX',ARGV[#ARGV-3]);redis.call('SADD',KEYS[1],ARGV[i]) end
redis.call('EXPIRE',KEYS[1],ARGV[#ARGV-2]);redis.call('ZADD',KEYS[2],ARGV[#ARGV-1],ARGV[#ARGV]);return 1`, 2, registry, key('users'), ...commands, seconds, 367 * DAY, Date.parse(user.expires), user.id]);
    await run(['INCR', key('revision')]);
    await run(['DEL', key('public'), key('legion')]);
    return user;
  }
  async function create({country = null, existingBrowser = false} = {}) {
    const uid = id(), code = recruitCode(), created = timestamp();
    const reserved = await run(['SET', key('code:' + code), JSON.stringify(uid), 'NX', 'EX', RETENTION.anonymous * DAY]);
    if (!reserved) return create({country, existingBrowser});
    return persist({id: uid, code, created, expires: new Date(now() + RETENTION.anonymous * DAY * 1000).toISOString(),
      status: 'anonymous', country, existingBrowser, streak: 0, best: 0, feathers: [], recruits: 0, missionPoints: 0, weeklyWins: 0});
  }
  async function byCode(code) { const uid = await get('code:' + code); return uid ? getUser(uid) : null; }
  async function byName(username) { const uid = await get('name:' + username); return uid ? getUser(uid) : null; }
  async function byEmail(email) { const uid = await get('email:' + digest(email)); return uid ? getUser(uid) : null; }
  async function enlist(uid, input) {
    const data = application(input);
    return lock(uid, async () => {
      const user = await getUser(uid); if (!user) throw Error('session');
      if (user.applied) throw Error('already_enlisted');
      if(user.username&&user.username!==data.username)throw Error('username');
      if (user.email && user.email !== data.email) throw Error('email');
      const nameKey = key('name:' + data.username), emailKey = key('email:' + digest(data.email));
      // One transaction reserves both aliases; duplicate requests cannot reserve half.
      const reservation = Number(await run(['EVAL', `local n=redis.call('GET',KEYS[1]);local e=redis.call('GET',KEYS[2]);if (n and n~=ARGV[1]) or (e and e~=ARGV[1]) then return 0 end
redis.call('SET',KEYS[1],ARGV[1],'EX',ARGV[2]);redis.call('SET',KEYS[2],ARGV[1],'EX',ARGV[2]);return redis.call('INCR',KEYS[3])`, 3, nameKey, emailKey, key('serial'), JSON.stringify(uid), RETENTION.pending * DAY]));
      if (!reservation) throw Error('unavailable_name_or_email');
      Object.assign(user, data, {serial: user.serial||reservation, status: user.verifiedAt ? 'waiting' : 'unconfirmed', applied: timestamp(), expires: new Date(now() + (user.verifiedAt?RETENTION.waiting:RETENTION.pending) * DAY * 1000).toISOString()});
      await persist(user); return user;
    });
  }
  async function attachEmail(uid, email, lang) {
    return lock(uid, async () => {
      const user = await getUser(uid); if (!user) throw Error('session');
      if (user.email && user.email !== email) throw Error('email');
      const claimed = await run(['SET', key('email:' + digest(email)), JSON.stringify(uid), 'NX', 'EX', RETENTION.pending * DAY]);
      if (!claimed && (await byEmail(email))?.id !== uid) throw Error('email');
      user.email = email; user.lang = lang; user.status = 'subscriber';
      user.expires = new Date(now() + RETENTION.pending * DAY * 1000).toISOString();
      return persist(user);
    });
  }
  async function register(uid,input){
    const data=application({...input,why:'account'});
    return lock(uid,async()=>{
      const user=await getUser(uid);if(!user||user.username||user.email&&user.email!==data.email)throw Error('already_enlisted');
      const reserved=Number(await run(['EVAL',`local n=redis.call('GET',KEYS[1]);local e=redis.call('GET',KEYS[2]);if (n and n~=ARGV[1]) or (e and e~=ARGV[1]) then return 0 end;redis.call('SET',KEYS[1],ARGV[1],'EX',ARGV[2]);redis.call('SET',KEYS[2],ARGV[1],'EX',ARGV[2]);return redis.call('INCR',KEYS[3])`,3,key('name:'+data.username),key('email:'+digest(data.email)),key('serial'),JSON.stringify(uid),RETENTION.pending*DAY]));
      if(!reserved)throw Error('unavailable_name_or_email');
      delete data.why;Object.assign(user,data,{serial:reserved,status:'unconfirmed',expires:new Date(now()+RETENTION.pending*DAY*1000).toISOString()});
      return persist(user);
    });
  }
  async function verify(uid) {
    return lock(uid, async () => {
      const user = await getUser(uid); if (!user?.email) throw Error('expired');
      if (!user.verifiedAt) {
        user.verifiedAt = timestamp(); const initial=['anonymous','unconfirmed','subscriber'].includes(user.status); if(initial)user.status = user.applied ? 'waiting' : user.username?'member':'subscriber'; user.general = user.email === 'gabriel@corvus.gent';
        if(initial)user.expires = new Date(now() + (user.applied ? RETENTION.waiting : RETENTION.member) * DAY * 1000).toISOString();
        await persist(user);
      }else if(['member','approved','subscriber'].includes(user.status)){user.expires=new Date(now()+RETENTION.member*DAY*1000).toISOString();await persist(user);}
      return user;
    });
  }
  async function rate(scope, hash, max, seconds) {
    return Number(await run(['EVAL', "local n=redis.call('INCR',KEYS[1]);if redis.call('TTL',KEYS[1])<0 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end;return n", 1, key('rate:' + scope + ':' + hash), seconds])) <= max;
  }
  async function rememberReferral(uid, code, ip) {
    const [user, parent] = await Promise.all([getUser(uid), byCode(code)]);
    if (!user || !parent || user.status === 'deleting' || parent.status === 'deleting' || user.id === parent.id || user.existingBrowser || user.parent || user.referral || user.qualifiedAt || user.email) return false;
    return lock(uid, async () => {
      const latest = await getUser(uid); if (!latest || latest.referral || latest.parent) return false;
      // IP hashes are only daily anti-abuse keys (never fields on the account).
      latest.referral = {code, until: now() + 30 * DAY * 1000};
      await own(uid, 'ref-ip:' + uid, {hash: ip, day: dayKey(now())}, DAY);
      await persist(latest); return true;
    });
  }
  async function qualify(uid, ip) {
    const user = await getUser(uid);
    if (!user || user.parent || user.existingBrowser || !user.referral || user.referral.until < now()) return false;
    const parent = await byCode(user.referral.code);
    if (!parent || parent.status === 'deleting' || user.status === 'deleting' || parent.id === uid || await get('owner-ip:' + parent.id + ':' + ip)) return false;
    const childHash = digest('recruit:' + uid), parentHash = digest('recruit:' + parent.id), day = dayKey(now());
    // The credit and both profiles are updated atomically. No attribution on views.
    const result = Number(await run(['EVAL', `local c=redis.call('GET',KEYS[1]);local p=redis.call('GET',KEYS[2]);if not c or not p then return 0 end
local child=cjson.decode(c);local parent=cjson.decode(p)
if child.status=='deleting' or parent.status=='deleting' or child.parent or child.existingBrowser or child.id==parent.id or not child.referral or child.referral.code~=parent.code then return 0 end
if tonumber(redis.call('GET',KEYS[4]) or '0')>=10 or redis.call('EXISTS',KEYS[5])==1 or redis.call('EXISTS',KEYS[6])==1 then return 0 end
child.parent=parent.id;child.qualifiedAt=ARGV[1];child.creditWeek=ARGV[4];child.referral=nil;parent.recruits=(parent.recruits or 0)+1
redis.call('SET',KEYS[1],cjson.encode(child),'KEEPTTL');redis.call('SET',KEYS[2],cjson.encode(parent),'KEEPTTL')
redis.call('HSET',KEYS[3],ARGV[2],ARGV[1]);redis.call('EXPIRE',KEYS[3],ARGV[6]);redis.call('INCR',KEYS[4]);redis.call('EXPIRE',KEYS[4],86400)
redis.call('SET',KEYS[5],'1','EX',86400);redis.call('SET',KEYS[6],'1','EX',ARGV[6]);redis.call('SADD',KEYS[7],KEYS[6]);redis.call('EXPIRE',KEYS[7],ARGV[6]);redis.call('ZINCRBY',KEYS[8],1,ARGV[3]);redis.call('EXPIRE',KEYS[8],777600)
redis.call('SADD',KEYS[9],KEYS[3]);redis.call('EXPIRE',KEYS[9],ARGV[6]);return 1`, 9,
      key('u:' + uid), key('u:' + parent.id), key('children:' + parent.id), key('ref-day:' + parent.code + ':' + day), key('ref-ip-day:' + day + ':' + ip), key('credited:' + childHash), key('owned:' + uid), key('week:' + weekKey(now())), key('owned:' + parent.id), timestamp(), childHash, parent.id, weekKey(now()), uid, 367 * DAY]));
    if (result) { await run(['SADD', key('weeks'), weekKey(now())]); await run(['EXPIRE', key('weeks'), 120 * DAY]); await run(['INCR', key('revision')]); await run(['DEL', key('public'), key('legion')]); }
    return result === 1;
  }
  async function complete(uid, {day, type, streak, solved}, ip) {
    const mission = dailyMission(day, type), reward = missionReward(mission, now());
    if (!reward) return null;
    const result = await lock(uid, async () => {
      const user = await getUser(uid); if (!user) return null;
      const receipt = 'mission:' + uid + ':' + mission.id;
      if (await get(receipt)) return user;
      user.streak = solved ? Math.max(0, Math.min(3660, streak || 0)) : 0;
      user.best = Math.max(user.best, user.streak); user.missionPoints += reward;
      await own(uid, receipt, {day, type, reward}, 2 * DAY);
      return persist(user);
    });
    if (result) await qualify(uid, ip);
    return getUser(uid);
  }
  // Gabe records a concrete, already-verified help/intro report. No self-awards.
  async function approveHelp(uid, {kind, reference}) {
    if (!['help','intro'].includes(kind) || typeof reference !== 'string') throw Error('fields');
    reference=reference.trim();
    if (reference.length<8 || reference.length>180 || /[\u0000-\u001f]/.test(reference)) throw Error('fields');
    const user=await getUser(uid);if(!user?.verifiedAt||user.status==='deleting')throw Error('unverified');
    const receipt=digest('help:'+reference.toLowerCase()), seconds=ttl(user);
    return lock(uid,async()=>{
    const credited=Number(await run(['EVAL',`local raw=redis.call('GET',KEYS[1]);if not raw then return -1 end
local user=cjson.decode(raw);if not user.verifiedAt or user.status=='deleting' then return -1 end
if redis.call('EXISTS',KEYS[2])==1 then return 0 end
user.approvedHelp=(user.approvedHelp or 0)+1
redis.call('SET',KEYS[1],cjson.encode(user),'KEEPTTL');redis.call('SET',KEYS[2],'true','EX',ARGV[1]);redis.call('SET',KEYS[3],ARGV[2],'EX',ARGV[3])
redis.call('SADD',KEYS[4],KEYS[2],KEYS[3]);redis.call('EXPIRE',KEYS[4],ARGV[4]);redis.call('INCR',KEYS[5]);redis.call('DEL',KEYS[6],KEYS[7]);return 1`,7,
      key('u:'+uid),key('help-credit:'+uid+':'+receipt),key('help-report:'+uid+':'+receipt),key('owned:'+uid),key('revision'),key('public'),key('legion'),
      seconds,JSON.stringify({kind,reference,approvedAt:timestamp()}),Math.min(seconds,90*DAY),367*DAY]));
    if(credited<0)throw Error('unverified');
    return {credited:credited===1};
    });
  }
  async function feather(uid, spot) {
    if (!FEATHERS.includes(spot)) throw Error('feather');
    return lock(uid, async () => {
      const user = await getUser(uid); if (!user) throw Error('session');
      if (!user.feathers.includes(spot)) { user.feathers.push(spot); await persist(user); }
      return user;
    });
  }
  async function all() {
    const users=[];
    for(let offset=0;;offset+=500){
      const ids=await run(['ZRANGEBYSCORE',key('users'),now(),'+inf','LIMIT',offset,500]);
      if(!ids.length)break;
      const values=await run(['MGET',...ids.map(uid=>key('u:'+uid))]);
      users.push(...values.filter(Boolean).map(value=>normalize(JSON.parse(value))));
      if(ids.length<500)break;
    }
    return users;
  }
  async function remove(uid) {
    return lock(uid, async () => {
      const user = await getUser(uid);
      if (user) {user.status = 'deleting'; await persist(user);}
      const everyone = await all();
      // The edge is the deletion receipt: decrement once even after a partial
      // failure or when TTL already removed the child's personal document.
      for (const parent of everyone.filter(s=>s.id!==uid)) {
        const edge = await run(['HGET',key('children:'+parent.id),digest('recruit:'+uid)]);
        if (!edge) continue;
        const week = weekKey(Date.parse(edge));
        await run(['EVAL',`if redis.call('HDEL',KEYS[1],ARGV[1])==0 then return 0 end
local raw=redis.call('GET',KEYS[2]);if raw then local p=cjson.decode(raw);p.recruits=math.max(0,(p.recruits or 0)-1);redis.call('SET',KEYS[2],cjson.encode(p),'KEEPTTL') end
if redis.call('EXISTS',KEYS[3])==1 then redis.call('ZINCRBY',KEYS[3],-1,ARGV[2]) end;return 1`,3,key('children:'+parent.id),key('u:'+parent.id),key('week:'+week),digest('recruit:'+uid),parent.id]);
      }
      for (const child of everyone.filter(s => s.parent === uid)) await lock(child.id, async () => {
        const latest = await getUser(child.id); if (latest?.parent === uid) { delete latest.parent; await persist(latest); }
      });
      const owned = await run(['SMEMBERS', key('owned:' + uid)]);
      const jobs = owned.filter(k => k.startsWith(key('mail:'))).map(k => k.slice(key('mail:').length));
      if (jobs.length) await run(['ZREM', key('outbox'), ...jobs]);
      if (owned.length) await run(['DEL', ...owned]);
      await run(['DEL', key('u:' + uid), key('owned:' + uid), key('public'), key('legion')]);
      await run(['INCR', key('revision')]);
      await run(['ZREM', key('users'), uid]);
      await run(['ZREM', key('outbox'), uid]);
      const weeks = await run(['SMEMBERS', key('weeks')]);
      for (const week of weeks) await run(['ZREM', key('week:' + week), uid]);
      return true;
    });
  }
  async function exportData(uid) {
    const user = await getUser(uid); if (!user) throw Error('session');
    const owned = await run(['SMEMBERS', key('owned:' + uid)]), records = {};
    const safe = owned.filter(k => !/:(?:token|session|mail|challenge|credited|email|name|code|ref-ip|owner-ip|children|discord):/.test(k) && k !== key('u:' + uid));
    if (safe.length) { const values = await run(['MGET', ...safe]); safe.forEach((k, i) => { if (values[i]) try { const value=JSON.parse(values[i]); for(const field of ['secret','delivery','unsubscribeSecret','uid'])delete value[field]; records[k.slice(prefix.length).replaceAll(uid, 'me')] = value; } catch {} }); }
    const {id: ignored, general, ...profile} = user;
    delete profile.parent; delete profile.referral; delete profile.creditWeek;
    return {exported: timestamp(), profile, records, note: 'credentials and other people’s data are excluded'};
  }
  async function cleanup() {const expired=await run(['ZRANGEBYSCORE',key('users'),'-inf',now(),'LIMIT',0,100]);for(const uid of expired)await remove(uid);return expired.length;}
  async function seen(uid, ip) { if (await getUser(uid)) await own(uid, 'owner-ip:' + uid + ':' + ip, true, DAY); }
  return {cleanup, seen, key, run, get, getUser, own, lock, persist, create, byCode, byName, byEmail, attachEmail, register, enlist, verify, rate, rememberReferral, qualify, complete, approveHelp, feather, all, remove, exportData, now, ttl};
}
