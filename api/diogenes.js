// Diogenes at the curtain: a short, public-facts-only chat. Nothing is stored.
import {dailyIPHash, rateLimit} from './_privacy.js';
import {PERSONAS, fallbackReply} from '../lib/diogenes/knowledge.js';

const clean = (value, max) => typeof value === 'string' ? value.replace(/[\x00-\x08\x0b-\x1f\x7f]/g, ' ').trim().slice(0, max) : '';

export function createHandler({send = fetch, limit = rateLimit, ip = dailyIPHash, key = () => process.env.DIOGENES_OPENAI_API_KEY || process.env.OPENAI_API_KEY, model = () => process.env.DIOGENES_MODEL || 'gpt-4.1-mini'} = {}) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method === 'GET' && req.query?.health === '1') {
      return res.status(200).json({configured: Boolean(key()), model: model()});
    }
    if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({error: 'Speak with a POST.'}); }
    const origins = ['https://corvus.gent', 'https://www.corvus.gent', ...['VERCEL_URL', 'VERCEL_BRANCH_URL'].map(k => process.env[k] && 'https://' + process.env[k])];
    if (!origins.includes(req.headers.origin) || !String(req.headers['content-type'] || '').startsWith('application/json')) return res.status(403).json({error: 'Diogenes only talks at the curtain.'});
    const body = typeof req.body === 'object' && req.body ? req.body : {};
    const persona = body.persona === 'gabe' ? 'gabe' : 'diogenes';
    const messages = (Array.isArray(body.messages) ? body.messages : []).slice(-10)
      .map(m => ({role: m?.role === 'assistant' ? 'assistant' : 'user', content: clean(m?.content, 500)}))
      .filter(m => m.content);
    const last = messages.filter(m => m.role === 'user').at(-1);
    if (!last) return res.status(400).json({error: 'Say something first.'});
    const turn = messages.filter(m => m.role === 'user').length - 1;
    try {
      if (!await limit('diogenes:hour:' + ip(req, 'diogenes'), 30, 3600) || !await limit('diogenes:global', 3000, 86400))
        return res.status(429).json({reply: 'My lantern needs oil. Come back in a while, or enter the realm.', mode: 'resting'});
    } catch { /* No Redis: answer with the scripted lines only. */ return res.status(200).json({reply: fallbackReply(last.content, turn), mode: 'fallback'}); }
    if (!key()) return res.status(200).json({reply: fallbackReply(last.content, turn), mode: 'fallback'});
    try {
      const r = await send('https://api.openai.com/v1/chat/completions', {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000),
        headers: {Authorization: 'Bearer ' + key(), 'Content-Type': 'application/json'},
        body: JSON.stringify({model: model(), max_tokens: 160, temperature: 0.8, messages: [{role: 'system', content: PERSONAS[persona]}, ...messages]})
      });
      if (!r.ok) throw Error('model');
      const data = await r.json();
      const reply = clean(data?.choices?.[0]?.message?.content, 700);
      if (!reply) throw Error('empty');
      return res.status(200).json({reply, mode: 'llm'});
    } catch {
      return res.status(200).json({reply: fallbackReply(last.content, turn), mode: 'fallback'});
    }
  };
}
export default createHandler();
