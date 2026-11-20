import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadLumaEvent, readPublicLumaPage } from '../lib/hackersbay/luma.js';
import { normalizeLumaUrl } from '../public/hackersbay/assets/luma.js';

function page(flags = {}, badge = '') {
  const schema = {
    '@type': 'Event', name: 'Dockside Demo Jam', startDate: '2026-11-21T17:30:00-08:00',
    endDate: '2026-11-21T20:00:00-08:00', location: {
      '@type': 'Place', name: 'Dockside Hall',
      address: { addressLocality: 'San Francisco', addressRegion: 'CA', streetAddress: 'Guest-only address' }
    },
    organizer: [{ '@type': 'Organization', name: 'Dockside Calendar' }, { '@type': 'Person', name: 'Mina Park', email: 'private@example.com' }]
  };
  const hydration = { props: { pageProps: { initialData: { kind: 'event', data: {
    event: { visibility: 'public', timezone: 'America/Los_Angeles', ...flags },
    guest_count: 999, guest_data: [{ name: 'Guest record' }]
  } } } } };
  return '<script type="application/ld+json">' + JSON.stringify(schema) + '</script>' +
    '<script id="__NEXT_DATA__">' + JSON.stringify(hydration) + '</script>' + badge;
}

test('imports only the six public event facts and the date zone', () => {
  const event = readPublicLumaPage(page({}, '<div class="some title-label">1,012 <!-- -->Going</div>'));
  assert.deepEqual(event, {
    title: 'Dockside Demo Jam', startsAt: '2026-11-21T17:30:00-08:00', endsAt: '2026-11-21T20:00:00-08:00',
    timezone: 'America/Los_Angeles', place: 'Dockside Hall · San Francisco, CA',
    host: 'Mina Park', guestCount: '1,012'
  });
});

test('preserves the public city, hides unpublished totals, and rejects private events', () => {
  const badge = '<div class="title-label">10 Going</div>';
  const event = readPublicLumaPage(page({ show_guest_list: false, geo_address_visibility: 'guests-only' }, badge));
  assert.equal(event.place, 'San Francisco, CA');
  assert.equal(event.guestCount, null);
  assert.equal(readPublicLumaPage(page()).guestCount, null);
  assert.equal(readPublicLumaPage(page({ visibility: 'private' })), null);
  assert.equal(readPublicLumaPage('<title>Luma</title>'), null);
});

test('normalizes branded event links and drops query tokens', () => {
  assert.equal(normalizeLumaUrl('lu.ma/example?tk=value#details').href, 'https://luma.com/example');
  assert.equal(normalizeLumaUrl('https://luma.com/embed/event/evt-1234').pathname, '/event/evt-1234');
  for (const url of ['https://example.com/event', 'https://luma.com.example.com/event', 'https://user@luma.com/event',
    'https://luma.com:8080/event', 'https://luma.com//example.com', 'ftp://luma.com/event']) {
    assert.throws(() => normalizeLumaUrl(url));
  }
});

test('follows a Luma redirect and refuses to fetch outside Luma', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', async url => url.pathname === '/first'
    ? Response.redirect('https://luma.com/second')
    : new Response(page(), { headers: { 'Content-Type': 'text/html' } }));
  assert.equal((await loadLumaEvent('https://lu.ma/first')).title, 'Dockside Demo Jam');
  assert.deepEqual(fetch.mock.calls.map(call => call.arguments[0].href), ['https://luma.com/first', 'https://luma.com/second']);
  fetch.mock.mockImplementation(async () => Response.redirect('https://example.com/event'));
  await assert.rejects(loadLumaEvent('https://luma.com/first'));
  assert.equal(fetch.mock.callCount(), 3);
});
