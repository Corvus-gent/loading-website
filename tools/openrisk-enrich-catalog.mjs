import {rename,writeFile} from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';
import {directoryDetail} from '../api/_openrisk/engine/directories.js';
import discovered from '../api/_openrisk/engine/discovered.js';
import previous from '../api/_openrisk/engine/directory-enrichment.js';

const out={...previous};
const targets=discovered.filter(row=>!out[row.source]);
const unique=[...new Map(targets.map(row=>[row.source,row])).values()];
let cursor=0,completed=0;
const file=new URL('../api/_openrisk/engine/directory-enrichment.js',import.meta.url);
const pending=new URL(file.href+'.tmp');
let writing=Promise.resolve();
function save(){
  writing=writing.then(async()=>{
    await writeFile(pending,'export default '+JSON.stringify(out,null,2)+';\n');
    await rename(pending,file);
  });
  return writing;
}
await Promise.all(Array.from({length:3},async()=>{
  while(cursor<unique.length){
    const row=unique[cursor++];
    try {
      const detail=await directoryDetail(row);
      if (detail===row) continue;
      const {domain,logoUrl,sector,signals,asOf}=detail;
      out[row.source]={domain,logoUrl,sector,signals,asOf};
      if (++completed%50===0) {
        console.log(completed+' profiles enriched');
        await save();
      }
    } catch(error) {
      if (completed===0) console.warn(error.message);
    } finally { await delay(1000); }
  }
}));
await save();
console.log(completed+' profiles enriched; '+Object.keys(out).length+' available.');
