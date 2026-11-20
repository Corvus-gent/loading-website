import { buildLog } from '../lib/hackersbay/build-log.js';
import { proofOfBuild } from '../lib/hackersbay/boat.js';
import { available, networkId } from '../lib/hackersbay/quota.js';
import { handleIntro } from '../lib/hackersbay/intros.js';
import { draftPersona } from '../lib/hackersbay/profile.js';
import { normalizeProfileUrl } from '../public/hackersbay/assets/persona.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const action = req.query?.action;
  if (req.method === 'GET' && action === 'log') {
    try { return await buildLog(res); }
    catch { return res.status(503).json({ error: 'Build log unavailable.' }); }
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Use POST.' });
  }
  if (req.headers['sec-fetch-site'] === 'cross-site') return res.status(403).json({ error: 'Open The Hackers Bay to continue.' });
  if (Number(req.headers['content-length']) > 2000) return res.status(413).json({ error: 'Send one public link.' });
  if (action === 'proof') return proofOfBuild(req, res);
  if (action === 'request-intro' && !await available('intro', networkId(req), 25, 300)) {
    return res.status(429).json({ error: 'Use the browser demo.' });
  }
  if (['request-intro', 'intro-status', 'accept-intro'].includes(action)) return handleIntro(action, req.body, res);
  if (action !== 'persona') return res.status(404).json({ error: 'Unknown action.' });
  try { normalizeProfileUrl(req.body?.url); }
  catch (error) { return res.status(400).json({ error: error.message }); }

  const privateMode = req.body.privateMode === true;
  const account = networkId(req);
  const integrations = await available('profile', account, 12, 300) && await available('profile', 'all', 120, 300);
  return res.status(200).json(await draftPersona(req.body.url, { privateMode, integrations }));
}
