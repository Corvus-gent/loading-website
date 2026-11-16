import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import {createHandler} from '../api/_cv-social.js';
const data=new Map(),scores=new Map();
const store=async c=>{const [op,...a]=c;if(op==='GET')return data.get(a[0])??null;if(op==='SET'){if(!a.includes('NX')||!data.has(a[0]))data.set(a[0],a[1]);return 'OK';}if(op==='MGET')return a.map(k=>data.get(k)??null);if(op==='ZREVRANGE')return [...scores].sort((a,b)=>b[1]-a[1]).slice(0,5).flatMap(([k,v])=>[k,String(v)]);if(op==='EVAL'){const keys=c.slice(3,7),[action,host]=c.slice(7);if(data.has(keys[0]))return 0;data.set(keys[0],1);const key=action==='visit'?keys[1]:keys[3];data.set(key,Number(data.get(key)||0)+1);if(action==='click')scores.set(host,(scores.get(host)||0)+1);return 1;}throw Error(op);};
const handler=createHandler({store,ready:()=>true,historyReady:()=>true,query:async()=>[[7]],prefix:'isolated-test',now:()=>Date.parse('2026-11-16T17:00:00Z')});
async function call(body,method='POST'){const res={setHeader(){},status(n){this.code=n;return this;},json(v){this.body=v;return this;}};await handler({method,headers:{origin:'https://corvus.gent'},body},res);return res;}
const visit={action:'visit',id:'visit-test-00000001'};assert.equal((await call(visit)).body.visits,8);assert.equal((await call(visit)).body.visits,8);
assert.equal((await call(null,'GET')).body.top.length,0);
for(const [i,href]of ['https://www.instagram.com/a','https://www.instagram.com/b','https://www.instagram.com/c','https://github.com/a','https://corvus.gent/go/compound-impact'].entries())assert.equal((await call({action:'click',id:'click-test-0000000'+i,href})).code,200);
const result=(await call(null,'GET')).body;assert.equal(result.clicks,5);assert.deepEqual(result.top[0],{domain:'instagram.com',name:'Instagram',clicks:3});assert(result.top.some(r=>r.domain==='compound.mov'));
for(const href of ['mailto:a@b.com','tel:123','/cv/','https://corvus.gent/compound/impact/'])assert.equal((await call({action:'click',id:'excluded-0000000001',href})).code,400);
let listeners={},events=[];const elements=new Map();const element=()=>({textContent:'',replaceChildren(){},append(){}});const document={getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id);},createElement:element,addEventListener(type,fn){listeners[type]=fn;}};
vm.runInNewContext(fs.readFileSync('cv/social-media/stats.js','utf8'),{document,URL,location:{href:'https://corvus.gent/cv/social-media/'},crypto:{randomUUID:()=>String(events.length).padStart(20,'0')},fetch:async(url,opts)=>{events.push(JSON.parse(opts.body));return {ok:true,json:async()=>result};}});
function event(type,button,href,extra={}){listeners[type]({type,button,target:{closest:()=>({href})},preventDefault(){throw Error('navigation blocked');},...extra});}
event('click',0,'https://www.instagram.com/a');event('click',0,'https://www.instagram.com/b',{ctrlKey:true});event('click',0,'https://www.instagram.com/c',{metaKey:true});event('auxclick',1,'https://github.com/a');event('auxclick',2,'https://github.com/a');event('click',0,'mailto:a@b.com');event('click',0,'https://corvus.gent/cv/');event('click',0,'https://corvus.gent/go/compound-impact');
assert.equal(events.filter(e=>e.action==='visit').length,1);assert.equal(events.filter(e=>e.action==='click').length,5);
console.log('PASS: historical visits, idempotency, isolated ranking, Instagram grouping, /go destination, primary/Ctrl/Cmd/middle clicks, exclusions and immediate navigation');
