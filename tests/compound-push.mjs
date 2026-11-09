import assert from 'node:assert/strict';import {createClient} from 'redis';
Object.assign(process.env,{REDIS_URL:'redis://127.0.0.1:16380/3',SESSION_SECRET:'push-local-test',COMPOUND_ADMIN_PASSWORD:'push-test-admin',COMPOUND_V2_PREFIX:'test:push:'+Date.now()});
const {default:handler}=await import('../api/_compound-v2/handler.js');const store=await import('../api/_compound-v2/store.js');const {postURL}=await import('../api/_compound-v2/push.js');const db=createClient({url:process.env.REDIS_URL}).on('error',()=>{});await db.connect();
async function call(body,query={},extra={}){const o={headers:{}};const res={setHeader(k,v){o.headers[k]=v;},status(n){o.status=n;return this;},json(v){o.body=v;return o;},end(){return o;}};await handler({method:body?'POST':'GET',query,body,headers:{origin:'https://corvus.gent','content-type':'application/json','user-agent':'Mozilla/5.0','x-forwarded-for':'192.0.2.19',...extra}},res);return o;}
try{
 assert.equal((await call(null,{push:'1'})).body.winner,null);
 for(const u of ['https://evil.example/x/status/123','https://x.com/gabe','http://x.com/gabe/status/123','https://secret:pass@x.com/gabe/status/123','javascript:alert(1)'])assert.equal(postURL(u),null);
 assert.equal(postURL('https://www.tiktok.com/@gabe/video/123').platform,'tt');assert.equal(postURL('https://www.instagram.com/reel/ABC_123/').platform,'ig');
 await store.save({slug:'x-gm-en-b1',post_url:'https://x.com/gabe_maxxing/status/2119607937211781477',views:1234});
 const auth={authorization:'Bearer '+process.env.COMPOUND_ADMIN_PASSWORD};
 assert.equal((await call({action:'set_winner',slug:'x-gm-en-b1'})).status,401);
 assert.equal((await call({action:'set_winner',slug:'tt-gm-en-a1'},{},auth)).status,400);
 assert.equal((await call({action:'set_winner',slug:'x-gm-en-b1'},{},auth)).status,200);
 const r=await call(null,{push:'1'});assert.equal(r.body.winner.views,1234);assert.equal(r.body.winner.platform,'x');assert.match(r.headers['Cache-Control'],/s-maxage=15/);assert(!r.headers['Set-Cookie']);assert(!JSON.stringify(r.body).includes('local_path'));
 const visitor='12345678-1234-1234-1234-123456789012';await call({action:'push_event',type:'watch',slug:'x-gm-en-b1',analytics:'session',visitor,attribution:{utm_source:'whatsapp',utm_content:'bad'}});
 const q=await db.lRange(store.key('events:'+new Date().toISOString().slice(0,10)),0,-1);assert.equal(q.length,1);assert.equal(JSON.parse(q[0]).utm_content,'push');
 await call({action:'push_event',type:'share',slug:'x-gm-en-b1',analytics:true,visitor},{},{'sec-gpc':'1'});assert.equal((await db.lRange(store.key('events:'+new Date().toISOString().slice(0,10)),0,-1)).length,1);assert.equal(await db.hGet(store.key('counts:x-gm-en-b1'),'push_share'),'1');
 assert.equal((await call({action:'push_event',type:'share',slug:'wrong'})).status,409);assert.equal((await call({action:'push_event',type:'arbitrary',slug:'x-gm-en-b1'})).status,400);
 const priv=await call(null,{private:'1'},auth);assert.equal(priv.body.push.winner.slug,'x-gm-en-b1');
 console.log('PASS: owner-only selection, safe real-post URLs, public field allowlist/cache, preserved metrics, push attribution and GPC aggregate-only handling.');
}catch(e){console.error(e);process.exitCode=1;}finally{const k=await db.keys(process.env.COMPOUND_V2_PREFIX+':*');if(k.length)await db.del(k);await db.quit();process.exit(process.exitCode||0);}
