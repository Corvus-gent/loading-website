import {writeFile} from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';
import {directoryCity} from '../api/_openrisk/engine/directories.js';
import {curated} from '../api/_openrisk/engine/catalog.js';
import previous from '../api/_openrisk/engine/discovered.js';
import wikidata from '../api/_openrisk/engine/wikidata-snapshot.js';

const selections = [
  [['London',65],['Cambridge',15],['Manchester',12],['Bristol',8]],
  [['Amsterdam',58],['Rotterdam',26],['Utrecht',6],['The Hague',5],['Eindhoven',5]],
  [['Berlin',35],['Munich',23],['Frankfurt',22],['Düsseldorf',5],['Hamburg',8],['Cologne',7]],
  [['Paris',65],['Lyon',12],['Toulouse',8],['Lille',6]],
];
const cityNames=new Set(selections.flatMap(group=>group.map(([name])=>name)));
const dataset=previous.filter(row=>!cityNames.has(row.city));
const reserved=[...curated,...wikidata];
const used=new Set([...reserved,...dataset].map(row=>row.id));
const cache=new Map(previous.map(row=>[row.source,row]));
for(const cities of selections){
  const bundles=[];
  for(const [city,quota] of cities){
    let entries=await directoryCity(city,100);
    if (!entries.length) entries=previous.filter(row=>row.city===city);
    console.log(city,entries.length);
    if (!entries.length) continue;
    const unique=[...new Map(entries.map(row=>[row.id,row])).values()];
    const reservedCount=reserved.filter(row=>row.city===city).length;
    bundles.push({entries:unique,quota:Math.max(0,quota-reservedCount)});
    await delay(450);
  }
  const cap=100-reserved.filter(row=>cities.some(([city])=>row.city===city)).length;
  let count=0;
  function add(entries,limit){
    let added=0;
    for(const row of entries){
      if(count>=cap||added>=limit) break;
      if(used.has(row.id)) continue;
      used.add(row.id);
      const saved=cache.get(row.source);
      dataset.push(saved ? {...row,...saved,city:row.city,directoryUrl:row.directoryUrl} : row);
      added++;count++;
    }
  }
  for(const bundle of bundles) add(bundle.entries,bundle.quota);
  for(const bundle of bundles) add(bundle.entries,cap);
  console.log('Selected',count+(100-cap));
}
await writeFile(new URL('../api/_openrisk/engine/discovered.js',import.meta.url),'export default '+JSON.stringify(dataset,null,2)+';\n');
