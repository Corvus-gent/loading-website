import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {brotliCompressSync,constants} from 'node:zlib';
import {browserProfile,browserProfileHtml,WASM_MODULE} from '../../tools/rust/browser-profiles.mjs';

for(const route of ['/','/index.html','/map/','/map/index.html','/cv/tech','/cv/philosophy/fr/','/realm/','/privacy','/languages'])assert.equal(browserProfile(route),'core',route);
for(const route of ['/admin','/compound','/compound/v2/stats','/legion/edit/private-token','/army','/hack/play','/hackersbay','/unknown','/%61dmin','/cv/%2F../admin'])assert.equal(browserProfile(route),'full',route);
const source='<html><head><meta charset="utf-8"><script type="module" src="/js/site/shell.js"></script></head><body>Unchanged content</body></html>';
const html=browserProfileHtml(source,'/map/');
assert.equal(html.replace(/<script type="importmap"[^>]*>.*?<\/script>/,''),source,'only module resolution changes; all markup stays intact');
assert(html.indexOf('type="importmap"')<html.indexOf('type="module"'),'mapping precedes module fetches');
assert.deepEqual(JSON.parse(html.match(/data-corvus-wasm="core">(.*?)<\/script>/)[1]),{imports:{[WASM_MODULE]:'/rust/browser/pkg/core/corvus_browser.js'}});
assert.equal(browserProfileHtml(source,'/admin'),source);
assert.throws(()=>browserProfileHtml(html,'/'),'existing import maps require explicit integration');
const raw=await readFile('rust/browser/pkg/core/corvus_browser_bg.wasm'),full=await readFile('rust/browser/pkg/corvus_browser_bg.wasm');
const exportsOf=bytes=>new Set(WebAssembly.Module.exports(new WebAssembly.Module(bytes)).map(x=>x.name));
const coreExports=exportsOf(raw),fullExports=exportsOf(full);
for(const name of ['start_site_shell','start_languages','start_consent','start_portal','start_cv','start_realm','army_submit'])assert(coreExports.has(name),name+' stays in the shared runtime');
for(const name of ['start_compound_admin','start_battle','start_army_wall','start_legion_admin','start_impact']){assert(fullExports.has(name),name+' remains available for feature pages');assert(!coreExports.has(name),name+' must not be downloaded by core pages');}
const compressed=bytes=>brotliCompressSync(bytes,{params:{[constants.BROTLI_PARAM_QUALITY]:4}}).length;
assert(compressed(raw)<compressed(full)*.75,'public shell must remove substantial feature payload; performance gate remains separate');
console.log('PASS one-module import-map selection, unchanged markup, private/unknown fallback, required shared exports and excluded feature UI', {core:compressed(raw),full:compressed(full)});
