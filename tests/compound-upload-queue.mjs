import assert from 'node:assert/strict';import {createClient} from 'redis';
Object.assign(process.env,{REDIS_URL:'redis://127.0.0.1:16380/3',SESSION_SECRET:'queue-test',COMPOUND_ADMIN_PASSWORD:'queue-password',COMPOUND_V2_PREFIX:'test:upload-queue:'+Date.now()});
const {importExport,markPosted,validateExport}=await import('../api/_compound-v2/uploads.js');const store=await import('../api/_compound-v2/store.js');const {uploadQueue}=await import('../compound/v2/upload-queue.js');const {parseCode,parseSlug}=await import('../compound/v2/config.js');const {default:handler}=await import('../api/_compound-v2/handler.js');
const db=createClient({url:process.env.REDIS_URL}).on('error',()=>{});await db.connect();
const now=Date.parse('2026-11-09T03:00:00Z'),fixture=(slug,order=0)=>({...parseSlug(slug),vote_code:parseCode(slug.split('-').slice(2).join('-')).code,caption:'Caption <script>never HTML</script>\nVote now.',share_url:'https://compound.mov/v/test',download_url:'https://assets.example.org/video.mp4?private=token',local_path:'/Users/private/export/'+slug+'.mp4',export_order:order,round:'R03'});
async function call(body,auth=false){const out={},res={setHeader(){},status(n){out.status=n;return this;},json(b){out.body=b;return out;},end(){return out;}};await handler({method:body?'POST':'GET',query:body?{}:{private:'1'},body,headers:{origin:'https://corvus.gent','content-type':'application/json','x-forwarded-for':'192.0.2.1',authorization:auth?'Bearer queue-password':''}},res);return out;}
try{
 for(const code of ['NL-MOM-1','nl-mom-1','nl-MoM1'])assert.equal(parseCode(code).code,'NL-MOM-1');assert.equal(parseCode('NL-MOM-0'),null);
 const rows=['tt-gm-en-b1','tt-gm-en-a1','tt-gm-fr-a1','tt-gm-nl-a1','x-gm-en-b1','x-gm-fr-a1','ig-gl-nl-a1','ig-gl-en-a1'].map(fixture);
 const yt={...fixture('yt-gm-nl-mom1'),round:'R05'};assert.equal(validateExport(yt).round,'R05');
 assert.equal(parseCode('en-live-1').code,'EN-LIVE-1');assert.equal(parseCode('es-e-1').code,'ES-E-1');
 await importExport(yt);const ytPosted=await markPosted(yt.slug,'https://www.youtube.com/shorts/testClip',new Date(now));assert.equal(ytPosted.status,'posted');
 await assert.rejects(markPosted(yt.slug,'https://youtube.com.evil.invalid/shorts/test'),/URL/);
 rows.forEach(validateExport);assert.throws(()=>validateExport({...rows[0],vote_code:'EN-B1'}));assert.throws(()=>validateExport({...rows[0],download_url:'javascript:alert(1)'}));
 for(const r of rows)await importExport(r);
 await store.vote('test-voter','x-gm-en-b1','up');await store.event('pageview','x-gm-en-b1');
 const first=await markPosted('x-gm-en-b1','https://x.com/gabe_maxxing/status/2119607937211781477',new Date(now));
 await importExport(rows[4]);const second=await markPosted(first.slug,first.post_url,new Date(now+10000));assert.equal(second.posted_at,first.posted_at);assert.equal(second.status,'posted');
 await markPosted('tt-gm-en-b1','https://www.tiktok.com/@test/video/123',new Date(now-10*60000));
 await store.save({...await store.get('x-gm-en-b1'),views:100},true);
 const before=await store.get('x-gm-en-b1');await importExport(rows[4]);assert.equal((await store.get(before.slug)).views,100);
 const priv=await store.report({privateData:true}),pub=await store.report(),v=priv.videos.find(v=>v.slug===first.slug);assert.equal(v.stats.up,1);assert.equal(v.site_visits,1);assert.equal(v.vote_code,'EN-B-1');assert.equal(v.local_path,rows[4].local_path);
 for(const secret of ['local_path','download_url','private=token','Caption','/Users/','export_order'])assert(!JSON.stringify(pub).includes(secret),secret);
 const queue=uploadQueue(priv.videos,now),tt=queue.find(g=>g.id==='tt-gm'),x=queue.find(g=>g.id==='x-gm');assert.equal(tt.items[0].lang,'fr');assert.equal(tt.items[1].lang,'en');assert.equal(tt.items[2].lang,'nl');assert.equal(Date.parse(tt.items[0].available_at),now+50*60000);assert.equal(Date.parse(tt.items[1].available_at)-Date.parse(tt.items[0].available_at),3600000);assert.equal(Date.parse(x.items[0].available_at),now+45*60000);assert(queue.find(g=>g.id==='ig-gl').items[0].available_at===new Date(now).toISOString());
 await assert.rejects(markPosted(first.slug,'https://instagram.com/p/abc'),/platform/);await assert.rejects(markPosted(first.slug,'https://x.com/a/status/99'),/another URL/);
 assert.equal((await call({action:'mark_posted',slug:first.slug,post_url:first.post_url})).status,401);assert.equal((await call({action:'mark_posted',slug:first.slug,post_url:first.post_url},true)).status,200);assert((await call(null,true)).body.upload_queue.length>0);
 const repeat=await Promise.all([markPosted('x-gm-fr-a1','https://x.com/gabe_maxxing/status/123',new Date(now)),importExport(rows[5])]);assert(repeat.length===2);assert.equal((await store.get('x-gm-fr-a1')).status,'posted');
 console.log('PASS: exact/legacy codes, export validation, idempotent import, posted status/metrics/votes retained, private asset isolation, language alternation, per-account 60/45-min cadence, authenticated mark-posted, concurrent import/post preservation.');
}catch(error){console.error(error);process.exitCode=1;}finally{const keys=await db.keys(process.env.COMPOUND_V2_PREFIX+':*');if(keys.length)await db.del(keys);await db.quit();process.exit(process.exitCode||0);}
