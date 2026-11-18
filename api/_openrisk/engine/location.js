import { locate } from './cities.js';

const cityLayers = new Set(['city','district','locality','county']);
const compact = value => value.toUpperCase().replace(/\s+/g,'');

export async function findOrigin(query, country) {
  const local = !country && locate(query);
  if (local) return { label:local.name+', '+local.country, lat:local.lat, lon:local.lon };

  const postal = /^(?:\d{4,5}(?:\s?[a-z]{2})?|[a-z]{1,2}\d[a-z\d]?\s?\d[a-z]{2})$/i.test(query);
  const preferred = country ? [country] : /^\d{4}$/.test(query) ? ['BE']
    : /^\d{5}$/.test(query) ? ['FR','DE'] : [];
  const results = await Promise.allSettled((preferred.length ? preferred : ['']).map(code=>lookup(query,postal,code)));
  const match = results.find(result=>result.status==='fulfilled' && result.value);
  if (match) return match.value;
  const failed = results.find(result=>result.status==='rejected');
  if (failed) throw failed.reason;
  return null;
}

async function lookup(query, postal, country) {
  const endpoint = new URL(postal ? '/structured' : '/api/', 'https://photon.komoot.io');
  endpoint.searchParams.set(postal ? 'postcode' : 'q',query);
  endpoint.searchParams.set('limit','8');
  if (country) endpoint.searchParams.set('countrycode',country);

  const response = await fetch(endpoint,{signal:AbortSignal.timeout(4000)});
  if (!response.ok) throw new Error('Location lookup failed');
  const payload = await response.json();
  for (const feature of payload.features ?? []) {
    const properties = feature.properties;
    const [lon,lat] = feature.geometry?.coordinates || [];
    if (!properties || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const match = postal
      ? [properties.postcode,properties.name].some(value=>value && compact(value)===compact(query))
      : cityLayers.has(properties.type);
    if (!match) continue;
    const parts = postal ? [query.toUpperCase(),properties.city,properties.country] : [properties.name,properties.country];
    return { label:parts.filter(Boolean).join(', '),lat,lon };
  }
  return null;
}
