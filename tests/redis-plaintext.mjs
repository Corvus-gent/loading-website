import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../api/_redis.js', import.meta.url), 'utf8');
const raw = 'redis://default:fixture-secret@old.example:16379';
const until = '2026-11-20';
let now = Date.parse('2026-11-06T12:00:00Z');
const warnings = [];
let connections = 0;
let sends = 0;
const env = { REDIS_URL: raw, REDIS_PLAINTEXT_HOST: 'old.example', REDIS_PLAINTEXT_UNTIL: until };
class Clock extends Date { static now() { return now; } }
const context = vm.createContext({ URL, Date: Clock, process: { env }, console: { warn: text => warnings.push(text) } });
const dependency = new vm.SyntheticModule(['createClient'], function () {
  this.setExport('createClient', () => {
    connections++;
    return {
      on() {}, connect: async () => {},
      sendCommand: async () => { sends++; return 'PONG'; },
      multi: () => ({ addCommand() {}, execAsPipeline: async () => { sends++; return ['PONG']; } })
    };
  });
}, { context });
const module = new vm.SourceTextModule(source, { context });
await module.link(() => dependency);
await module.evaluate();
const { secureEndpoint, connectionEndpoint, plaintextExceptionUntil, redis, pipeline } = module.namespace;
assert.throws(() => secureEndpoint(raw), /encrypted/);
assert.throws(() => secureEndpoint('http://old.example', true), /encrypted/);
assert.equal(plaintextExceptionUntil(), until);
assert.equal(connectionEndpoint(), raw);
assert.equal(connectionEndpoint(), raw);
assert.deepEqual(warnings, ['redis plaintext exception active until 2026-11-20']);
assert.equal(await redis(['PING']), 'PONG');
assert.equal((await pipeline([['PING']]))[0], 'PONG');
assert.equal(connections, 1);
assert.equal(sends, 2);
assert.equal(warnings.length, 1);
for (const url of ['redis://old.example.evil', 'redis://sub.old.example', 'redis://other.example',
  'http://old.example', 'https://old.example', 'redis://old.example@other.example']) {
  assert.equal(plaintextExceptionUntil(url), null);
  assert.throws(() => connectionEndpoint(url), /encrypted/);
}
assert.equal(secureEndpoint('rediss://other.example'), 'rediss://other.example');
assert.equal(secureEndpoint('redis://127.0.0.1'), 'redis://127.0.0.1');
for (const invalid of ['', '2026-02-30', '2026-11-20T00:00:00Z', 'anything']) {
  env.REDIS_PLAINTEXT_UNTIL = invalid;
  assert.equal(plaintextExceptionUntil(), null);
  assert.throws(() => connectionEndpoint(), /encrypted/);
}
env.REDIS_PLAINTEXT_UNTIL = until;
env.REDIS_PLAINTEXT_HOST = 'OLD.EXAMPLE';
assert.equal(plaintextExceptionUntil(), null);
delete env.REDIS_PLAINTEXT_HOST;
assert.equal(plaintextExceptionUntil(), null);
env.REDIS_PLAINTEXT_HOST = 'old.example';
now = Date.parse('2026-11-19T23:59:59.999Z');
assert.equal(await redis(['PING']), 'PONG');
now++;
assert.equal(plaintextExceptionUntil(), null);
await assert.rejects(redis(['PING']), /encrypted/);
await assert.rejects(pipeline([['PING']]), /encrypted/);
assert.equal(connections, 1);
assert.equal(sends, 3);
assert.equal(warnings.length, 1);
console.log('Redis exception tests passed: strict validator, exact host, valid UTC deadline, warning redaction/deduplication, and expiry on reused command/pipeline connections.');
