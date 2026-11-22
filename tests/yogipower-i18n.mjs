import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {createTranslator} from '../clients/yogipower/i18n.js';

const slots = value => [...value.matchAll(/\{(\d+)\}/g)].map(match=>match[1]).sort();
let keys;
for (const language of ['en','fr','es']) {
  const catalog = JSON.parse(await fs.readFile(new URL('../clients/yogipower/locales/'+language+'.json',import.meta.url)));
  const current = Object.keys(catalog).sort();
  assert(current.length > 1000, 'all public, customer and admin copy is included');
  if (keys) assert.deepEqual(current, keys, 'every language covers the same copy');
  keys = current;
  for (const [source,target] of Object.entries(catalog)) {
    assert.equal(typeof target,'string');
    assert(target.trim(),source+' cannot disappear');
    assert.deepEqual(slots(target),slots(source),source+' must preserve every interpolation');
  }
  const translate = createTranslator(catalog,language);
  assert.notEqual(translate('Voer de toegangscode in.'),'Voer de toegangscode in.');
  const place = translate('  4 vrij  ');
  assert.match(place,/^  4 .+  $/,'numeric counts and surrounding whitespace survive');
  assert.match(translate('Welkom terug, Philip'),/Philip/,'personal names survive template translation');
  assert.equal(translate('Lies Peeters'),'Lies Peeters');
  assert.equal(translate('yp-gate'),'yp-gate');
  assert.equal(translate('ORD-012345'),'ORD-012345');
  assert.equal(translate('Nieuwe Kassei 89/1, 1790 Affligem · 0473 91 02 93'),'Nieuwe Kassei 89/1, 1790 Affligem · 0473 91 02 93');
  assert.equal(translate('10 resterend, 2 geboekt ⇒ 8 vrij, 10 niet verbruikt').match(/\d+/g).join(','),'10,2,8,10');
  assert(translate('Voer de toegangscode in.\nOnjuiste code').includes('\n'),'message line breaks survive');
  assert(!translate('wo 25 november 2026').includes('wo '),'weekday is localized');
  assert.equal(translate('<img src=x onerror=alert(1)>'),'<img src=x onerror=alert(1)>','unknown user text is left intact');
}
assert.equal(createTranslator()('  Onbekende invoer  '),'  Onbekende invoer  ');
const reordered = createTranslator({'Nog {0} plaatsen voor {1}':'For {1}: {0} places left'});
assert.equal(reordered('Nog 12 plaatsen voor Philip'),'For Philip: 12 places left');
const combined = createTranslator({'Geldig {0}{1}':'Valid {0}{1}'},'en');
assert.equal(combined('Geldig zo 14 maart 2027'),'Valid Sun 14 March 2027','adjacent optional slots must not split a weekday');
const html = await fs.readFile(new URL('../clients/yogipower/index.html',import.meta.url),'utf8');
for (const [,source] of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) new vm.Script(source);
assert.equal((html.match(/id="yp-languages"/g)||[]).length,1);
assert.match(html,/data-language="nl"/); assert.match(html,/data-language="fr"/); assert.match(html,/data-language="en"/); assert.match(html,/data-language="es"/);
assert.match(html,/localStorage\.getItem\('yp-gate'\)/,'the existing code gate remains in place');
console.log('PASS: four-language UI, complete catalogs, interpolation, credit counts, identity, dates, line breaks and unchanged gate.');
