import { createHash } from 'node:crypto';
import { connected, redis } from '../../api/_redis.js';
import { INTRO_TTL, TOKEN, meetingFor } from '../../public/hackersbay/assets/intros.js';
import { PERSONAS } from '../../public/hackersbay/assets/persona.js';
import { normalizePirate } from '../../public/hackersbay/assets/pirate.js';
import event from '../../public/hackersbay/assets/event.json' with { type: 'json' };
import attendees from '../../public/hackersbay/assets/attendees.json' with { type: 'json' };

const prefix = 'hackersbay:v1:intro:';
const decideScript = `
  local raw = redis.call('GET', KEYS[1])
  if not raw then return false end
  local intro = cjson.decode(raw)
  if intro.secret ~= ARGV[1] then return false end
  if intro.status == 'pending' then
    intro.status = ARGV[2]
    raw = cjson.encode(intro)
    redis.call('SET', KEYS[1], raw, 'KEEPTTL')
  end
  return raw
`;

function hash(token) {
  return createHash('sha256').update(token).digest('hex');
}

export async function handleIntro(action, body, res) {
  const { id, key, personId, type } = body || {};
  if (typeof id !== 'string' || typeof key !== 'string' || !TOKEN.test(id) || !TOKEN.test(key)) return res.status(400).json({ error: 'Invalid intro link.' });
  if (!connected()) return res.status(503).json({ error: 'Use the browser demo.' });
  const storageKey = prefix + id;
  const secret = hash(key);

  try {
    let raw;
    if (action === 'request-intro') {
      const index = attendees.findIndex(person => person.id === personId);
      if (index < 0 || !Object.hasOwn(PERSONAS, type)) return res.status(400).json({ error: 'Unknown attendee or persona.' });
      const { bird, birdHat } = normalizePirate(body.parrot);
      const intro = {
        id, personId, type, secret, status: 'pending', createdAt: Date.now(),
        moment: meetingFor(event, index), parrot: { bird, birdHat }
      };
      const payload = JSON.stringify(intro);
      raw = await redis(['SET', storageKey, payload, 'NX', 'EX', INTRO_TTL]) ? payload : await redis(['GET', storageKey]);
    } else if (action === 'accept-intro' || action === 'decline-intro') {
      raw = await redis(['EVAL', decideScript, 1, storageKey, secret, action === 'accept-intro' ? 'mutual' : 'declined']);
    } else {
      raw = await redis(['GET', storageKey]);
    }
    if (!raw) return res.status(404).json({ error: 'Intro link expired or unavailable.' });
    const { secret: storedSecret, moment, ...intro } = JSON.parse(raw);
    if (storedSecret !== secret) return res.status(404).json({ error: 'Intro link expired or unavailable.' });
    return res.status(200).json({ ...intro, ...(intro.status === 'mutual' && { moment }) });
  } catch {
    return res.status(503).json({ error: 'Intro service unavailable.' });
  }
}
