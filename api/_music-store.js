import crypto from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { redis } from './_redis.js';

export const GENRES = ['us hip-hop', 'rap fr', 'rap nl/be', 'latin', 'lusophone', 'afro', 'pop 00s', 'electronic', 'rock', 'classics', 'soundtrack', 'funk & phonk'];
export const ORIGINS = ['https://corvus.gent', 'https://www.corvus.gent'];
export const validId = id => typeof id === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(id);
export const revision = raw => crypto.createHash('sha256').update(raw).digest('hex');
let seed;
export async function seedTracks() {
  seed ||= readFile(new URL('../music.json', import.meta.url), 'utf8').then(JSON.parse);
  return (await seed).tracks;
}
export async function loadTracks() {
  let raw = await redis(['GET', 'music:tracks']);
  if (!raw) {
    await redis(['SET', 'music:tracks', JSON.stringify(await seedTracks()), 'NX']);
    raw = await redis(['GET', 'music:tracks']);
  }
  if (!raw) throw new Error('storage unavailable');
  return { raw, tracks: JSON.parse(raw), revision: revision(raw) };
}
export function suggestion(id, raw) {
  try { const value = JSON.parse(raw); if (value && typeof value === 'object') return { ...value, id }; } catch {}
  return { id, title: String(raw), artist: '', spotifyId: /^[A-Za-z0-9]{22}$/.test(id) ? id : undefined };
}
export async function suggestions() {
  const pairs = await redis(['HGETALL', 'music:sugg']) || [];
  const rows = [];
  for (let i = 0; i < pairs.length; i += 2) rows.push(suggestion(pairs[i], pairs[i + 1]));
  return rows;
}
export const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Brussels', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

// Only trusted catalog hosts are fetched; never fetch a visitor-provided URL.
export function parseTrackLink(input) {
  if (typeof input !== 'string' || input.length > 2000) return null;
  const spotify = /^spotify:track:([A-Za-z0-9]{22})$/.exec(input.trim());
  if (spotify) return { provider: 'spotify', id: spotify[1] };
  try {
    const u = new URL(input.trim());
    if (u.protocol !== 'https:' || u.username || u.password || u.port) return null;
    if (u.hostname === 'open.spotify.com') {
      const m = /^\/(?:intl-[a-z-]+\/)?track\/([A-Za-z0-9]{22})\/?$/.exec(u.pathname);
      return m ? { provider: 'spotify', id: m[1] } : null;
    }
    if (u.hostname === 'music.apple.com') {
      const m = /^\/([a-z]{2})\/(album|song)\/(?:[^/]+\/)?(\d+)\/?$/.exec(u.pathname);
      const id = u.searchParams.get('i') || (m?.[2] === 'song' ? m[3] : null);
      return m && /^\d{1,20}$/.test(id || '') ? { provider: 'apple', id, country: m[1] } : null;
    }
  } catch {}
  return null;
}
export async function resolveLink(input) {
  const parsed = parseTrackLink(input);
  if (!parsed) throw Object.assign(new Error('invalid_link'), { status: 400 });
  if (parsed.provider === 'apple') {
    const response = await fetch(`https://itunes.apple.com/lookup?id=${parsed.id}&entity=song&country=${parsed.country}`, { signal: AbortSignal.timeout(7000), redirect: 'error' });
    if (!response.ok) throw Object.assign(new Error('catalog_unavailable'), { status: 502 });
    const data = await response.json();
    const track = data.results?.find(x => String(x.trackId) === parsed.id && x.kind === 'song');
    if (!track) throw Object.assign(new Error('unknown_track'), { status: 400 });
    return { id: `apple_${parsed.id}`, title: String(track.trackName).slice(0,180), artist: String(track.artistName).slice(0,180), appleId: parsed.id, appleUrl: `https://music.apple.com/${parsed.country}/song/${parsed.id}`, added: today() };
  }
  const response = await fetch(`https://open.spotify.com/oembed?url=https://open.spotify.com/track/${parsed.id}`, { signal: AbortSignal.timeout(7000), redirect: 'error' });
  if (!response.ok) throw Object.assign(new Error('unknown_track'), { status: 400 });
  const data = await response.json();
  if (!data.title) throw Object.assign(new Error('unknown_track'), { status: 400 });
  return { id: parsed.id, spotifyId: parsed.id, title: String(data.title).slice(0,180), artist: '', added: today() };
}
export function sameTrack(a,b) {
  const normalize = s => String(s || '').normalize('NFKD').replace(/\p{Diacritic}/gu,'').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
  return a.id === b.id || (a.spotifyId && a.spotifyId === b.spotifyId) || (a.appleId && a.appleId === b.appleId) || (a.artist && b.artist && normalize(a.title) === normalize(b.title) && normalize(a.artist) === normalize(b.artist));
}
