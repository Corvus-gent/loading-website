import { element } from './event-data.js';
import { DEFAULT_DEMO_LENS, getPersona, PERSONAS } from './persona.js';
import { LUMA_DEMO_URL, LUMA_SAMPLE, normalizeLumaUrl } from './luma.js';

const form = document.querySelector('#sink-form');
const field = form.elements.url;
const submit = form.querySelector('button[type="submit"]');
const example = document.querySelector('#sink-example');
const status = document.querySelector('#sink-status');
const result = document.querySelector('#sink-result');
const title = document.querySelector('#sink-event-title');
const source = document.querySelector('#sink-source');
const original = document.querySelector('#sink-original');
const lens = document.querySelector('#sink-lens');
const lensTitle = document.querySelector('#sink-lens-title');
const lensNotes = document.querySelector('#sink-lens-notes');
let listing;

for (const [type, persona] of Object.entries(PERSONAS)) lens.add(new Option(persona.title, type));
lens.value = getPersona()?.type || DEFAULT_DEMO_LENS;

function schedule(event) {
  const raw = event.startsAt;
  if (!raw) return 'Not listed';
  const offset = raw.match(/([+-]\d{2}:\d{2})$/)?.[1];
  const hasTime = raw.includes('T');
  const date = new Date(!event.timezone && offset ? raw.slice(0, -offset.length) + 'Z' : raw);
  return new Intl.DateTimeFormat('en-US', {
    timeZone: hasTime && event.timezone || 'UTC',
    month: 'short', day: 'numeric', year: 'numeric',
    ...(hasTime && { hour: 'numeric', minute: '2-digit', ...((event.timezone || !offset) && { timeZoneName: 'short' }) })
  }).format(date) + (!event.timezone && offset ? ' UTC' + offset : '');
}

function timeCost(event) {
  const minutes = Math.round((Date.parse(event.endsAt) - Date.parse(event.startsAt)) / 60000);
  if (!(minutes > 0)) return event.startsAt ? 'Start time is listed. Check when it ends.' : 'Ask the host for the schedule.';
  return [Math.floor(minutes / 60) ? Math.floor(minutes / 60) + ' hr' : '', minutes % 60 ? minutes % 60 + ' min' : ''].filter(Boolean).join(' ');
}

function useLens(type, event) {
  const going = event.guestCount ? event.guestCount + ' marked Going on the public listing.' : 'Guest count is unlisted.';
  const host = event.host || 'the event host';
  if (type === 'hacker') return [
    ['Travel', event.place === 'Online' ? 'The listing says this event is online.' : event.place ? 'Estimate your trip to ' + event.place + '.' : 'Ask ' + host + ' where to meet.'],
    ['Food and sleep', 'Check meals and overnight options with ' + host + '.'],
    ['Prize and payout', 'Confirm the prize pool and payout date before you spend.']
  ];
  if (type === 'builder') return [
    ['Time cost', timeCost(event)],
    ['Room size', going],
    ['Builder fit', 'Ask ' + host + ' who is building and whether there’s time to meet.']
  ];
  if (type === 'connector') return [
    ['Start with', event.host || 'Look for the organizer on the event listing.'],
    ['Room size', going],
    ['Make one intro', 'Ask for an introduction around one shared interest.']
  ];
  return [
    ['Organizer', event.host || 'Check the event listing for an organizer.'],
    ['Public reach', going],
    ['Sponsor fit', 'Ask about audience, sponsorship terms, and how outcomes are measured.']
  ];
}

function showFacts(container, facts) {
  container.replaceChildren(...facts.map(([key, value]) => {
    const row = element('div');
    row.append(element('dt', key), element('dd', value));
    return row;
  }));
}

function updateLens() {
  if (!listing) return;
  lensTitle.textContent = PERSONAS[lens.value].lens;
  showFacts(lensNotes, useLens(lens.value, listing));
}

function showEvent(event, url) {
  listing = event || LUMA_SAMPLE;
  source.textContent = event ? 'PUBLIC LUMA LISTING' : 'FICTIONAL SAMPLE · DEMO DATA';
  title.textContent = listing.title;
  showFacts(document.querySelector('#sink-facts'), [
    ['When', schedule(listing)], ['Where', listing.place || 'Not listed'],
    ['Host', listing.host || 'Not listed'], ['Guest count', listing.guestCount ? listing.guestCount + ' Going' : 'Not listed']
  ]);
  original.href = url.href;
  original.hidden = !event;
  updateLens();
  result.hidden = false;
  title.focus();
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  let url;
  try { url = normalizeLumaUrl(field.value); }
  catch (error) { status.textContent = error.message; field.focus(); return; }

  submit.disabled = true;
  example.disabled = true;
  result.hidden = true;
  status.textContent = 'Reading the public Luma listing…';
  let listingData;
  try {
    const response = await fetch('/api/hackersbay?action=luma', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: url.href }),
      signal: AbortSignal.timeout(7500)
    });
    if (response.ok) listingData = (await response.json()).event;
  } catch { /* The sample is available even when the endpoint is unreachable. */ }

  submit.disabled = false;
  example.disabled = false;
  status.textContent = listingData ? '' : 'Couldn’t read the public listing. Showing a fictional sample.';
  showEvent(listingData, url);
});

example.addEventListener('click', () => {
  field.value = LUMA_DEMO_URL;
  form.requestSubmit();
});
lens.addEventListener('change', updateLens);
