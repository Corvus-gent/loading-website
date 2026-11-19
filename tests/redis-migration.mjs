import assert from 'node:assert/strict';
import { createClient } from 'redis';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, writeFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import net from 'node:net';
import tls from 'node:tls';
import { migrateRedis, compareDatabases, probeFeatures } from '../tools/migrate-redis.mjs';
import { secureEndpoint } from '../api/_redis.js';

const run = promisify(execFile);
const directory = await mkdtemp(join(tmpdir(), 'corvus-migration-test-'));
const socketPath = join(directory, 'redis.sock');
const certPath = join(directory, 'cert.pem');
const keyPath = join(directory, 'key.pem');
const sockets = new Set();
const clients = [];
let server;
let plain;
let encrypted;

function forward(socket) {
  const upstream = net.connect(socketPath);
  sockets.add(socket);
  sockets.add(upstream);
  socket.pipe(upstream).pipe(socket);
  socket.on('error', () => upstream.destroy());
  upstream.on('error', () => socket.destroy());
  socket.on('close', () => { sockets.delete(socket); upstream.destroy(); });
  upstream.on('close', () => { sockets.delete(upstream); socket.destroy(); });
}

async function listen(proxy) {
  await new Promise((resolve, reject) => {
    proxy.once('error', reject);
    proxy.listen(0, '127.0.0.1', resolve);
  });
  return proxy.address().port;
}

