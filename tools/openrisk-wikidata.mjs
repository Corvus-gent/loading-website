import { writeFile } from 'node:fs/promises';
import { wikidataCity } from '../api/_openrisk/engine/directories.js';
import { curated, cities } from '../api/_openrisk/engine/catalog.js';
import previous from '../api/_openrisk/engine/wikidata-snapshot.js';

const requested = process.argv.slice(2);
const selected = cities.map(city=>city.name).filter(name=>!requested.length || requested.includes(name));
const snapshot = previous.filter(row=>!selected.includes(row.city));
const identity = row => row.domain.replace(/^www\./i,'').toLowerCase();
const manual = new Set(curated.map(identity));

for (const city of selected) {
  try {
    const rows = (await wikidataCity(city)).filter(item=>!manual.has(identity(item)));
    if (!rows.length) throw Error('No matching entities');
    snapshot.push(...rows);
    console.log(city+': '+rows.length+' Wikidata matches');
  } catch (error) {
    snapshot.push(...previous.filter(row=>row.city===city));
    console.warn(city+': '+error.message);
  }
  await writeFile(new URL('../api/_openrisk/engine/wikidata-snapshot.js',import.meta.url),
    'export default '+JSON.stringify(snapshot,null,2)+';\n');
}
