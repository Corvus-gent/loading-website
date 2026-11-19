import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
const source = await fs.readFile(new URL('../api/_redis.js', import.meta.url), 'utf8');
async function fixture(mode) {
  let created = 0, disconnected = 0, options;
  const pending = () => new Promise(() => {});
  const context = vm.createContext({ URL, AbortController, console, setTimeout: (fn, ms) => setTimeout(fn, Math.min(ms, 15)), clearTimeout, process: { env: mode.startsWith('rest') ? { KV_REST_API_URL: 'https://fixture.invalid', KV_REST_API_TOKEN: 'fixture' } : { REDIS_URL: 'redis://127.0.0.1:16380/15' } }, fetch: (_url, { signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(Error('aborted')), { once: true })) });
  const redisDependency = new vm.SyntheticModule(['createClient'], function () {
    this.setExport('createClient', opts => {
      created++; options = opts;
      return {
        isOpen: true,
        on() {},
        connect: () => mode === 'connect' ? pending() : Promise.resolve(),
        disconnect() { disconnected++; this.isOpen = false; return Promise.resolve(); },
        sendCommand: () => mode === 'command' ? pending() : Promise.resolve('PONG'),
        multi: () => ({ addCommand() {}, execAsPipeline: pending })
      };
    });
  }, { context });
  const module = new vm.SourceTextModule(source, { context });
  await module.link(() => redisDependency); await module.evaluate();
  return { api: module.namespace, state: () => ({ created, disconnected, options }) };
}
for (const mode of ['connect', 'command', 'pipeline', 'rest-command', 'rest-pipeline']) {
  const f = await fixture(mode);
  const command = () => mode.includes('pipeline') ? f.api.pipeline([['PING']]) : f.api.redis(['PING']);
  await assert.rejects(command(), /timed out|aborted/);
  if (!mode.startsWith('rest')) {
    await new Promise(r => setTimeout(r, 0));
    assert.equal(f.state().disconnected, 1, mode + ': close a stalled channel');
    assert.equal(f.state().options.disableOfflineQueue, true);
    await assert.rejects(command(), /timed out/);
    assert.equal(f.state().created, 2, mode + ': recreate the client on the next request');
  }
}
console.log('PASS: bounded TCP connect/command/pipeline and REST deadlines, channel cleanup and reconnect.');
