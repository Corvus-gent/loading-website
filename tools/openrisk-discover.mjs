import { writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { directoryCity, directoryDetail } from '../api/_openrisk/engine/directories.js';
import { curated } from '../api/_openrisk/engine/catalog.js';
import previous from '../api/_openrisk/engine/discovered.js';

const cities = process.argv.length > 2 ? process.argv.slice(2) : ['Gent','Brussels','Antwerp','Leuven'];
const dataset = previous.filter(row=>!cities.includes(row.city));
const seen = new Set([...curated,...dataset].map(row=>row.id));
for (const city of cities) {
  try {
    const rows = await directoryCity(city,34);
    if (!rows.length) throw Error('No results');
    const matches = rows.filter(row=>!seen.has(row.id));
    console.log(city + ': ' + matches.length + ' directory candidates');
    for (const [i,company] of matches.entries()) {
      seen.add(company.id);
      let item = company;
      if (i<10) {
        await delay(1100);
        try { item = await directoryDetail(company); } catch {}
      }
      dataset.push(item);
    }
  } catch (error) {
    console.warn(city+': '+error.message);
    dataset.push(...previous.filter(row=>row.city===city));
  }
  await writeFile(new URL('../api/_openrisk/engine/discovered.js',import.meta.url),
    'export default '+JSON.stringify(dataset,null,2)+';\n');
}
