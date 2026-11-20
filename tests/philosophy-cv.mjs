import assert from 'node:assert/strict';import fs from 'node:fs/promises';import vm from 'node:vm';
import {PHILOSOPHY_ROUTES,renderPhilosophyPage} from '../lib/philosophy/page.mjs';
const copy=JSON.parse(await fs.readFile('cv/filosofie/content.json','utf8'));
for(const [lang,path]of Object.entries(PHILOSOPHY_ROUTES)){
 const html=renderPhilosophyPage(lang,copy);assert.equal(await fs.readFile(path.slice(1)+'/index.html','utf8'),html);assert(html.includes(`<html lang="${lang}"`));assert(html.includes(`rel="canonical" href="https://corvus.gent${path}"`));for(const [other,route]of Object.entries(PHILOSOPHY_ROUTES))assert(html.includes(`hreflang="${other}" href="https://corvus.gent${route}"`));assert(html.includes('src="/js/philosophy-page.js"'));assert.equal((html.match(/<main>/g)||[]).length,1);
}
const config=JSON.parse(await fs.readFile('vercel.json','utf8'));for(const route of Object.values(PHILOSOPHY_ROUTES))assert(config.rewrites.some(r=>r.source===route&&r.destination===route+'/index.html'));assert(config.redirects.some(r=>r.source==='/filosofie'&&r.destination===PHILOSOPHY_ROUTES.nl));assert(config.redirects.some(r=>r.source==='/cv/filosofie/en'&&r.destination===PHILOSOPHY_ROUTES.en));
assert((await fs.readFile('js/philosophy-page.js','utf8')).includes("import './i18n/bar.js'"));assert((await fs.readFile('js/site/shell.js','utf8')).includes("import '../i18n/bar.js'"));for(const css of ['css/site/shell.css','cv/filosofie/reading.css'])assert((await fs.readFile(css,'utf8')).includes("@import url('/css/site/languages.css')"));
const source=await fs.readFile('js/i18n/language.js','utf8');
// The browser import loader is covered through an explicit VM dynamic-import hook.
for(const [lang,path]of Object.entries(PHILOSOPHY_ROUTES)){
 const context=vm.createContext({URL,URLSearchParams,location:{pathname:path,search:''},navigator:{language:'en-US'},document:{documentElement:{dataset:{languageRoutes:JSON.stringify(PHILOSOPHY_ROUTES)}}}});
 const locale=new vm.SyntheticModule(['default'],function(){this.setExport('default',{});},{context});await locale.link(()=>{});await locale.evaluate();
 const module=new vm.SourceTextModule(source,{context,importModuleDynamically:async()=>locale});await module.link(()=>new vm.SyntheticModule(['readLanguagePreference','saveLanguagePreference'],function(){this.setExport('readLanguagePreference',()=>lang==='nl'?'en':'nl');this.setExport('saveLanguagePreference',()=>{});},{context}));await module.evaluate();assert.equal(module.namespace.getLang(),lang,'route beats stale preference');assert.equal(module.namespace.LANGS.length,7);
}
console.log('PASS: shared NL/EN rendering, route language precedence, canonicals, hreflang, redirects, shared seven-language header and shared styles.');
