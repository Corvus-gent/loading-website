// Shared operator operations. Never print addresses, values, tokens or IP hashes.
import crypto from 'node:crypto';
import { redis } from '../api/_redis.js';
import { hash } from '../api/_session.js';
import { appendPrivateLog, DAY, LOG_RETENTION, VOTER_RETENTION } from '../api/_privacy.js';

export async function* keys(pattern) {
  let cursor = '0';
  do {
    const result = await redis(['SCAN', cursor, 'MATCH', pattern, 'COUNT', '200']);
    cursor = String(result[0]);
    for (const key of result[1]) yield key;
  } while (cursor !== '0');
}
const normal = email => String(email || '').trim().toLowerCase();
const parse = raw => { try { return JSON.parse(raw); } catch { return null; } };

export async function deleteUserData(email, { dryRun = false } = {}) {
  email = normal(email);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 254) throw Error('a valid email is required');
  const counts = { otp: 0, sessions: 0, logRecords: 0, legacyLogRecords: 0, guesses: 0, sfLeads: 0, caches: 0 };
  const remove = async (key, type) => {
    if (Number(await redis(['EXISTS', key]))) { counts[type]++; if (!dryRun) await redis(['DEL', key]); }
  };
  const legacySecret=crypto.createHash('sha256').update('corvus'+(process.env.REDIS_URL||'')).digest('hex');
  const hashes=new Set([hash(email),crypto.createHash('sha256').update(email+legacySecret).digest('hex')]);
  for(const digest of hashes){await remove(`otp:${digest}`,'otp');await remove(`otp:rl:mail:${digest}`,'otp');}
  for await (const key of keys('sess:*')) if (normal(await redis(['GET', key])) === email) await remove(key, 'sessions');
  for (const kind of ['logins', 'access']) {
    for await (const key of keys(`privacy:log:${kind}:*`)) {
      if (normal(parse(await redis(['GET', key]))?.email) !== email) continue;
      await remove(key, 'logRecords');
      if (!dryRun) await redis(['ZREM', `privacy:log-index:${kind}`, key.split(':').at(-1)]);
    }
  }
  for (const key of ['logins', 'access_requests']) {
    for (const raw of await redis(['LRANGE', key, '0', '-1']) || []) {
      if (normal(parse(raw)?.email) !== email) continue;
      counts.legacyLogRecords++;
      if (!dryRun) await redis(['LREM', key, '1', raw]);
    }
  }
  for await (const key of keys('guesses:*')) {
    for (const field of await redis(['HKEYS', key]) || []) {
      if (normal(field) !== email) continue;
      counts.guesses++;
      if (!dryRun) await redis(['HDEL', key, field]);
    }
  }
  for await (const key of keys('sf:lead:*')) {
    if(normal(parse(await redis(['GET',key]))?.contact)!==email)continue;
    counts.sfLeads++;
    if(!dryRun){const id=key.slice('sf:lead:'.length);await redis(['DEL',key,`sf:mail:${id}`,`sf:mail-lock:${id}`]);await redis(['ZREM','sf:leads',id]);await redis(['ZREM','sf:outbox',id]);}
  }
  for await (const key of keys('stats:private*')) await remove(key, 'caches');
  return counts;
}

export async function migrateRetention({ dryRun = true } = {}) {
  const counts = { expiredOrObsolete: 0, migratedLogs: 0, migratedPollVotes: 0, cappedTTLs: 0 };
  const drop = async key => { counts.expiredOrObsolete++; if (!dryRun) await redis(['DEL', key]); };
  const cap = async (key, seconds) => {
    const ttl = Number(await redis(['TTL', key]));
    if (ttl === -2) return;
    if (seconds <= 0) return drop(key);
    if (ttl === -1 || ttl > seconds) { counts.cappedTTLs++; if (!dryRun) await redis(['EXPIRE', key, String(seconds)]); }
  };
  for (const [key, kind] of [['logins', 'logins'], ['access_requests', 'access']]) {
    // Deploy the new writers before this operation; LREM keeps unrelated/new rows.
    for (const raw of await redis(['LRANGE', key, '0', '-1']) || []) {
      const value = parse(raw);
      if (value?.email && Date.parse(value.at) > Date.now() - LOG_RETENTION * 1000 && Date.parse(value.at) <= Date.now()) {
        counts.migratedLogs++;
        if (!dryRun) await appendPrivateLog(kind, normal(value.email), value.at, crypto.createHash('sha256').update(kind+':'+raw).digest('hex'));
      } else counts.expiredOrObsolete++;
      if (!dryRun) await redis(['LREM', key, '1', raw]);
    }
  }
  const poll = await redis(['HGETALL', 'music:poll:voters']) || [];
  for (let i = 0; i < poll.length; i += 2) {
    if (!['spotify', 'apple'].includes(poll[i + 1])) continue;
    counts.migratedPollVotes++;
    if (!dryRun) await redis(['SET', `music:poll:voter:${poll[i]}`, poll[i + 1], 'NX', 'EX', String(VOTER_RETENTION)]);
  }
  if (poll.length && !dryRun) await redis(['DEL', 'music:poll:voters']);
  // Old hashes cannot be re-salted without raw IPs, deliberately not available.
  // Purge old rate records rather than keeping cross-day linkable identifiers.
  for (const pattern of ['voted:iptotal:*', 'otp:rl:ip:*', 'guess:rl:*', 'voted:ipday:*', 'music:challenge-rate:*', 'music:posts:*', 'music:cool:ip:*', 'music:suggday:*', 'game:rate:*', 'geo:all', 'stats:v[1-4]:*', 'stats:section:v1:*', 'stats:private*']) {
    for await (const key of keys(pattern)) if (!key.includes(':d1:')) await drop(key);
  }
  for (const [pattern, seconds] of [
    ['otp:*', 180], ['sess:*', 7 * DAY], ['ch:*', 300], ['voted:v:*', VOTER_RETENTION],
    ['music:voted:*', VOTER_RETENTION], ['music:poll:voter:*', VOTER_RETENTION],
    ['music:seen:*', 3600], ['music:challenge:*', 300], ['music:cool:v:*', 60],
    ['game:state:*', 2 * DAY], ['game:streak:*', VOTER_RETENTION], ['game:city:*', 2 * DAY],
    ['privacy:log-index:*', LOG_RETENTION], ['privacy:log:*', LOG_RETENTION],
  ]) {
    for await (const key of keys(pattern)) {
      if (key.startsWith('otp:rl:')) { await cap(key, key.startsWith('otp:rl:mail:') ? 900 : 3600); continue; }
      if (key.endsWith(':lock')) { await cap(key, 15); continue; }
      await cap(key, seconds);
    }
  }
  for await (const key of keys('guesses:*')) {
    const day = key.slice('guesses:'.length);
    const remaining = Math.floor((Date.parse(day) - Date.now()) / 1000) + LOG_RETENTION - DAY - 2 * 3600;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(remaining)) await drop(key);
    else await cap(key, remaining);
  }
  for (const day of await redis(['SMEMBERS', 'guess_days']) || []) {
    if (!Number(await redis(['EXISTS', `guesses:${day}`])) && !dryRun) await redis(['SREM', 'guess_days', day]);
  }
  await cap('guess_days', LOG_RETENTION);
  return counts;
}
