import { writeFile } from 'node:fs/promises';
import { curated, cities } from '../api/_openrisk/engine/catalog.js';
import { hiring, engineering, coverageNews } from '../api/_openrisk/engine/enrich.js';
import previous from '../api/_openrisk/engine/snapshot.js';

const selected = process.argv.slice(2);
const snapshot = { ...previous };
let live = 0;
for (const city of [...cities.map(city => city.name), 'Paris']) {
  if (selected.length && !selected.includes(city)) continue;
  const entries = curated.filter(company => company.city === city);
  for (const item of entries) {
    const sources = [['jobs', () => hiring(item.board)], ['github', () => engineering(item.github)], ['news', () => coverageNews(item.name)]];
    const results = await Promise.allSettled(sources.map(([, run]) => run()));
    const observed = {};
    for (const [i, result] of results.entries()) {
      if (result.status === 'fulfilled' && result.value) {
        observed[sources[i][0]] = result.value;
        live++;
      }
    }
    snapshot[item.id] = { ...snapshot[item.id], ...observed };
  }
  console.log(city + ': ' + entries.length + ' catalog profiles checked');
  await writeFile(new URL('../api/_openrisk/engine/snapshot.js', import.meta.url),
    'export default ' + JSON.stringify(snapshot, null, 2) + ';\n');
}
console.log(live + ' signals captured');
