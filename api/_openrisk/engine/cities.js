import places from './places.js';
import { cities } from './catalog.js';

const normal = text => text.normalize('NFKD').toLowerCase().replace(/[\u0300-\u036f]/g,'').replace(/[’']/g,'');
const index = new Map();
for (const [name,country,lat,lon] of places) {
  for (const key of [normal(name),normal(name+', '+country)]) {
    if (!index.has(key)) index.set(key,{name,country,lat,lon,source:'https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-populated-places/'});
  }
}

export function locate(input) {
  const key=normal(input.trim().replace(/,\s*/,', '));
  return cities.find(city=>normal(city.name)===key) || (key==='ghent' ? cities[0] : index.get(key)) || null;
}