try {
  // Fully isolated fixture, no production URLs or shared Redis database.
  await writeFile(join(directory, 'cert.cnf'), `[req]\ndistinguished_name=dn\nx509_extensions=ext\nprompt=no\n[dn]\nCN=localhost\n[ext]\nsubjectAltName=IP:127.0.0.1,DNS:localhost\nbasicConstraints=CA:TRUE\n`);
  await run('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1',
    '-keyout', keyPath, '-out', certPath, '-config', join(directory, 'cert.cnf')]);
  server = spawn(process.env.REDIS_TEST_SERVER || 'redis-server', ['--port', '0',
    '--unixsocket', socketPath, '--save', '', '--appendonly', 'no'], { stdio: 'ignore' });
  let startupError;
  server.on('error', error => { startupError = error; });
  let started = false;
  for (let attempt = 0; attempt < 100 && !startupError; attempt++) {
    try { await access(socketPath); started = true; break; } catch {}
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  assert.ok(started, 'Set REDIS_TEST_SERVER to a local redis-server binary');
  plain = net.createServer(forward);
  encrypted = tls.createServer({ key: await readFile(keyPath), cert: await readFile(certPath) }, forward);
  const sourceURL = `redis://127.0.0.1:${await listen(plain)}/11`;
  const targetURL = `rediss://127.0.0.1:${await listen(encrypted)}/12`;
  const a = createClient({ url: sourceURL, socket: { reconnectStrategy: false } });
  const b = createClient({ url: targetURL, socket: { ca: await readFile(certPath), reconnectStrategy: false } });
  clients.push(a, b);
  await Promise.all(clients.map(client => client.connect()));
  async function migrate(args = []) {
    const { stdout } = await run(process.execPath, ['tools/migrate-redis.mjs',
      '--allow-plaintext-source', ...args], {
      env: { ...process.env, OLD_REDIS_URL: sourceURL, NEW_REDIS_URL: targetURL,
        NODE_EXTRA_CA_CERTS: certPath }
    });
    return JSON.parse(stdout);
  }
  const binaryKey = Buffer.from([0, 255, 42, 10]);
  const binaryValue = Buffer.from([128, 255, 0, 10, 13]);
  await a.sendCommand(['SET', binaryKey, binaryValue]);
  await a.set('otp:test', 'login-code', { PX: 120000 });
  await a.set('session:test', 'session-value', { PX: 600000 });
  await a.hSet('votes:test', { en: '42', nl: '23' });
  await a.sAdd('voters:test', ['one', 'two']);
  await a.pExpire('voters:test', 900000);
  await a.rPush('logins:test', ['old', 'new']);
  await a.pExpire('logins:test', 900000);
  await a.zAdd('music:ranking', [{ score: 1, value: 'first' }, { score: 2, value: 'second' }]);
  await a.sendCommand(['XADD', 'stream:test', '*', 'field', 'value']);
  await a.sendCommand(['XGROUP', 'CREATE', 'stream:test', 'workers', '0']);
  await a.sendCommand(['XREADGROUP', 'GROUP', 'workers', 'worker-1', 'COUNT', '1', 'STREAMS', 'stream:test', '>']);
  for (let i = 0; i < 25; i++) await a.set(`stats:test:${i}`, `value-${i}`);
  const before = await a.dbSize();
  assert.throws(() => secureEndpoint('redis://migration-source.invalid'), /encrypted/);
  await assert.rejects(migrateRedis({ sourceURL, targetURL }), /opt-in/);
  await assert.rejects(migrateRedis({ sourceURL, targetURL: sourceURL, allowPlaintextSource: true }), /TLS/);
  await assert.rejects(migrateRedis({ sourceURL: targetURL, targetURL }), /same database/);
  await assert.rejects(migrateRedis({ sourceURL, targetURL, allowPlaintextSource: true, dryRun: false }), /pause/);
  const dry = await migrate(['--dry-run']);
  assert.equal(dry.scanned, before);
  assert.equal(dry.copied, 0);
  assert.equal(dry.features.ok, 1);
  assert.equal(dry.features.noOverwrite, 1);
  assert.equal(dry.features.sourceTypesChecked, 6);
  assert.equal(dry.sourcePrefixes.stats, 25);
  assert.equal(await b.dbSize(), 0);
  assert.equal(await a.dbSize(), before);
  await b.set('existing', 'leave-me');
  await assert.rejects(migrate(['--apply', '--source-paused']));
  assert.equal(await b.get('existing'), 'leave-me');
  await b.del('existing');
  const copy = await migrate(['--apply', '--source-paused']);
  assert.equal(copy.copied, before);
  assert.equal(copy.verification.ok, 1);
  assert.equal(copy.verification.sample.checked, 20);
  assert.equal(copy.verification.prefixesMatch, 1);
  assert.deepEqual(await b.sendCommand(['GET', binaryKey], { returnBuffers: true }), binaryValue);
  assert.equal(await b.pTTL(binaryKey), -1);
  assert.ok(Math.abs(await a.pTTL('otp:test') - await b.pTTL('otp:test')) <= 5000);
  assert.deepEqual(await b.sendCommand(['XPENDING', 'stream:test', 'workers']),
    await a.sendCommand(['XPENDING', 'stream:test', 'workers']));
  await b.hSet('votes:test', 'en', '999');
  let check = await compareDatabases(a, b);
  assert.equal(check.valueMismatch, 1);
  assert.equal(check.ok, 0);
  // Retry must leave a changed destination value untouched and fail verification.
  await assert.rejects(migrate(['--apply', '--source-paused', '--resume']), error => {
    const report = JSON.parse(error.stdout);
    assert.equal(report.copied, 0);
    assert.equal(report.skippedExisting, before);
    assert.equal(report.verification.ok, 0);
    return error.code === 2;
  });
  assert.equal(await b.hGet('votes:test', 'en'), '999');
  await b.hSet('votes:test', 'en', '42');
  await b.persist('otp:test');
  check = await compareDatabases(a, b);
  assert.equal(check.expiryMismatch, 1);
  assert.equal(check.pttlMismatch, 1);
  await b.del('otp:test');
  const resumed = await migrate(['--apply', '--source-paused', '--resume']);
  assert.equal(resumed.copied, 1);
  assert.equal(resumed.verification.ok, 1);
  await b.del('session:test');
  await b.set('extra', 'wrong');
  check = await compareDatabases(a, b);
  assert.equal(check.missing, 1);
  assert.equal(check.extra, 1);
  await b.del('extra');
  await migrate(['--apply', '--source-paused', '--resume']);
  await a.set('music:short-lived', 'expires', { PX: 1500 });
  await migrate(['--apply', '--source-paused', '--resume']);
  await new Promise(resolve => setTimeout(resolve, 1600));
  assert.equal(await a.get('music:short-lived'), null);
  assert.equal(await b.get('music:short-lived'), null);
  const verified = await migrate(['--verify']);
  assert.equal(verified.verification.ok, 1);
  assert.equal(verified.verification.sample.checked, 20);
  assert.equal(await a.dbSize(), before);
  assert.equal(await a.hGet('votes:test', 'en'), '42');
  const unsupported = { sendCommand: async () => { throw Error('secret-must-not-be-logged'); } };
  assert.equal((await probeFeatures(a, unsupported, new Map())).ok, 0);
  // Only numeric leaves are emitted; no key names, values, hashes or credentials.
  function assertCounters(value) {
    if (typeof value === 'object') for (const child of Object.values(value)) assertCounters(child);
    else assert.equal(typeof value, 'number');
  }
  assertCounters(dry);
  assertCounters(copy);
  assertCounters(verified);
  console.log('Redis migration tests passed: source opt-in, TLS target, dry-run capabilities, binary data, six types, stream groups, TTLs, 20 random checks, conflicts and non-overwriting resume.');
} finally {
  await Promise.allSettled(clients.filter(client => client.isOpen).map(client => client.disconnect()));
  for (const socket of sockets) socket.destroy();
  for (const proxy of [plain, encrypted]) if (proxy) await new Promise(resolve => proxy.close(resolve));
  if (server?.pid) {
    const exited = new Promise(resolve => server.once('exit', resolve));
    server.kill('SIGTERM');
    await exited;
  }
  await rm(directory, { recursive: true, force: true });
}
