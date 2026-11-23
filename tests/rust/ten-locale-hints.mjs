import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {localeHintSource} from '../../tools/rust/ten-experiments/locale-hints.mjs';

const source = (await localeHintSource(process.cwd()))
  .replace(/import[^;]+;/, '')
  .replaceAll('export ', '');
const storage = (await readFile('js/storage.js', 'utf8')).replaceAll('export ', '');
const cases = [
  {name:'English needs nothing', expected:[]},
  {name:'browser Dutch', browser:'nl-BE', expected:['nl','nl']},
  {name:'cookie beats browser', cookie:'corvus_lang=fr', browser:'nl-BE', expected:['fr','fr']},
  {name:'query beats cookie', search:'?lang=pt', cookie:'corvus_lang=fr', expected:['pt','pt']},
  {name:'saved choice', saved:JSON.stringify({value:'de',expires:Date.now()+60000}), expected:['de','de']},
  {name:'expired choice', saved:JSON.stringify({value:'de',expires:1}), browser:'fr-FR', expected:['fr','fr']},
  {name:'invalid input', search:'?lang=../../admin', browser:'unknown', expected:[]},
  {name:'route locale wins', pathname:'/cv/nl/', routes:{nl:'/cv/nl'}, search:'?lang=fr', expected:['nl','nl']},
  {name:'unsupported homepage Hindi', browser:'hi-IN', expected:[]},
  {name:'curiosity Hindi uses English UI', pathname:'/quests/', browser:'hi-IN', expected:['en','hi']},
];
for (const test of cases) {
  const links = [], saved = new Map(test.saved ? [['lang',test.saved]] : []);
  const context = vm.createContext({
    URLSearchParams, location:{pathname:test.pathname||'/',search:test.search||''},
    navigator:{language:test.browser||'en-GB'},
    localStorage:{getItem:k=>saved.get(k)??null,setItem:(k,v)=>saved.set(k,v),removeItem:k=>saved.delete(k)},
    document:{cookie:test.cookie||'',documentElement:{dataset:{languageRoutes:JSON.stringify(test.routes||null)}},
      createElement:()=>({}),head:{append:el=>links.push(el)}},
  });
  vm.runInContext(storage+'\n'+source,context);
  assert.deepEqual(links.map(link=>link.href.match(/(?:locales\/|site\.)([a-z]{2})/)[1]),test.expected,test.name);
  if (links.length) {
    assert.equal(links[0].rel,'modulepreload');
    assert.equal(links[1].as,'fetch');
    assert.equal(links[1].crossOrigin,'anonymous');
    assert.match(links[1].href,/\?v=20261120statslocale$/);
  }
}
console.log('Early locale hints: ten preference, expiry, route and unsafe-input cases pass.');
