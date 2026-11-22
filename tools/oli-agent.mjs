import { execFile } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as wait } from 'node:timers/promises';
import { promisify } from 'node:util';
import { put } from '@vercel/blob';
import { blobOptions } from '../api/_oli/blob-config.js';
import { sealMedia } from '../api/_oli/sealed-media.js';
import { applyEdit, validateTimeline } from '../api/_oli/timeline.js';
import { loadCompoundEnv } from './compound-env.mjs';

const exec = promisify(execFile);
const stop = new AbortController();
process.once('SIGINT', () => stop.abort());
process.once('SIGTERM', () => stop.abort());

class AgentError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function check(command, args, help) {
  try { await exec(command, args); }
  catch { throw new AgentError(help); }
}

async function api(action, body) {
  let response;
  try {
    response = await fetch(new URL(`/api/oli/agent/${action}`, process.env.OLI_ORIGIN || 'https://corvus.gent'), {
      method: body ? 'POST' : 'GET',
      redirect: 'error',
      headers: { Authorization: `Bearer ${process.env.OLI_AGENT_TOKEN}`, 'Content-Type': 'application/json' },
      body: body && JSON.stringify(body),
      signal: AbortSignal.timeout(15_000)
    });
  } catch { throw new AgentError('Review server could not be reached.'); }
  if (!response.ok) throw new AgentError(`Review server rejected ${action} (HTTP ${response.status}).`, response.status);
  return response.json();
}

async function report(action, body) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try { return await api(action, body); }
    catch (error) {
      if (attempt === 2 || (error.status && error.status < 500)) throw error;
      await wait(2000);
    }
  }
}

async function run(command, args, cwd, reason, timeout = 300_000) {
  try {
    await exec(command, args, { cwd, timeout, signal: stop.signal });
  } catch { throw new AgentError(reason); }
}

async function publish(input, variant, temp, isSeed = false) {
  const output = path.join(temp, `review-${variant}.mp4`);
  const dimensions = variant === 'long' ? '1280:720' : '720:1280';
  await run('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-i', input, '-map', '0:v:0', '-map', '0:a?',
    '-vf', `scale=${dimensions}:force_original_aspect_ratio=decrease:force_divisible_by=2`,
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '25', '-maxrate', '1100k', '-bufsize', '2200k',
    '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart',
    '-map_metadata', '-1', '-y', output
  ], temp, 'Video optimisation failed.');
  const id = isSeed ? await contentId(output) : randomUUID();
  const { size } = await fs.stat(output);
  try {
    const options = blobOptions();
    const filename = `oli/${variant}/${id}.mp4`;
    const input = createReadStream(output);
    const encrypted = options.access === 'public';
    const blob = await put(encrypted ? filename + '.enc' : filename, encrypted ? sealMedia(input, filename) : input, {
      ...options,
      contentType: encrypted ? 'application/octet-stream' : 'video/mp4',
      multipart: size > 8 * 1024 ** 2, allowOverwrite: isSeed,
      abortSignal: AbortSignal.any([stop.signal, AbortSignal.timeout(180_000)])
    });
    return blob.url;
  } catch { throw new AgentError('Private video upload failed.'); }
}

async function contentId(file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex').slice(0, 32).replace(/^(........)(....)(....)(....)/, '$1-$2-$3-$4-');
}

async function temporary(runInTemp) {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'oli-review-'));
  try { return await runInTemp(temp); }
  finally { await fs.rm(temp, { recursive: true, force: true }); }
}

async function seedTrailers(workdir) {
  const timeline = JSON.parse(await fs.readFile(path.join(workdir, 'timeline.json'), 'utf8'));
  try { validateTimeline(timeline); } catch (error) { throw new AgentError(error.message); }
  await temporary(async temp => {
    for (const variant of ['en', 'zh']) {
      const versionUrl = await publish(path.join(workdir, `oli-trailer-v2-${variant}.mp4`), variant, temp, true);
      await report('seed', { variant, timeline, versionUrl, label: 'v2' });
      console.log(`Seeded ${variant} v2.`);
    }
  });
}

async function render(job, workdir) {
  const { id, claim, variant, summary } = job;
  let result;
  try {
    if (variant === 'long' && !process.env.OLI_LONG_WORKDIR) throw new AgentError('The long-form renderer is not configured.');
    const source = variant === 'long' ? path.resolve(process.env.OLI_LONG_WORKDIR) : workdir;
    const timeline = applyEdit(job.timeline, job, variant);
    result = await temporary(async temp => {
      for (const entry of ['render.py', 'build.py', 'fonts', 'selects', 'drive-ids.json']) {
        await fs.cp(path.join(source, entry), path.join(temp, entry), { recursive: true, dereference: true });
      }
      await fs.writeFile(path.join(temp, 'timeline.json'), JSON.stringify(timeline, null, 2));
      const cut = path.join(temp, 'rendered.mp4');
      await run('python3', ['render.py', temp], temp, 'Overlay rendering failed.');
      await run('python3', ['build.py', temp, variant, cut], temp, 'Video build failed.', 600_000);
      return { id, claim, status: 'live', versionUrl: await publish(cut, variant, temp), changelog: summary, timeline };
    });
  } catch (error) {
    result = { id, claim, status: 'failed', reason: error instanceof AgentError ? error.message : 'Could not apply the edit or read the local render files.' };
  }
  await report('result', result);
  console.log(`${variant} render ${result.status}.`);
}

async function main() {
  await check('ffmpeg', ['-version'], 'Install ffmpeg: brew install ffmpeg');
  await check('python3', ['--version'], 'Install Python: brew install python');
  await check('python3', ['-c', 'from PIL import Image'], 'Install Pillow: python3 -m pip install --user Pillow');
  try { loadCompoundEnv(); } catch (error) { throw new AgentError(error.message); }
  if (!process.env.OLI_AGENT_TOKEN || !blobOptions().token) {
    throw new AgentError('Set OLI_AGENT_TOKEN and a Blob token in the compound secrets file.');
  }
  const origin = new URL(process.env.OLI_ORIGIN || 'https://corvus.gent');
  if (origin.protocol !== 'https:') throw new AgentError('OLI_ORIGIN must use HTTPS.');
  const workdir = path.resolve(process.env.OLI_WORKDIR || path.join(os.homedir(), 'Downloads/oli-trailer-work'));
  if (!await fs.stat(workdir).then(stat => stat.isDirectory(), () => false)) throw new AgentError('The Oli workdir is missing.');
  if (process.argv[2] === 'seed') return seedTrailers(workdir);
  if (process.argv[2]) throw new AgentError('Use npm run oli-agent or npm run oli-agent -- seed.');
  console.log('Oli agent ready. Waiting for edits.');
  while (!stop.signal.aborted) {
    try {
      const { job } = await api('next');
      if (job) await render(job, workdir);
    } catch (error) {
      console.error(error instanceof AgentError ? error.message : 'Agent request failed. Retrying.');
    }
    if (!stop.signal.aborted) await wait(10_000, null, { signal: stop.signal }).catch(() => {});
  }
}

try { await main(); }
catch (error) {
  console.error(error instanceof AgentError ? error.message : 'Oli agent could not start. Check the workdir and configuration.');
  process.exitCode = 1;
}
