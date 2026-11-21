import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { handleTerminal, terminalActions } from '../lib/hackersbay/terminal.js';
import { countPirate, readCrewCounts } from '../lib/hackersbay/crew.js';
import { buildLog } from '../lib/hackersbay/build-log.js';
import { proofOfBuild, runParrotScout } from '../lib/hackersbay/boat.js';
import { available, networkId } from '../lib/hackersbay/quota.js';
import { eventActions, handleEvent } from '../lib/hackersbay/events.js';
import { handleIntro } from '../lib/hackersbay/intros.js';
import { loadLumaEvent } from '../lib/hackersbay/luma.js';
import { normalizeLumaUrl } from '../public/hackersbay/assets/luma.js';
import { draftPersona } from '../lib/hackersbay/profile.js';
import { normalizeProfileUrl } from '../public/hackersbay/assets/persona.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const action = req.query?.action;
  if (['GET', 'HEAD'].includes(req.method) && action === 'not-found') {
    res.status(404);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    const body = await readFile(resolve(process.cwd(), 'public/hackersbay/404.html'), 'utf8');
    return res.end(req.method === 'HEAD' ? undefined : body);
  }
  if (['GET', 'HEAD'].includes(req.method) && action === 'log') {
    try { return await buildLog(res); }
    catch { return res.status(503).json({ error: 'Build log unavailable.' }); }
  }
  if (req.method === 'GET' && action === 'crew-counts') {
    try { return res.status(200).json(await readCrewCounts()); }
    catch { return res.status(503).json({ available: false }); }
  }
  if (['GET', 'HEAD'].includes(req.method) && terminalActions.has(action)) return handleTerminal(action, req, res);
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Use POST.' });
  }
  if (req.headers['sec-fetch-site'] === 'cross-site') return res.status(403).json({ error: 'Open The Hackers Bay to continue.' });
  if (Number(req.headers['content-length']) > 2000) return res.status(413).json({ error: 'Send one public link.' });
  if (action === 'luma') {
    let url;
    try { url = normalizeLumaUrl(req.body?.url); }
    catch (error) { return res.status(400).json({ error: error.message }); }
    const permitted = await available('luma', networkId(req), 20, 60);
    const event = permitted ? await loadLumaEvent(url.href).catch(() => null) : null;
    return res.status(200).json({ event });
  }
  if (action === 'crew-pirate') {
    if (!await available('crew-pirate', networkId(req), 35, 300)) return res.status(429).json({ error: 'Try again in a few minutes.' });
    return countPirate(req.body, res);
  }
  if (eventActions.has(action)) {
    const limit = action === 'create-event' ? 8 : 90;
    if (!await available(action, networkId(req), limit, 300)) return res.status(429).json({ error: 'Try again in a few minutes.' });
    return handleEvent(action, req.body, res);
  }
  if (action === 'proof') return proofOfBuild(req, res);
  if (action === 'request-intro' && !await available('intro', networkId(req), 25, 300)) {
    return res.status(429).json({ error: 'Use the browser demo.' });
  }
  if (['request-intro', 'intro-status', 'accept-intro', 'decline-intro'].includes(action)) return handleIntro(action, req.body, res);
  if (action !== 'persona') return res.status(404).json({ error: 'Unknown action.' });
  try { normalizeProfileUrl(req.body?.url); }
  catch (error) { return res.status(400).json({ error: error.message }); }

  const privateMode = req.body.privateMode === true;
  const account = networkId(req);
  const integrations = await available('profile', account, 12, 300) && await available('profile', 'all', 120, 300);
  return res.status(200).json(await draftPersona(req.body.url, {
    privateMode, integrations, scout: excerpt => runParrotScout(excerpt, account)
  }));
}
