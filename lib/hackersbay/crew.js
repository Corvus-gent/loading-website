import { createHash } from 'node:crypto';
import { connected, redis } from '../../api/_redis.js';
import { PERSONAS } from '../../public/hackersbay/assets/persona.js';
import { TOKEN } from '../../public/hackersbay/assets/intros.js';

const prefix = 'hackersbay:v1:crew:';

export async function recordCrew(kind, id) {
  const hash = createHash('sha256').update(id).digest('hex');
  return redis(['SADD', prefix + kind, hash]);
}

export async function readCrewCounts() {
  if (!connected()) return { available: false };
  const [pirates, mutuals] = await Promise.all(['pirates', 'mutuals'].map(kind => redis(['SCARD', prefix + kind])));
  return { available: true, pirates: Number(pirates), mutuals: Number(mutuals) };
}

export async function countPirate(body, res) {
  const { id, type } = body || {};
  if (typeof id !== 'string' || !TOKEN.test(id) || !Object.hasOwn(PERSONAS, type)) return res.status(400).json({ error: 'Save a pirate before raising the flag.' });
  if (!connected()) return res.status(503).json({ error: 'Live counts need a connected store.' });
  try {
    await recordCrew('pirates', id);
    return res.status(200).json({ counted: true });
  } catch {
    return res.status(503).json({ error: 'Live counts are temporarily unavailable.' });
  }
}
