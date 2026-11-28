import { privacyEvent } from '../js/analytics-policy.js';

// The SDK sends one uncompressed JSON event. Forward only its allowlisted fields.
export const config = { api: { bodyParser: { sizeLimit: '32kb' } } };

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end();
  }
  if (req.headers['sec-fetch-site'] === 'cross-site') return res.status(403).end();
  if (req.headers.dnt === '1' || req.headers['sec-gpc'] === '1') return res.status(204).end();
  let event;
  try {
    event = privacyEvent(typeof req.body === 'string' ? JSON.parse(req.body) : req.body);
  } catch {
    return res.status(400).end();
  }
  if (!event) return res.status(400).end();
  if (process.env.VERCEL_ENV === 'preview') return res.status(204).end();
  const key = process.env.POSTHOG_PROJECT_KEY;
  if (!key) return res.status(503).end();
  event.properties.token = key;
  const payload = { event: event.event, properties: event.properties };
  if (typeof event.uuid === 'string' && /^[\da-f-]{36}$/i.test(event.uuid)) payload.uuid = event.uuid;
  if (typeof event.timestamp === 'string' && Number.isFinite(Date.parse(event.timestamp))) {
    payload.timestamp = new Date(event.timestamp).toISOString();
  }
  try {
    const upstream = await fetch('https://eu.i.posthog.com/e/', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, redirect: 'error',
      body: JSON.stringify(payload), signal: AbortSignal.timeout(4000),
    });
    return res.status(upstream.ok ? 200 : 502).json({ status: upstream.ok ? 1 : 0 });
  } catch {
    return res.status(502).end();
  }
}
