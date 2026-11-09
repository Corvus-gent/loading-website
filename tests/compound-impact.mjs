import assert from 'node:assert/strict';
process.env.REDIS_URL='redis://127.0.0.1:16380/10';process.env.COMPOUND_V2_PREFIX='test:impact:'+Date.now();process.env.COMPOUND_V2_ADMIN_PASSWORD='impact-owner-test';process.env.SESSION_SECRET='impact-test-only';
const {eligibility}=await import('../api/_compound-v2/impact/eligibility.js');const store=await import('../api/_compound-v2/impact/store.js');const {redis}=await import('../api/_redis.js');const {key}=await import('../api/_compound-v2/store.js');const {default:handler}=await import('../api/_compound-v2/impact/handler.js');
const good={original_by_gabe:true,native_video:true,media_type:'video',post_kind:'original',posted_at:'2026-11-09T00:00:00Z',registry_match:true};
const url='https://x.com/gabe_maxxing/status/2119723523795276255';
try{
 for(const [label,patch]of [['reply',{post_kind:'reply'}],['repost',{post_kind:'repost'}],['image',{media_type:'image'}],['GIF',{media_type:'gif'}],['carousel',{media_type:'carousel'}],['not native',{native_video:false}],['not Gabe',{original_by_gabe:false}],['before use',{posted_at:'2026-11-06'}],['unmatched',{registry_match:false}]])assert.equal(eligibility({...good,...patch}).eligible,false,label);
 assert.equal(eligibility(good).eligible,true);assert.equal(eligibility({...good,registry_match:false,manual_approved:true}).eligible,true);
 await store.seed();assert.equal((await store.report()).posts.length,0,'Invalid seeds cannot return');
 const row={slug:'x-gm-en-demo1',platform:'x',account:'gm',lang:'en',hook:'demo',n:1,post_url:url,compound_url:'https://compound.mov/v/test',views:100,likes:3,comments:2,shares:1,updated_at:new Date().toISOString(),private_note:'must stay private'};await redis(['HSET',key('videos'),row.slug,JSON.stringify(row)]);
 assert.equal((await store.report()).posts.length,0,'A slug alone is not proof of original native video');
 await assert.rejects(()=>store.save({post_url:url,made_with_compound:true}),/Confirm/);
 await store.save({post_url:url,...good,made_with_compound:true,views:300});let r=await store.report();assert.equal(r.posts.length,1);assert.equal(r.totals.views,300);assert.equal(r.posts[0].vote_code,'EN-DEMO-1');assert.ok(!JSON.stringify(r).includes('private_note'));assert.equal(JSON.parse(await redis(['HGET',key('videos'),row.slug])).private_note,'must stay private');
 await assert.rejects(()=>store.save({post_url:url,...good,post_kind:'reply',made_with_compound:true}),/Replies/);
 await store.save({post_url:url,...good,post_kind:'reply'},{source:'x-api'});assert.equal((await store.report()).posts.length,0,'API evidence excludes replies');assert.equal((await store.report({privateData:true})).posts.length,1);
 await store.save({post_url:url,...good,made_with_compound:true});await store.snapshot();assert.equal((await store.report()).history.at(-1).rule_version,2);
 await redis(['LPUSH',store.ikey('snapshots'),JSON.stringify({at:new Date().toISOString(),views:999999})]);assert.ok((await store.report()).history.every(r=>r.rule_version===2),'Unverified old graph totals excluded');
 await store.save({post_url:url,made_with_compound:false});assert.equal((await store.report()).totals.videos,0,'Explicit owner exclusion wins over slug');
 let status;await handler({query:{impact:'1'},method:'POST',headers:{},body:{action:'save'}},{setHeader(){},status(n){status=n;return this},json(){}});assert.equal(status,401);
 const {targetURL,countClick}=await import('../api/_compound-v2/impact/links.js');assert.throws(()=>targetURL('https://evil.example'));const click={method:'GET',headers:{'user-agent':'Mozilla/5.0','x-forwarded-for':'198.51.100.73'}};await countClick(click,'impact');await countClick(click,'impact');assert.equal((await store.clickReport()).total,1);
 console.log('PASS: required eligibility cases, legacy seed removal, registry/owner gates, provider rejection, public filtering, versioned snapshots, private field isolation, auth and click dedupe.');
}catch(e){console.error(e);process.exitCode=1;}finally{for(const k of await redis(['KEYS',process.env.COMPOUND_V2_PREFIX+':*']))await redis(['DEL',k]);process.exit(process.exitCode||0);}
