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

const {BRIEF_COPY, INSPIRATIONS, STORIES, dailyBrief} = await import('../js/inspiration-data.js');
const tattooCopy = [
 ...Object.values(BRIEF_COPY).flat(),
 ...[...INSPIRATIONS, ...STORIES].flatMap(reference =>
  ['name', 'tag', 'alt', 'line', 'lore', 'detail', 'credit']
   .map(field => reference[field]).filter(Boolean)
 ),
 'Fall down, get back up.'
];
for (const lang of [...langs.slice(1), 'hi', 'ta']) {
 const file = `public/i18n/site.${lang}.json`;
 const copy = JSON.parse(await fs.readFile(file, 'utf8'));
 for (const [source, value] of Object.entries(copy)) {
  assert.equal(typeof value, 'string', file + ': flat string values required');
  assert.deepEqual(tokens(value), tokens(source), file + ': placeholders differ at ' + source);
 }
 for (const text of tattooCopy) {
  assert(copy[text]?.trim(), file + ': missing tattoo copy for ' + text);
 }
 const brief = dailyBrief({
  ids: ['monferno', 'anakin-story', 'phoenix', 'creation'],
  translate: text => copy[text] ?? text
 }).text;
 assert.match(brief, /Les extrêmes se touchent/);
 assert.deepEqual(tokens(brief), [], file + ': unresolved brief placeholders');
}
console.log('8 public page catalogs: valid strings and complete tattoo brief copy.');

const worldcraftSource = JSON.parse(await fs.readFile('public/worldcraft/locales/en.json', 'utf8'));
const worldcraftGerman = JSON.parse(await fs.readFile('public/worldcraft/locales/de.json', 'utf8'));
assert.deepEqual(Object.keys(worldcraftGerman).sort(), Object.keys(worldcraftSource).sort(), 'Worldcraft German keys differ');
for (const [key, value] of Object.entries(worldcraftGerman)) {
 assert.equal(typeof value, 'string', 'Worldcraft German copy: ' + key);
 assert.deepEqual(tokens(value), tokens(worldcraftSource[key]), 'Worldcraft German placeholders: ' + key);
}
console.log('Worldcraft German locale: stable keys and matching placeholders.');
