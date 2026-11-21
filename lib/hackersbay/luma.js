import { normalizeLumaUrl } from '../../public/hackersbay/assets/luma.js';
import { cleanText } from '../../public/hackersbay/assets/persona.js';

const PAGE_LIMIT = 900_000;

function parse(value) {
  try { return JSON.parse(value); }
  catch { return null; }
}

function types(node) {
  return [node?.['@type']].flat();
}

function eventEntities(value) {
  return [value].flat().flatMap(entry => [entry, ...(Array.isArray(entry?.['@graph']) ? entry['@graph'] : [])]);
}

function stringDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}(?:T|$)/.test(value) && Number.isFinite(Date.parse(value))
    ? value : null;
}

function timeZone(value) {
  try {
    if (typeof value === 'string' && value.length <= 70) return new Intl.DateTimeFormat('en-US', { timeZone: value }).resolvedOptions().timeZone;
  } catch { /* Date still has a published offset. */ }
  return null;
}

function placeName(locations, addressVisible) {
  const list = [locations].flat().filter(Boolean);
  const place = list.find(node => types(node).includes('Place'));
  if (!place) return list.some(node => types(node).includes('VirtualLocation')) ? 'Online' : null;
  const city = cleanText(place.address?.addressLocality, 80);
  const region = cleanText(place.address?.addressRegion, 50);
  const name = addressVisible ? cleanText(place.name, 120) : '';
  const area = [city, region].filter(Boolean).join(', ');
  if (!name || !city || name.toLowerCase().includes(city.toLowerCase())) return name || area || null;
  return name + ' · ' + area;
}

export function readPublicLumaPage(html) {
  let schemaEvent;
  let eventFlags;
  const rendered = html.replace(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi, (_tag, attrs, content) => {
    if (!schemaEvent && /(?:^|\s)type\s*=\s*["']application\/ld\+json["']/i.test(attrs)) {
      schemaEvent = eventEntities(parse(content)).find(node => types(node).includes('Event'));
    }
    if (/(?:^|\s)id\s*=\s*["']__NEXT_DATA__["']/i.test(attrs)) {
      const initial = parse(content)?.props?.pageProps?.initialData;
      if (initial?.kind === 'event') eventFlags = initial.data?.event;
    }
    return '';
  });

  if (!schemaEvent || eventFlags?.visibility && !['public', 'unlisted'].includes(eventFlags.visibility)) return null;
  const title = cleanText(schemaEvent.name, 180);
  if (!title) return null;
  const organizers = [schemaEvent.organizer].flat().filter(Boolean);
  const organizer = organizers.find(node => types(node).includes('Person') && cleanText(node.name)) || organizers.find(node => cleanText(node.name));

  // Read the number visible in Luma's public Going badge. Hydration totals can differ
  // from the displayed number and can exist when the badge is hidden.
  const badge = eventFlags?.show_guest_list === false ? null : rendered.match(
    /<(?:div|span)\b[^>]*\bclass\s*=\s*(["'])[^"']*\btitle-label\b[^"']*\1[^>]*>\s*([\d][\d.,\u00a0 ]{0,15}[kKmM+]{0,2})(?:\s*<!--[\s\S]*?-->)*\s*Going\s*<\//i
  );
  return {
    title,
    startsAt: stringDate(schemaEvent.startDate),
    endsAt: stringDate(schemaEvent.endDate),
    timezone: timeZone(eventFlags?.timezone),
    place: placeName(schemaEvent.location, !eventFlags?.geo_address_visibility || eventFlags.geo_address_visibility === 'public'),
    host: cleanText(organizer?.name, 100) || null,
    guestCount: cleanText(badge?.[2], 20) || null
  };
}

async function readHtml(response) {
  if (!response.body || Number(response.headers.get('content-length')) > PAGE_LIMIT) return '';
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let html = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) return html + decoder.decode();
      size += value.byteLength;
      if (size > PAGE_LIMIT) return '';
      html += decoder.decode(value, { stream: true });
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
}

export async function loadLumaEvent(source) {
  let url = normalizeLumaUrl(source);
  const signal = AbortSignal.timeout(5500);
  for (let hop = 0; hop < 3; hop++) {
    const response = await fetch(url, {
      redirect: 'manual', signal,
      headers: { Accept: 'text/html', 'User-Agent': 'HackersBay/1.0 (public event preview)' }
    });
    const location = response.headers.get('location');
    if ([301, 302, 303, 307, 308].includes(response.status) && location) {
      await response.body?.cancel();
      url = normalizeLumaUrl(new URL(location, url).href);
      continue;
    }
    if (!response.ok || !/^text\/html\b/i.test(response.headers.get('content-type') || '')) {
      await response.body?.cancel();
      return null;
    }
    return readPublicLumaPage(await readHtml(response));
  }
  return null;
}
