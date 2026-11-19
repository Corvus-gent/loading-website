#!/usr/bin/env node
// One-way copy. Output contains counters only, never keys, values or credentials.
import { createClient } from 'redis';
import { createHash, randomInt, randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { secureEndpoint } from '../api/_redis.js';

const SNAPSHOT = `local now=redis.call('TIME')
local ttl=redis.call('PTTL',KEYS[1]); if ttl==-2 then return nil end
local expires=0
if ttl>=0 then expires=tonumber(now[1])*1000+math.floor(tonumber(now[2])/1000)+ttl end
local value=redis.call('DUMP',KEYS[1]); if not value then return nil end
return {redis.call('TYPE',KEYS[1]).ok,value,expires,ttl}`;
const PREFIXES = new Set([
  'access', 'account', 'auth', 'cli', 'coffee', 'cv', 'email', 'game', 'games',
  'geo', 'guess', 'health', 'lang', 'language', 'login', 'logins', 'music',
  'notion', 'otp', 'payment', 'privacy', 'rate', 'refresh', 'rl', 'session',
  'sessions', 'sf', 'stats', 'view', 'vote', 'votes', 'voter', 'x', 'xlog'
]);
const hash = value => createHash('sha256').update(value).digest('hex');
const integer = value => Number(Buffer.isBuffer(value) ? value.toString() : value);
const cmd = (client, args) => client.sendCommand(args, {
  returnBuffers: true, signal: AbortSignal.timeout(15000)
});

function endpoint(raw, allowPlaintext = false) {
  const url = new URL(raw);
  if (url.protocol !== 'rediss:' && !(allowPlaintext && url.protocol === 'redis:'))
    throw Error('TLS required; plaintext source needs explicit opt-in');
  if (url.protocol === 'rediss:') secureEndpoint(raw);
  if (url.search || url.hash) throw Error('unsupported URL options');
  const db = url.pathname.replace(/^\//, '') || '0';
  if (!/^\d+$/.test(db)) throw Error('invalid database');
  return `${url.hostname.toLowerCase()}:${url.port || '6379'}/${Number(db)}`;
}

async function* scan(client) {
  let cursor = '0';
  const seen = new Set();
  do {
    const [next, keys] = await cmd(client, ['SCAN', cursor, 'COUNT', '200']);
    cursor = String(next);
    for (const key of keys) {
      const id = hash(key);
      if (!seen.has(id)) {
        seen.add(id);
        yield key;
      }
    }
  } while (cursor !== '0');
}

async function snapshot(client, key) {
  const row = await cmd(client, ['EVAL', SNAPSHOT, '1', key]);
  return row ? { type: String(row[0]), value: row[1], expires: integer(row[2]), ttl: integer(row[3]) } : null;
}

async function content(client, key, snap) {
  // Redis can reorder hashes/sets or change their RDB encoding on restore.
  let rows;
  if (snap.type === 'hash') {
    rows = await cmd(client, ['HGETALL', key]);
    const pairs = [];
    for (let i = 0; i < rows.length; i += 2)
      pairs.push([rows[i].toString('base64'), rows[i + 1].toString('base64')]);
    pairs.sort((a, b) => a[0].localeCompare(b[0]));
    return hash(JSON.stringify(pairs));
  }
  if (snap.type === 'set') {
    rows = await cmd(client, ['SMEMBERS', key]);
    return hash(JSON.stringify(rows.map(value => value.toString('base64')).sort()));
  }
  if (snap.type === 'list') rows = await cmd(client, ['LRANGE', key, '0', '-1']);
  if (snap.type === 'zset') rows = await cmd(client, ['ZRANGE', key, '0', '-1', 'WITHSCORES']);
  if (rows) return hash(JSON.stringify(rows.map(value => value.toString('base64'))));
  if (snap.type === 'string') return hash(await cmd(client, ['GET', key]) || Buffer.alloc(0));
  // Fail conservatively for unsupported stream/module encodings, retaining group metadata.
  return hash(snap.value);
}

function prefixOf(key) {
  const separator = key.indexOf(58);
  const prefix = separator < 0 ? '' : key.subarray(0, separator).toString();
  // An arbitrary key prefix may itself contain an email or another identifier.
  return PREFIXES.has(prefix) ? prefix : 'other';
}

async function inventory(client) {
  const prefixes = {};
  const types = {};
  const examples = new Map();
  let keys = 0;
  let bytes = 0;
  for await (const key of scan(client)) {
    const data = await snapshot(client, key);
    if (!data) continue;
    keys++;
    bytes += data.value.length;
    const prefix = prefixOf(key);
    prefixes[prefix] = (prefixes[prefix] || 0) + 1;
    types[data.type] = (types[data.type] || 0) + 1;
    if (!examples.has(data.type)) examples.set(data.type, key);
  }
  return { keys, bytes, prefixes, types, examples };
}

async function serverTime(client) {
  const [seconds, micros] = await cmd(client, ['TIME']);
  return integer(seconds) * 1000 + Math.floor(integer(micros) / 1000);
}

export async function probeFeatures(source, target, examples) {
  const result = { dump: 0, restoreAbsttl: 0, pttl: 0, eval: 0, noOverwrite: 0, sourceTypesChecked: 0, ok: 0 };
  const owned = [];
  try {
    result.eval = Number(integer(await cmd(target, ['EVAL', 'return 1', '0'])) === 1);
    const seedKey = `migration:probe:${randomUUID()}`;
    if (String(await cmd(target, ['SET', seedKey, 'probe', 'NX', 'PX', '10000'])) !== 'OK')
      throw Error('probe collision');
    owned.push(seedKey);
    const payload = await cmd(target, ['DUMP', seedKey]);
    result.dump = Number(Buffer.isBuffer(payload));
    const restored = `migration:probe:${randomUUID()}`;
    const expires = await serverTime(target) + 10000;
    await cmd(target, ['RESTORE', restored, String(expires), payload, 'ABSTTL']);
    owned.push(restored);
    const ttl = integer(await cmd(target, ['PTTL', restored]));
    result.pttl = Number(ttl > 0 && ttl <= 10000);
    const actual = await snapshot(target, restored);
    result.restoreAbsttl = Number(actual && Math.abs(actual.expires - expires) <= 5 &&
      String(await cmd(target, ['GET', restored])) === 'probe');
    await cmd(target, ['SET', restored, 'existing', 'XX', 'PX', '10000']);
    try {
      await cmd(target, ['RESTORE', restored, String(expires), payload, 'ABSTTL']);
    } catch (error) {
      result.noOverwrite = Number(/^BUSYKEY\b/.test(error.message) &&
        String(await cmd(target, ['GET', restored])) === 'existing');
    }
    // Round-trip an actual source payload per type, catching cross-provider RDB differences.
    for (const key of examples.values()) {
      const data = await snapshot(source, key);
      if (!data) continue;
      const probeKey = `migration:probe:${randomUUID()}`;
      await cmd(target, ['RESTORE', probeKey, String(await serverTime(target) + 10000), data.value, 'ABSTTL']);
      owned.push(probeKey);
      const copy = await snapshot(target, probeKey);
      if (!copy || copy.type !== data.type ||
          await content(source, key, data) !== await content(target, probeKey, copy))
        throw Error('source format incompatible');
      result.sourceTypesChecked++;
    }
    result.ok = Number(Boolean(result.dump && result.restoreAbsttl && result.pttl && result.eval && result.noOverwrite));
  } catch {
    // Database errors may include keys or credentials; report only capability counters.
    result.ok = 0;
  } finally {
    // Only keys successfully created by this probe; they also have a 10-second TTL.
    for (const key of owned) await cmd(target, ['DEL', key]);
  }
  return result;
}

async function compareKey(source, target, key) {
  let [a, b] = await Promise.all([snapshot(source, key), snapshot(target, key)]);
  if (a && !b) a = await snapshot(source, key);
  if (!a && b) b = await snapshot(target, key);
  if (!a && !b) return { expired: 1 };
  if (!a) return { extra: 1 };
  if (!b) return { missing: 1 };
  const [sourceHash, targetHash] = await Promise.all([
    content(source, key, a), content(target, key, b)
  ]);
  // Expiry during hashing is benign only when the key has expired in both databases.
  if (a.expires || b.expires) {
    const [sourceExists, targetExists] = await Promise.all([
      cmd(source, ['EXISTS', key]), cmd(target, ['EXISTS', key])
    ]);
    if (!integer(sourceExists) && !integer(targetExists)) return { expired: 1 };
  }
  return {
    checked: 1,
    typeMismatch: Number(a.type !== b.type),
    valueMismatch: Number(sourceHash !== targetHash),
    expiryMismatch: Number((a.expires === 0) !== (b.expires === 0) || Math.abs(a.expires - b.expires) > 5000),
    pttlMismatch: Number((a.ttl === -1) !== (b.ttl === -1) || Math.abs(a.ttl - b.ttl) > 5000)
  };
}

function comparisonCounters() {
  return { checked: 0, missing: 0, extra: 0, typeMismatch: 0, valueMismatch: 0,
    expiryMismatch: 0, pttlMismatch: 0, expired: 0 };
}

function addCounters(total, result) {
  for (const [name, count] of Object.entries(result)) total[name] += count;
}

export async function compareDatabases(source, target) {
  const result = comparisonCounters();
  const sourceKeys = new Map();
  const targetKeys = new Map();
  for await (const key of scan(source)) sourceKeys.set(hash(key), key);
  for await (const key of scan(target)) targetKeys.set(hash(key), key);
  for (const key of new Map([...sourceKeys, ...targetKeys]).values())
    addCounters(result, await compareKey(source, target, key));

  const sample = comparisonCounters();
  const remaining = [...sourceKeys.values()];
  // Random sample without replacement. Replace samples that naturally expired.
  while (remaining.length && sample.checked < 20) {
    const index = randomInt(remaining.length);
    const key = remaining[index];
    remaining[index] = remaining[remaining.length - 1];
    remaining.pop();
    addCounters(sample, await compareKey(source, target, key));
  }
  const [a, b] = await Promise.all([inventory(source), inventory(target)]);
  const [sourceCount, targetCount] = await Promise.all([
    cmd(source, ['DBSIZE']), cmd(target, ['DBSIZE'])
  ]);
  const prefixNames = new Set([...Object.keys(a.prefixes), ...Object.keys(b.prefixes)]);
  result.sourceCount = integer(sourceCount);
  result.targetCount = integer(targetCount);
  result.countsMatch = Number(result.sourceCount === result.targetCount);
  result.prefixes = { source: a.prefixes, target: b.prefixes };
  result.prefixesMatch = Number([...prefixNames].every(name =>
    (a.prefixes[name] || 0) === (b.prefixes[name] || 0)));
  result.sample = sample;
  result.ok = Number(Boolean(result.countsMatch && result.prefixesMatch &&
    !result.missing && !result.extra && !result.typeMismatch && !result.valueMismatch &&
    !result.expiryMismatch && !result.pttlMismatch && !sample.missing && !sample.extra &&
    !sample.typeMismatch && !sample.valueMismatch && !sample.expiryMismatch && !sample.pttlMismatch));
  return result;
}

export async function migrateRedis({ sourceURL, targetURL, dryRun = true, verifyOnly = false,
  resume = false, sourcePaused = false, allowPlaintextSource = false }) {
  if (!sourceURL || !targetURL) throw Error('both URLs required');
  const sourceEndpoint = endpoint(sourceURL, allowPlaintextSource);
  const targetEndpoint = endpoint(targetURL);
  if (sourceEndpoint === targetEndpoint) throw Error('same database');
  if (!dryRun && !verifyOnly && !sourcePaused) throw Error('pause source writers first');
  const clients = [sourceURL, targetURL].map(url => createClient({ url,
    socket: { connectTimeout: 10000, reconnectStrategy: false }
  }).on('error', () => {}));
  const [source, target] = clients;
  try {
    await source.connect();
    await target.connect();
    const infos = await Promise.allSettled(clients.map(client => cmd(client, ['INFO', 'server'])));
    if (infos.every(row => row.status === 'fulfilled')) {
      const ids = infos.map(row => /^run_id:(.+)$/m.exec(String(row.value))?.[1].trim());
      if (ids[0] && ids[0] === ids[1] && sourceEndpoint.split('/').at(-1) === targetEndpoint.split('/').at(-1))
        throw Error('same database alias');
    }
    const report = { dryRun: Number(dryRun), verifyOnly: Number(verifyOnly),
      sourceBefore: integer(await cmd(source, ['DBSIZE'])),
      targetBefore: integer(await cmd(target, ['DBSIZE'])),
      scanned: 0, copied: 0, skippedExisting: 0, expired: 0, bytes: 0 };
    if (verifyOnly) return { ...report, verification: await compareDatabases(source, target) };
    if (!dryRun && report.targetBefore && !resume)
      throw Error('destination must be empty; resume only adds missing keys');
    const [before, destination] = await Promise.all([inventory(source), inventory(target)]);
    report.sourcePrefixes = before.prefixes;
    report.targetPrefixes = destination.prefixes;
    report.types = before.types;
    report.scanned = before.keys;
    report.bytes = before.bytes;
    report.features = await probeFeatures(source, target, before.examples);
    if (dryRun || !report.features.ok) return report;
    for await (const key of scan(source)) {
      const data = await snapshot(source, key);
      if (!data) {
        report.expired++;
        continue;
      }
      try {
        // No REPLACE, including on retry. RESTORE rejects a concurrent existing key atomically.
        await cmd(target, ['RESTORE', key, String(data.expires), data.value, 'ABSTTL']);
        report.copied++;
      } catch (error) {
        if (!/^BUSYKEY\b/.test(error.message)) throw error;
        report.skippedExisting++;
      }
    }
    report.verification = await compareDatabases(source, target);
    return report;
  } finally {
    await Promise.allSettled(clients.filter(client => client.isOpen).map(client => client.disconnect()));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const allowed = ['--dry-run', '--apply', '--verify', '--resume', '--source-paused', '--allow-plaintext-source'];
  try {
    if (args.some(arg => !allowed.includes(arg)) ||
        ['--dry-run', '--apply', '--verify'].filter(arg => args.includes(arg)).length > 1)
      throw Error('arguments');
    const report = await migrateRedis({ sourceURL: process.env.OLD_REDIS_URL, targetURL: process.env.NEW_REDIS_URL,
      dryRun: !args.includes('--apply') && !args.includes('--verify'), verifyOnly: args.includes('--verify'),
      resume: args.includes('--resume'), sourcePaused: args.includes('--source-paused'),
      allowPlaintextSource: args.includes('--allow-plaintext-source') });
    console.log(JSON.stringify(report, null, 2));
    if (report.features?.ok === 0 || report.verification?.ok === 0) process.exitCode = 2;
  } catch {
    console.error('Migration stopped. Check connectivity, credentials, source opt-in, TLS destination, paused writers and DUMP/RESTORE support. Resume adds missing keys only. Credentials and database errors are withheld.');
    process.exitCode = 1;
  }
}
