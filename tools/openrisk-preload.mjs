import { writeFile } from 'node:fs/promises';
import { curated, cities } from '../api/_openrisk/engine/catalog.js';
import { hiring, engineering, coverageNews } from '../api/_openrisk/engine/enrich.js';
import previous from '../api/_openrisk/engine/snapshot.js';
import health from '../api/_openrisk/engine/preload-report.js';

const requested = process.argv.slice(2);
const snapshot = { ...previous };
const report = structuredClone(health);
let captured = 0;

async function persist(name, data) {
  const file = new URL('../api/_openrisk/engine/'+name+'.js', import.meta.url);
  await writeFile(file,'export default '+JSON.stringify(data,null,2)+';\n');
}

for (const city of [...cities.map(city => city.name), 'Paris']) {
  if (requested.length && !requested.includes(city)) continue;
  const entries = curated.filter(company => company.city === city);
  const startedAt = new Date().toISOString();
  let count=0, failures=0;
  for (const item of entries) {
    const sources = [
      ...(item.board ? [['Hiring boards', 'jobs', () => hiring(item.board)]] : []),
      ...(item.github ? [['GitHub','github', () => engineering(item.github)]] : []),
      ['Hacker News','news', () => coverageNews(item.name)],
    ];
    const results = await Promise.allSettled(sources.map(([, , run]) => run()));
    const observed = {};
    for (const [i, result] of results.entries()) {
      const [label,key] = sources[i];
      const status = report.sources[label] ??= {};
      if (result.status === 'fulfilled' && result.value) {
        observed[key] = result.value;
        status.lastSuccess = result.value.fetchedAt;
        captured++;
        count++;
      } else if (result.status==='rejected') {
        status.lastFailure = new Date().toISOString();
        failures++;
      }
    }
    snapshot[item.id] = { ...snapshot[item.id], ...observed };
  }
  report.cities[city] = { startedAt,completedAt:new Date().toISOString(),profiles:entries.length,count,failures };
  console.log(city + ': ' + entries.length + ' curated profiles checked, ' + count + ' signals captured.');
  await persist('snapshot',snapshot);
  await persist('preload-report',report);
}
console.log(captured + ' signals captured');
