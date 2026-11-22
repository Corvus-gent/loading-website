import { createHash, randomUUID } from 'node:crypto';
import { connected, redis } from '../../api/_redis.js';
import { TOKEN } from '../../public/hackersbay/assets/intros.js';
import { cleanText, PERSONAS } from '../../public/hackersbay/assets/persona.js';
import { normalizeLook } from '../../public/hackersbay/assets/wardrobe.js';
import { normalizeLumaUrl } from '../../public/hackersbay/assets/luma.js';

const ttl = 90 * 86400;
const eventKey = id => 'hackersbay:v1:event:{' + id + '}';
const rosterKey = id => eventKey(id) + ':crew';
const token = value => typeof value === 'string' && TOKEN.test(value);
const digest = value => createHash('sha256').update(value).digest('hex');
const publicEvent = ({id, title, startsAt, place, host, source}) => ({id, title, startsAt, place, host, source});
const addToRoster = `
  if redis.call('EXISTS', KEYS[1]) == 0 then return -1 end
  if redis.call('HLEN', KEYS[2]) >= 500 and redis.call('HEXISTS', KEYS[2], ARGV[1]) == 0 then return -2 end
  redis.call('HSET', KEYS[2], ARGV[1], ARGV[2])
  redis.call('EXPIRE', KEYS[2], redis.call('TTL', KEYS[1]))
  return redis.call('HLEN', KEYS[2])
`;

export const eventActions = new Set(['create-event', 'get-event', 'event-roster', 'board-event']);

export async function handleEvent(action, payload, res) {
  const body = payload || {};
  if (!connected()) return res.status(503).json({ error: 'Shared events need a connected store.' });

  try {
    if (action === 'create-event') {
      const title = cleanText(body.title, 90);
      if (!title) return res.status(400).json({ error: 'Add an event name.' });
      let source = '';
      if (body.source) {
        try { source = normalizeLumaUrl(body.source).href; }
        catch (error) { return res.status(400).json({ error: error.message }); }
      }
      const id = randomUUID();
      const key = randomUUID();
      const event = {
        id, title, source, secret: digest(key),
        startsAt: cleanText(body.startsAt, 100), place: cleanText(body.place, 100), host: cleanText(body.host, 70)
      };
      await redis(['SET', eventKey(id), JSON.stringify(event), 'EX', ttl]);
      return res.status(201).json({ event: publicEvent(event), key });
    }

    const { id, key, member } = body;
    if (!token(id)) return res.status(400).json({ error: 'Invalid event invite.' });
    const raw = await redis(['GET', eventKey(id)]);
    if (!raw) return res.status(404).json({ error: 'That event invite has expired or is unavailable.' });
    const event = JSON.parse(raw);
    if (action === 'get-event') return res.status(200).json({ event: publicEvent(event) });
    if (action === 'event-roster') {
      if (!token(key) || digest(key) !== event.secret) return res.status(403).json({ error: 'Open your private organizer link to see this room.' });
      const entries = await redis(['HVALS', rosterKey(id)]);
      return res.status(200).json({ event: publicEvent(event), attendees: entries.map(entry => JSON.parse(entry)) });
    }

    const name = cleanText(body.name, 48);
    if (!token(member) || !name || !Object.hasOwn(PERSONAS, body.type)) return res.status(400).json({ error: 'Save a name and class before boarding.' });
    const pirate = { id: member, name, type: body.type, look: normalizeLook(body.look) };
    if (body.share === true) for (const field of ['builds', 'wants', 'offers']) pirate[field] = cleanText(body[field]);
    const count = Number(await redis(['EVAL', addToRoster, 2, eventKey(id), rosterKey(id), member, JSON.stringify(pirate)]));
    if (count === -1) return res.status(404).json({ error: 'That event invite has expired or is unavailable.' });
    if (count === -2) return res.status(409).json({ error: 'This invite has reached its registration limit.' });
    return res.status(200).json({ boarded: true });
  } catch {
    return res.status(503).json({ error: 'The event service is temporarily unavailable.' });
  }
}
