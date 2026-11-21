export const INTRO_TTL = 86400;
export const TOKEN = /^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/;
const STORAGE = 'hackersbay-intros-v1';
let memory = [];

export function meetingFor(event, index) {
  const meeting = event.moments[index % event.moments.length];
  return meeting.time + ' · ' + meeting.place;
}

export function readIntros() {
  try {
    const value = localStorage.getItem(STORAGE) || sessionStorage.getItem(STORAGE);
    if (value) memory = JSON.parse(value);
  } catch { /* The current tab retains state while storage is unavailable. */ }
  return Array.isArray(memory) ? memory.filter(row => row?.createdAt > Date.now() - INTRO_TTL * 1000) : [];
}

export function saveIntro(intro) {
  memory = [...readIntros().filter(row => row.id !== intro.id), intro].slice(-40);
  const data = JSON.stringify(memory);
  try { localStorage.setItem(STORAGE, data); }
  catch { try { sessionStorage.setItem(STORAGE, data); } catch { /* Use memory. */ } }
  return intro;
}

export async function introRequest(action, payload) {
  const response = await fetch('/api/hackersbay?action=' + action, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload), signal: AbortSignal.timeout(5700)
  });
  if (!response.ok) throw new Error('Intro service unavailable');
  return response.json();
}

export function recipientUrl(intro) {
  const url = new URL('/hackersbay/intro', location.origin);
  url.searchParams.set('request', intro.id);
  if (!intro.shared) url.searchParams.set('demo', '1');
  url.hash = new URLSearchParams({ key: intro.key }).toString();
  return url.href;
}
