import assert from 'node:assert/strict';
import {probe,regions} from '../tools/check-eu-region.mjs';
assert.deepEqual(regions('fra1::iad1-12345-random'),['fra1','iad1']);
assert.deepEqual(regions('fra1::fra1-12345-random'),['fra1','fra1']);
assert.deepEqual(regions('fra1::opaque'),['fra1']);
const original=globalThis.fetch;
try{
 for(const scenario of [
  {country:'BE',header:'fra1::fra1-12345',cache:'MISS',status:200,pass:true},
  {country:'BE',header:'fra1::iad1-12345',cache:'MISS',status:200,pass:false},
  {country:'BE',header:'fra1::fra1-12345',cache:'HIT',status:200,pass:false},
  {country:'BE',header:'fra1-12345',cache:'MISS',status:200,pass:false},
  {country:'US',header:'fra1::fra1-12345',cache:'MISS',status:200,pass:true},
  {country:null,header:'fra1::fra1-12345',cache:'MISS',status:302,pass:false},
 ]){
  globalThis.fetch=async(url,options)=>{
   assert.equal(options.redirect,'manual');assert.equal(options.headers?.Cookie,undefined);
   return new Response(JSON.stringify({countryCode:scenario.country}),{status:scenario.status,headers:{'x-vercel-id':scenario.header,'x-vercel-cache':scenario.cache}});
  };
  const report=await probe('https://corvus.gent',2);
  assert.equal(report.frankfurtVerified,scenario.pass);assert.equal(report.belgiumVerified,scenario.country==='BE');
  assert.equal(JSON.stringify(report).includes('12345'),false);
 }
 await assert.rejects(probe('https://secret:password@corvus.gent'),/public/);
 console.log('Region probe: execution vs ingress, cache/redirect rejection, country evidence and request-ID omission passed.');
}finally{globalThis.fetch=original;}
