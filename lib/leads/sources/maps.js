// Google Maps businesses WITHOUT a website (cold leads, lowest rank). Official Places API (New) Text Search,
// read-only. Needs GOOGLE_MAPS_API_KEY; skipped without it. Runs once a day (see tools/leads/refresh.mjs).
import { makeLead } from '../schema-stub.js';

export const CITIES = ['Ghent', 'Brussels', 'Antwerp', 'London'];
export const CATEGORIES = ['hair salon', 'barber', 'beauty salon', 'bakery', 'cafe', 'restaurant', 'plumber', 'electrician', 'physiotherapist', 'personal trainer', 'florist', 'car repair'];
const FIELDS = 'places.id,places.displayName,places.formattedAddress,places.websiteUri,places.internationalPhoneNumber,places.googleMapsUri,places.rating,places.userRatingCount,places.businessStatus,places.primaryTypeDisplayName';

export function placeToLead(p, city, now = Date.now()) {
  if (!p || p.websiteUri || p.businessStatus && p.businessStatus !== 'OPERATIONAL') return null;
  if ((p.userRatingCount || 0) < 10) return null; // real, active businesses only
  const name = p.displayName?.text || 'Local business';
  const kind = p.primaryTypeDisplayName?.text || 'business';
  const lead = makeLead({
    id: `maps:${p.id}`,
    source: 'maps',
    name,
    contact: p.internationalPhoneNumber || null,
    need: `${kind} in ${city} with no website (${p.userRatingCount} Google reviews, ${p.rating ?? '–'}★) — ${p.formattedAddress || city}`,
    urgency: 'low',
    next_action: p.internationalPhoneNumber ? 'WhatsApp / call with a mock-up offer' : 'Visit or find on Instagram',
    url: p.googleMapsUri || null,
    created_at: new Date(now).toISOString(),
    seen_at: new Date(now).toISOString(),
  });
  lead.signals = { reviews: p.userRatingCount, rating: p.rating ?? null, business_site: null, linkedin: null, red_flags: [], city };
  return lead;
}

export async function fetchMapsLeads({ cities = CITIES, categories = CATEGORIES, fetchImpl = fetch, now = Date.now(), log = console } = {}) {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) { log.warn('maps skipped: GOOGLE_MAPS_API_KEY not set'); return []; }
  const leads = [];
  for (const city of cities) for (const cat of categories) {
    try {
      const r = await fetchImpl('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': FIELDS },
        body: JSON.stringify({ textQuery: `${cat} in ${city}`, pageSize: 20 }),
        signal: AbortSignal.timeout(15000),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const places = (await r.json()).places || [];
      const kept = places.map(p => placeToLead(p, city, now)).filter(Boolean);
      log.log(`maps ${cat} in ${city}: ${places.length} places, ${kept.length} without a site`);
      leads.push(...kept);
    } catch (e) { log.warn(`maps ${cat} in ${city} skipped: ${e.message}`); }
  }
  return leads;
}
