import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createCvDownloadHandler} from '../../api/_cv-download.js';
import {isolatedRuntime} from '../helpers/rust-runtime.mjs';
const pdf=await readFile('cv/gabe.pdf'),r=await isolatedRuntime('cv');
const url=r.url+'?module=cv',human={'user-agent':'Human browser'},day=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Brussels'}).format(new Date());
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function eventually(fn){for(let i=0;i<100;i++){if(await fn())return;await pause(50);}assert.fail('counter did not settle');}
try{
 for(const method of ['POST','PUT','DELETE','OPTIONS']){const result=await fetch(url,{method});assert.equal(result.status,405);assert.equal(result.headers.get('allow'),'GET, HEAD');}
 for(const download of [false,true])for(const method of ['GET','HEAD']){
  const query=download?{dl:'1'}:{},ref={headers:{},setHeader(k,v){this.headers[k.toLowerCase()]=v;},status(n){this.code=n;return this;},send(body){this.body=body;},end(){}};
  createCvDownloadHandler({readPdf:()=>pdf,count:()=>{},ready:()=>false})({method,query,headers:human},ref);
  const response=await fetch(url+(download?'&dl=1':''),{method,headers:human});assert.equal(response.status,ref.code);for(const[k,v]of Object.entries(ref.headers))assert.equal(response.headers.get(k),v,k);assert.deepEqual(Buffer.from(await response.arrayBuffer()),method==='GET'?pdf:Buffer.alloc(0));
 }
 await eventually(async()=>await r.client.get('cv:download')==='1'&&await r.client.get('cv:open')==='1');
 assert.equal(await r.client.get('cv:download:'+day),'1');
 for(const agent of ['LinkedInBot','curl/8','Mozilla preview'])assert.equal((await fetch(url,{headers:{'user-agent':agent}})).status,200);
 await pause(50);assert.equal(await r.client.get('cv:open'),'1');
 // Pause writes on this owned ephemeral database, never a developer/production instance.
 await r.client.sendCommand(['CLIENT','PAUSE','2000','WRITE']);const start=performance.now();const response=await fetch(url,{headers:human});assert.deepEqual(Buffer.from(await response.arrayBuffer()),pdf);assert(performance.now()-start<1200,'slow analytics must not hold PDF response');
 await eventually(async()=>await r.client.get('cv:open')==='2');
 await r.client.sendCommand(['CLIENT','PAUSE','1000','ALL']);const failedStart=performance.now();assert.equal((await fetch(url,{headers:human})).status,200);assert(performance.now()-failedStart<700,'unavailable analytics do not block PDF');
 await eventually(async()=>await r.client.get('cv:open')==='3');
 console.log('PASS native/legacy PDF bytes, headers, GET/HEAD/method/bot behavior, Brussels counters and nonblocking paused analytics');
}finally{await r.close();}
const readOnly=await isolatedRuntime('cv',{CORVUS_RUST_WRITES:'disabled'});
try{const response=await fetch(readOnly.url+'?module=cv&dl=1',{headers:human});assert.equal(response.status,200);assert.deepEqual(Buffer.from(await response.arrayBuffer()),pdf);await pause(50);assert.equal(await readOnly.client.dbSize(),0);console.log('PASS read-only PDF is available without any counter write');}finally{await readOnly.close();}
