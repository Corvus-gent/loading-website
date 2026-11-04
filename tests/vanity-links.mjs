import assert from 'node:assert/strict';
import fs from 'node:fs';
import middleware from '../middleware.js';
import {privacyEvent} from '../js/analytics-policy.js';
const aliases={
 '/enter':'/?utm_source=linkedin&utm_medium=company-page&utm_campaign=gabe-corvus-page&utm_content=button',
 '/the-crow':'/?utm_source=linkedin&utm_medium=company-page&utm_campaign=gabe-corvus-page&utm_content=website',
 '/revived':'/?utm_source=linkedin&utm_medium=company-post&utm_campaign=gabe-corvus-revival',
};
const search=JSON.parse(fs.readFileSync('search-index.json','utf8'));
for(const [slug,location]of Object.entries(aliases)){
 assert.equal(fs.existsSync('.'+slug),false,'slug clashes with a page');
 assert.ok(!search.some(entry=>new URL(entry.url,'https://corvus.gent').pathname.replace(/\/$/,'')===slug));
 for(const hostname of ['corvus.gent','www.corvus.gent','example.vercel.app'])for(const method of ['GET','HEAD'])for(const suffix of ['', '/','?utm_source=override']){
  const res=middleware(new Request(`https://${hostname}${slug}${suffix}`,{method,headers:{'user-agent':'curl/8.0'}}));
  assert.equal(res.status,307);assert.equal(res.headers.get('Location'),location);
 }
 const props=Object.fromEntries(new URLSearchParams(location.slice(2)));
 const captured=privacyEvent({event:'$pageview',properties:{$cookieless_mode:true,...props}});
 for(const [key,value]of Object.entries(props))assert.equal(captured.properties[key],value);
}
for(const route of ['/realm/','/games/','/music/','/call/']){
 const response=middleware(new Request('https://corvus.gent'+route,{headers:{'user-agent':'Mozilla/5.0'}}));assert.notEqual(response.status,307);
}
const unknown=privacyEvent({event:'$pageview',properties:{$cookieless_mode:true,utm_source:'linkedin',utm_campaign:'gabe-corvus-page',utm_content:'private@example.test'}});assert.equal(unknown.properties.utm_content,undefined);
console.log('Vanity links: exact 307/Location for GET/HEAD, slash/host variants, no URL override, no route/search clash, and safe attribution passed.');

// Exercise actual HTTP HEAD requests with curl against the real middleware.
const {createServer}=await import('node:http');
const {execFile}=await import('node:child_process');
const {promisify}=await import('node:util');
const exec=promisify(execFile);
const server=createServer((req,res)=>{
 const result=middleware(new Request(`http://${req.headers.host}${req.url}`,{method:req.method,headers:req.headers}));
 res.writeHead(result.status,Object.fromEntries(result.headers));res.end();
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const results=[];
try{
 for(const [slug,expected]of Object.entries(aliases))for(const suffix of ['', '/']){
  const {stdout}=await exec('curl',['-sI','--max-time','10',`http://127.0.0.1:${server.address().port}${slug}${suffix}`]);
  const status=Number(/^HTTP\/\S+ (\d+)/.exec(stdout)?.[1]);
  const location=/^location:\s*(.+)$/im.exec(stdout)?.[1].trim();
  assert.equal(status,307);assert.equal(location,expected);
  results.push({path:slug+suffix,status,location});console.log(`${slug+suffix}: ${status} ${location}`);
 }
 fs.writeFileSync('tests/results/vanity-redirects.json',JSON.stringify({environment:'local HTTP adapter running repository middleware; curl -sI; not a production measurement',results},null,2)+'\n');
}finally{await new Promise(resolve=>server.close(resolve));}
