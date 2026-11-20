const hosts = new Set(['luma.com', 'www.luma.com', 'lu.ma', 'www.lu.ma']);

export function normalizeLumaUrl(input) {
  const raw = typeof input === 'string' ? input.trim() : '';
  if (!raw || raw.length > 320 || /\s/.test(raw)) throw new Error('Paste a public Luma event link.');

  let url;
  try { url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(raw) ? raw : 'https://' + raw); }
  catch { throw new Error('Paste a public Luma event link.'); }

  const path = url.pathname.replace(/\/$/, '').replace(/^\/embed\/event\//, '/event/');
  if (!['https:', 'http:'].includes(url.protocol) || !hosts.has(url.hostname) ||
    url.username || url.password || url.port ||
    !/^\/(?:[a-z\d][a-z\d_-]{0,119}|event\/evt-[a-z\d_-]{1,100})$/i.test(path)) {
    throw new Error('Use an event link from luma.com or lu.ma.');
  }
  return new URL(path, 'https://luma.com');
}

export const LUMA_DEMO_URL = 'https://luma.com/BoatHackathonDemos';
export const LUMA_SAMPLE = {
  title: 'Dockside Demo Jam',
  startsAt: '2026-11-21T17:30:00-08:00',
  endsAt: '2026-11-21T20:00:00-08:00',
  timezone: 'America/Los_Angeles',
  place: 'Sample waterfront venue · San Francisco',
  host: 'Dockside Crew',
  guestCount: '42'
};
