import assert from 'node:assert/strict';
import {createCvDownloadHandler} from '../api/_cv-download.js';
const pdf=Buffer.from('%PDF-1.4\nlocal-test');
function response(){return{headers:{},setHeader(k,v){this.headers[k]=v;},status(n){this.code=n;return this;},send(body){this.body=body;return this;},end(){this.ended=true;return this;}};}
let release,counted,jobs=[];
const handler=createCvDownloadHandler({readPdf:()=>pdf,count:commands=>{counted=commands;return new Promise(resolve=>release=resolve);},schedule:p=>jobs.push(p),now:()=>new Date('2026-11-20T23:30:00Z')});
const req={method:'GET',query:{dl:'1'},headers:{'user-agent':'Human browser'}};
const result=response();handler(req,result);
assert.equal(result.code,200);assert.equal(result.headers['Content-Length'],String(pdf.length));assert.equal(result.body,pdf,'PDF is sent without waiting for the unresolved analytics operation');
assert.equal(jobs.length,1);await Promise.resolve();assert.deepEqual(counted,[['INCR','cv:download'],['INCR','cv:download:2026-11-21']],'day uses Brussels timezone');release();await jobs[0];
for(const request of [{...req,method:'HEAD'},{...req,headers:{'user-agent':'LinkedInBot'}},{...req,headers:{'user-agent':'curl/8'}}]){jobs=[];const r=response();handler(request,r);assert.equal(r.code,200);assert.equal(jobs.length,0);if(request.method==='HEAD'){assert(r.ended);assert.equal(r.body,undefined);}}
let reads=0;const methods=createCvDownloadHandler({readPdf:()=>{reads++;return pdf;},count:()=>{},ready:()=>false});const rejected=response();methods({...req,method:'POST'},rejected);assert.equal(rejected.code,405);assert.equal(reads,0);assert.equal(rejected.headers.Allow,'GET, HEAD');
const disconnected=response();methods(req,disconnected);assert.equal(disconnected.body,pdf);
let rejectedWork;const down=createCvDownloadHandler({readPdf:()=>pdf,count:()=>{throw Error('private Redis detail');},schedule:p=>rejectedWork=p});const fail=response();down(req,fail);assert.equal(fail.code,200);await rejectedWork;assert.equal(fail.body,pdf);
const missing=createCvDownloadHandler({readPdf:()=>{throw Error('/private/path');},count:()=>{throw Error('must not count');}});const unavailable=response();missing(req,unavailable);assert.equal(unavailable.code,503);assert(!unavailable.body.includes('/private/path'));
console.log('PASS: immediate PDF despite slow/failed analytics, HEAD/bot exclusions, allowed methods, private errors and Brussels date counters.');
