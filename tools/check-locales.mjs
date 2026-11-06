import fs from 'node:fs/promises';import assert from 'node:assert/strict';
const langs=['en','nl','es','fr','pt','de','zh'];
const tokens=s=>[...new Set(s.match(/\{\w+\}/g)||[])].sort();
for(const feature of ['army','mail','wiki']){
 const english=JSON.parse(await fs.readFile(`js/i18n/${feature}.en.json`,'utf8'));
 for(const lang of langs){
  const file=`js/i18n/${feature}.${lang}.json`,strings=JSON.parse(await fs.readFile(file,'utf8'));
  assert.deepEqual(Object.keys(strings).sort(),Object.keys(english).sort(),file+': keys differ');
  for(const [key,value]of Object.entries(strings)){
   assert(typeof value==='string',file+': flat string values required');assert(!/<\/?[a-z][^>]*>/i.test(value),file+': HTML forbidden');
   assert.deepEqual(tokens(value),tokens(english[key]),file+': placeholders differ at '+key);
  }
 }
}
console.log('21 feature locales: flat JSON, stable keys, no HTML, matching placeholders.');
