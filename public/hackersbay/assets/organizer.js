import { TOKEN } from './intros.js';

const storage = 'hackersbay:local-event:';

export function browserPirateId() {
  let id = localStorage.getItem('hackersbay:browser-pirate');
  if (!id || !TOKEN.test(id)) {
    id = crypto.randomUUID();
    localStorage.setItem('hackersbay:browser-pirate', id);
  }
  return id;
}

export function eventSelection() {
  const params = new URLSearchParams(location.search);
  const id = params.get('event');
  return id && TOKEN.test(id) ? { id, local: params.get('mode') === 'local' } : null;
}

export function eventLink(page, { id, local }) {
  const params = new URLSearchParams({ event: id });
  if (local) params.set('mode', 'local');
  return '/hackersbay/' + page + '?' + params;
}

export async function eventCall(action, body) {
  const res = await fetch('/api/hackersbay?action=' + action, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body), signal: AbortSignal.timeout(10000)
  });
  const data = await res.json();
  if (!res.ok) throw Object.assign(new Error(data.error || 'Event unavailable.'), { status: res.status });
  return data;
}

function localEvent(id) {
  const saved = localStorage.getItem(storage + id);
  if (!saved) throw new Error('Open this local preview in the browser where you created it.');
  return JSON.parse(saved);
}

export function previewEvent(details) {
  const event = { id: crypto.randomUUID(), ...details };
  const key = crypto.randomUUID();
  localStorage.setItem(storage + event.id, JSON.stringify({ event, key, attendees: [] }));
  return { event, key, local: true };
}

export async function readEvent({ id, local }, key) {
  if (!local) return eventCall(key === undefined ? 'get-event' : 'event-roster', { id, key });
  const { event, key: savedKey, attendees } = localEvent(id);
  if (key === undefined) return { event };
  if (key !== savedKey) throw new Error('Open your private organizer link to see this room.');
  return { event, attendees };
}

export async function boardEvent({ id, local }, card, share) {
  const member = browserPirateId();
  const { name, type, look } = card;
  const { builds, wants, offers } = card;
  const pirate = { id: member, name, type, look, ...(share && { builds, wants, offers }) };
  if (!local) return eventCall('board-event', { ...pirate, id, member, share });
  const record = localEvent(id);
  record.attendees = [...record.attendees.filter(entry => entry.id !== member), pirate];
  localStorage.setItem(storage + id, JSON.stringify(record));
}
