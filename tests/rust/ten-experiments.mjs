import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {directoryOverlay,MODES} from '../../tools/rust/ten-experiments/variants.mjs';

const source=await readFile('js/site/discovery.js','utf8');
assert.equal(new Set(MODES).size,12,'two controls plus ten treatments');
assert.throws(()=>directoryOverlay('changed source',{inline:true}));
assert.throws(()=>directoryOverlay('changed source',{parallel:true}));
const responses={
 '/api/legion?senate=1':{profiles:[{slug:'test-senator',name:'Test',title:'Senator',content:{headline:'Hello'}}]},
 '/api/compound-v2':{videos:[{slug:'x-gm-en-a1',platform:'x',account:'gm',lang:'en',hook:'a',n:1,vote_code:'EN-A-1'}]},
 '/api/army?view=legion':{members:[{username:'test-soldier'}]},
};
function isolated(text,{fetch,inline=null,full=false}={}){
 const document={querySelector:()=>full?{}:null,querySelectorAll:()=>[],getElementById:()=>inline===null?null:{textContent:inline}};
 // Keep the real exported functions and safety filter; skip DOM startup only in
 // this unit isolation. Browser parity checks exercise the complete script.
 text=text.slice(0,text.indexOf('function directory(')).replaceAll('export ','');
 const context=vm.createContext({fetch,document,location:{hostname:'localhost',href:'https://corvus.gent/'},URL,AbortSignal});
 return vm.runInContext(text+'\n({loadRoutes,freshPublicEntries});',context);
}
const routes=[{path:'/gabe',kind:'page'},{path:'/soldier/stale',kind:'soldier'}];
const originals=isolated(source,{fetch:async url=>({ok:true,json:async()=>responses[url]})});
const expected=await originals.freshPublicEntries(structuredClone(routes),true);
const requested=[],releases=[];
const concurrent=isolated(directoryOverlay(source,{parallel:true}),{fetch:url=>{requested.push(url);return new Promise(resolve=>releases.push(()=>resolve({ok:true,json:async()=>responses[url]})));}});
const pending=concurrent.freshPublicEntries(structuredClone(routes),true);
assert.equal(requested.length,3,'all independent requests start before any completes');
releases.reverse().forEach(release=>release());
assert.equal(JSON.stringify(await pending),JSON.stringify(expected),'same merge order/content despite out-of-order responses');
const failures=isolated(directoryOverlay(source,{parallel:true}),{fetch:async()=>{throw Error('offline');}});
assert.equal(JSON.stringify(await failures.freshPublicEntries(structuredClone(routes),true)),JSON.stringify(routes),'failed refresh retains known records');
let calls=0;const noRefresh=isolated(directoryOverlay(source,{parallel:true}),{fetch:async()=>{calls++;throw Error('unexpected');}});
assert.equal(JSON.stringify(await noRefresh.freshPublicEntries(structuredClone(routes))),JSON.stringify(routes));assert.equal(calls,0);
const inlineRoutes={routes:[{path:'/gabe',public:true},{path:'/admin',public:true},{path:'/legion/join/private-token',public:true},{path:'/private?key=secret',public:true},{path:'/hidden',public:false}]};
const inline=isolated(directoryOverlay(source,{inline:true}),{inline:JSON.stringify(inlineRoutes),fetch:async()=>{throw Error('Inline catalogue must not fetch');}});
assert.equal(JSON.stringify(await inline.loadRoutes()),JSON.stringify([{path:'/gabe',public:true}]));
const fallback=isolated(directoryOverlay(source,{inline:true}),{fetch:async()=>({ok:true,json:async()=>inlineRoutes})});
assert.equal(JSON.stringify(await fallback.loadRoutes()),JSON.stringify([{path:'/gabe',public:true}]));
console.log('Ten experiment overlays: independent variants, parallel ordering/failure, no extra requests, inline privacy filtering and network fallback passed.');
