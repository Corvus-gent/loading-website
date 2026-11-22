import assert from 'node:assert/strict';
import {createHash,createHmac} from 'node:crypto';
export async function impactHttpContracts({urls,client,secret}){
 const {ikey,report}=await import('../../api/_compound-v2/impact/store.js');
 const request=async(engine,{query={},body,method,headers={},cookie='',raw}={})=>{const u=new URL(urls[engine]);u.searchParams.set('module','compound-v2');u.searchParams.set('impact','1');for(const[k,v]of Object.entries(query))u.searchParams.set(k,v);const response=await fetch(u,{method:method||(body||raw?'POST':'GET'),redirect:'manual',headers:{origin:'https://corvus.gent','content-type':'application/json','user-agent':'Mozilla/5.0','x-forwarded-for':'192.0.2.179',cookie,...headers},...((body||raw)?{body:raw||JSON.stringify(body)}:{})});const text=await response.text();let data;try{data=JSON.parse(text);}catch{data=text;}return{status:response.status,body:data,location:response.headers.get('location'),cache:response.headers.get('cache-control')};};
 const parity=async(options)=>{const old=await request('legacy',options),rust=await request('rust',options);if(old.body&&typeof old.body==='object'){delete old.body.updated_at;delete rust.body.updated_at;}assert.deepEqual(rust,old);return rust;};
 await parity();await parity({query:{private:'1'}});await parity({body:{action:'save',post:{}}});await parity({method:'DELETE'});await parity({query:{job:'1'}});await parity({query:{go:'bad/path'}});await parity({query:{go:'valid',to:'https://evil.test'}});await parity({query:{go:'valid'},method:'POST'});
 const auth={authorization:'Bearer '+secret};await parity({query:{private:'1'},headers:auth});await parity({body:{action:'settings',include_twitch_archives:'false'},headers:auth});await parity({body:{action:'not-real'},headers:auth});
 // The global /admin session is independent of Compound's password cookie and is revocable.
 const ownerToken='a'.repeat(43),ownerKey='legion:preview:v2:admin:'+createHash('sha256').update(ownerToken).digest('hex');const stamp=createHmac('sha256',secret).update('admin:'+secret).digest('hex');await client.set(ownerKey,stamp,{EX:28800});const ownerCookie='corvus_admin='+ownerToken;
 assert.equal((await parity({query:{private:'1'},cookie:ownerCookie})).status,200);
 await parity({body:{action:'settings',include_twitch_archives:false},cookie:ownerCookie,headers:{origin:'https://evil.test'}});
 assert.equal((await request('rust',{body:{action:'settings',include_twitch_archives:false},cookie:ownerCookie,headers:{origin:''}})).status,403);
 await client.del(ownerKey);assert.equal((await parity({query:{private:'1'},cookie:ownerCookie})).status,401);
 for(const engine of ['legacy','rust']){
  const id=engine==='rust'?'777001':'777002';const post={post_url:'https://x.com/gabe_maxxing/status/'+id,post_type:'original',media_type:'video',original_by_gabe:true,account:'gabe_maxxing',views:0,likes:9,comments:1,shares:0,saves:null};const saved=await request(engine,{body:{action:'save',post},headers:auth});assert.equal(saved.status,200,JSON.stringify(saved.body));assert.equal(saved.body.post.views,0);assert.equal(saved.body.post.made_with_compound,true);
  const match=(await parity()).body.posts.find(p=>p.id===saved.body.post.id);assert.equal(match.score,35);assert.equal(match.coverage.partial,true);
  const rejected=await request(engine,{body:{action:'save',post:{...post,post_type:'quote'}},headers:auth});assert.equal(rejected.status,200);assert.equal(rejected.body.post.made_with_compound,false);assert.equal((await parity()).body.posts.some(p=>p.id===saved.body.post.id),false);
  const linkedin=await request(engine,{body:{action:'linkedin-save',post:{post_url:'https://linkedin.com/posts/francisco-gabriel-van-langenhove_fixture-'+id,has_video:true,original:true,account:'gl',views:'22',likes:1,comments:0,shares:0}},headers:auth});assert.equal(linkedin.status,200,JSON.stringify(linkedin.body));assert.equal(linkedin.body.post.account,'francisco-gabriel-van-langenhove');assert.equal(linkedin.body.post.views,22);
  const bulk=await request(engine,{body:{action:'linkedin-bulk',text:'https://linkedin.com/posts/francisco-gabriel-van-langenhove_bulk-'+id+' — 100 impressions, 9 reactions, 1 repost',has_video:true,original:true},headers:auth});assert.equal(bulk.status,200,JSON.stringify(bulk.body));assert.equal(bulk.body.saved.length,1);
  const denied=await request(engine,{body:{action:'linkedin-save',post:{post_url:post.post_url,has_video:false,original:true}},headers:auth});assert.equal(denied.status,400);assert.match(denied.body.error,/native uploaded video/);
  const bulkUnknown=await request(engine,{body:{action:'bulk',text:post.post_url+' — 123 views'},headers:auth});assert.equal(bulkUnknown.status,200);assert.equal(bulkUnknown.body.saved.length,1);
  await parity({query:{private:'1'},headers:auth});assert.equal((await request(engine,{body:{action:'seed'},headers:auth})).status,200);
 }
 // Shared referral destination, dedupe and raw counts; HEAD never mutates.
 const before=Number(await client.hGet(ikey('raw-clicks'),'compound-http')||0);const head=await parity({query:{go:'http',to:'https://compound.mov/v/demo?source=site#clip'},method:'HEAD'});assert.equal(head.location,'https://compound.mov/v/demo?source=site#clip');assert.equal(head.status,302);assert.equal(Number(await client.hGet(ikey('raw-clicks'),'compound-http')||0),before);
 const go=await parity({query:{go:'http'}});assert.equal(go.status,302);assert.equal(go.location,'https://compound.mov/');assert.equal(Number(await client.hGet(ikey('raw-clicks'),'compound-http')),before+2);assert.equal(Number(await client.hGet(ikey('clicks'),'compound-http')),1);
 // Native parsing boundaries and shared owner rate limit.
 assert.equal((await request('rust',{headers:auth,raw:'{invalid'})).status,400);assert.equal((await request('rust',{headers:auth,raw:'{"padding":"'+'x'.repeat(22001)+'"}'})).status,413);
 const rate=(await client.keys(ikey('').replace(':impact:',':rate:impact-admin:')+'*'));assert.ok(rate.length>0);await client.set(rate[0],'30',{EX:60});assert.equal((await parity({body:{action:'seed'},headers:auth})).status,429);await client.del(rate[0]);
 const snapshot=await report();assert.equal(snapshot.posts.every(p=>p.made_with_compound&&p.original_by_gabe&&p.media_type==='video'&&p.post_type==='original'),true);
 console.log('PASS: Impact HTTP public/private report parity, Compound bearer + global owner session/revocation, CSRF, manual and LinkedIn bulk forms, original-video eligibility, positive zero/partial totals, redirect/HEAD dedupe, body bounds and shared admin rate limits.');
}
