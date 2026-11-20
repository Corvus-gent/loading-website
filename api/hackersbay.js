import { draftPersona } from '../lib/hackersbay/profile.js';
import { normalizeProfileUrl } from '../public/hackersbay/assets/persona.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Use POST.' });
  }
  if (req.headers['sec-fetch-site'] === 'cross-site') return res.status(403).json({ error: 'Open The Hackers Bay to continue.' });
  if (req.query?.action !== 'persona') return res.status(404).json({ error: 'Unknown action.' });
  if (Number(req.headers['content-length']) > 2000) return res.status(413).json({ error: 'Send one public link.' });
  try { normalizeProfileUrl(req.body?.url); }
  catch (error) { return res.status(400).json({ error: error.message }); }

  return res.status(200).json(await draftPersona(req.body.url));
}
