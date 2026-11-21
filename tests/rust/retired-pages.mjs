import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import middleware from '../../middleware.js';
import {CURATED_ROUTES} from '../../js/site/routes.js';
const old='/hack/the-feed',target='/hack/1/the-feed';
for(const host of ['corvus.gent','preview.example'])for(const suffix of ['','/','/index.html'])for(const method of ['GET','HEAD']){
 const url='https://'+host+old+suffix+'?utm_source=x&code=EN-A-1';
 const r=await middleware(new Request(url,{method,headers:{'user-agent':'Mozilla/5.0',cookie:'corvus_realm=1'}}));
 assert.equal(r.status,301);assert.equal(r.headers.get('location'),'https://'+host+target+'?utm_source=x&code=EN-A-1');
}
assert(!CURATED_ROUTES.some(r=>r.file==='hack/the-feed/index.html'),'the redundant page is not advertised as separate content');
await assert.rejects(readFile('hack/the-feed/index.html'),{code:'ENOENT'});
const retained=await readFile('hack/1/the-feed/index.html','utf8');
for(const id of ['data-hack-id="1"','id="hack-app"','id="feedback-open"','id="feedback-dialog"'])assert(retained.includes(id),'canonical page retains '+id);
console.log('PASS retired duplicate demo keeps 301 GET/HEAD aliases, query attribution and canonical feedback/player controls');
