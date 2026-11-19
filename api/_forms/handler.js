import { createHash, timingSafeEqual } from 'node:crypto';
import { formStore } from './store.js';
import { formService, csv, FormError } from './service.js';
import { sendFormMail } from './mail.js';
import { rateLimit, dailyIPHash } from '../_privacy.js';
const equal = (a, b) => !!b && timingSafeEqual(createHash('sha256').update(String(a || '')).digest(), createHash('sha256').update(b).digest());
export function formHandler({ forms, store = formStore(), send = sendFormMail, env = process.env, throttle = rateLimit, ipHash = dailyIPHash, now } = {}) {
  const service = formService({ store, send, now });
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    const action = req.query?.action;
    try {
      if (action === 'digest') {
        if (req.method !== 'GET') throw new FormError('Method not allowed.', 405);
        if (!equal(req.headers.authorization, env.CRON_SECRET && 'Bearer ' + env.CRON_SECRET)) throw new FormError('Unauthorized.', 401);
        return res.status(200).json(await service.digest(Object.values(forms)));
      }
      if (action === 'export') {
        if (req.method !== 'GET') throw new FormError('Method not allowed.', 405);
        if (!equal(req.query.token, env.ADMIN_TOKEN)) throw new FormError('Unauthorized.', 401);
        const form = Object.hasOwn(forms, req.query.slug || '') ? forms[req.query.slug] : null;
        if (!form) throw new FormError('Form not found.', 404);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${form.slug}-responses.csv"`);
        return res.status(200).send(csv(form, await store.list(form.slug)));
      }
      if (!['save', 'flush'].includes(action)) throw new FormError('Not found.', 404);
      if (req.method !== 'POST') throw new FormError('Method not allowed.', 405);
      const allowed = new Set(['https://corvus.gent', 'https://www.corvus.gent']);
      if (env.VERCEL_URL) allowed.add('https://' + env.VERCEL_URL);
      if (env.NODE_ENV !== 'production') { allowed.add('http://localhost:3000'); allowed.add('http://127.0.0.1:3000'); }
      if (!allowed.has(req.headers.origin)) throw new FormError('Forbidden.', 403);
      if (!await throttle('forms:ip:' + ipHash(req, 'forms'), 180, 60)) throw new FormError('Please wait before trying again.', 429);
      let body = req.body;
      if (Buffer.isBuffer(body)) body = body.toString('utf8');
      if (typeof body === 'string') {
        if (Buffer.byteLength(body) > 96000) throw new FormError('Response too large.', 413);
        try { body = JSON.parse(body); } catch { throw new FormError('Invalid JSON.'); }
      }
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw new FormError('Invalid request.');
      if (Buffer.byteLength(JSON.stringify(body)) > 96000) throw new FormError('Response too large.', 413);
      const form = Object.hasOwn(forms, body.slug || '') ? forms[body.slug] : null;
      if (!form) throw new FormError('Form not found.', 404);
      if (action === 'save') {
        const row = await service.save(form, body);
        return res.status(200).json({ saved: true, updatedAt: row.updatedAt });
      }
      const result = await service.flush(form, body);
      return res.status(result.pending ? 202 : 200).json(result);
    } catch (error) {
      const status = error instanceof FormError ? error.status : 503;
      return res.status(status).json({ error: status === 503 ? 'Temporarily unavailable. Your draft is still saved on this device; please retry.' : error.message });
    }
  };
}
