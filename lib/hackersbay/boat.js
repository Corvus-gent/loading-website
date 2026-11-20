import { createHash } from 'node:crypto';
import { connected, redis } from '../../api/_redis.js';
import { DEMO_PREVIEW, boatPreviewUrl, normalizeRepo } from '../../public/hackersbay/assets/proof.js';
import { available, networkId } from './quota.js';

const API = 'https://boat.dev/api/v1';
const PORT = 4177;
const LIFETIME = 900;
const CACHE_SECONDS = 720;

function setupScript(repo) {
  return `set -eu
GIT_TERMINAL_PROMPT=0 git clone --depth 1 -- https://github.com/${repo}.git /home/user/hackersbay-preview
cd /home/user/hackersbay-preview
stack=static
if [ -f package.json ]; then
  stack=$(node -p "const p=require('./package.json'); const deps={...p.dependencies,...p.devDependencies}; deps.next && p.scripts?.dev ? 'next' : deps.vite && p.scripts?.dev ? 'vite' : 'static'")
fi
if [ "$stack" != static ]; then
  if [ -f package-lock.json ]; then npm ci --no-audit --no-fund; else npm install --no-audit --no-fund; fi
fi
case "$stack" in
  next) nohup npm run dev -- --hostname 0.0.0.0 --port ${PORT} </dev/null >/tmp/hackersbay-preview.log 2>&1 & ;;
  vite) nohup npm run dev -- --host 0.0.0.0 --port ${PORT} </dev/null >/tmp/hackersbay-preview.log 2>&1 & ;;
  static)
    test -f index.html
    nohup python3 -m http.server ${PORT} --bind 0.0.0.0 </dev/null >/tmp/hackersbay-preview.log 2>&1 & ;;
esac
for i in $(seq 1 20); do
  if curl --fail --silent --max-time 3 http://127.0.0.1:${PORT}/ >/dev/null; then exit 0; fi
  sleep 2
done
exit 1`;
}

async function boat(key, path, { body, idempotency } = {}) {
  const response = await fetch(API + path, {
    method: body ? 'POST' : 'GET', signal: AbortSignal.timeout(10000), redirect: 'error',
    headers: {
      Authorization: 'Bearer ' + key, 'Content-Type': 'application/json',
      ...(idempotency && { 'Idempotency-Key': idempotency })
    },
    ...(body && { body: JSON.stringify(body) })
  });
  if (!response.ok) {
    const error = new Error('Boat unavailable');
    error.status = response.status;
    throw error;
  }
  return response.json();
}

const demo = (repo, reason) => ({ mode: 'demo', repo, url: DEMO_PREVIEW, reason });

export async function proofOfBuild(req, res) {
  let repo;
  try { repo = normalizeRepo(req.body?.repo); }
  catch (error) { return res.status(400).json({ error: error.message }); }
  const apiKey = process.env.BOAT_DEV_API_KEY || process.env.BOAT_API_KEY;
  const approved = (process.env.HACKERSBAY_BOAT_REPOS || '').toLowerCase().split(/[\s,]+/).includes(repo);
  if (!apiKey || !approved || !connected()) return res.status(200).json(demo(repo, 'Example sandbox preview'));

  const cacheKey = 'hackersbay:v1:boat:' + repo;
  try {
    const stored = await redis(['GET', cacheKey]);
    const job = stored ? JSON.parse(stored) : null;
    if (job?.url) return res.status(200).json({ mode: 'boat', repo, url: job.url, expiresAt: job.expiresAt });
    if (job?.sandbox) {
      const sandboxPath = '/sandboxes/' + encodeURIComponent(job.sandbox);
      const { sandbox } = await boat(apiKey, sandboxPath);
      if (sandbox.setupStatus === 'failed' || ['stopped', 'error', 'deleted', 'archived'].includes(sandbox.status)) {
        return res.status(200).json(demo(repo, 'The repository did not start a preview'));
      }
      if (sandbox.setupStatus !== 'done') return res.status(202).json({ mode: 'building', repo });
      const hosted = await boat(apiKey, sandboxPath + '/host', { body: { port: PORT, public: false, title: 'Hackers Bay Proof of Build' } });
      const url = boatPreviewUrl(hosted.url);
      if (!url) return res.status(200).json(demo(repo, 'Preview URL unavailable'));
      const ttl = Math.max(1, Math.ceil((job.expiresAt - Date.now()) / 1000));
      await redis(['SET', cacheKey, JSON.stringify({ ...job, url }), 'EX', ttl]);
      return res.status(200).json({ mode: 'boat', repo, url, expiresAt: job.expiresAt });
    }

    if (!await available('proof', networkId(req), 2, 300) || !await available('proof', 'all', 10, 3600)) {
      return res.status(200).json(demo(repo, 'Live sandbox budget reached'));
    }
    // Retries within the same cache window resolve to one VM, including lost responses.
    const window = Math.floor(Date.now() / (LIFETIME * 1000));
    const idempotency = createHash('sha256').update('hackersbay:' + repo + ':' + window).digest('hex').slice(0, 40);
    let created;
    try {
      created = await boat(apiKey, '/sandboxes', {
        idempotency,
        body: { type: 'small', ttlSeconds: LIFETIME, noEnv: true, snapshots: false, visibility: 'private', setupScript: setupScript(repo), labels: { app: 'hackersbay' } }
      });
    } catch (error) {
      if (error.status === 409) return res.status(202).json({ mode: 'building', repo });
      throw error;
    }
    if (typeof created.sandbox?.id !== 'string') throw new Error('Missing sandbox id');
    const createdAt = Date.parse(created.sandbox.createdAt);
    const expiresAt = Math.min(Number.isFinite(createdAt) ? createdAt + LIFETIME * 1000 : Infinity, Date.now() + CACHE_SECONDS * 1000);
    const ttl = Math.max(1, Math.ceil((expiresAt - Date.now()) / 1000));
    if (ttl <= 1) return res.status(200).json(demo(repo, 'The previous sandbox has expired'));
    await redis(['SET', cacheKey, JSON.stringify({ sandbox: created.sandbox.id, expiresAt }), 'EX', ttl]);
    return res.status(202).json({ mode: 'building', repo });
  } catch {
    return res.status(200).json(demo(repo, 'Boat.dev unavailable'));
  }
}
