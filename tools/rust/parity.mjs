// Execute the existing JavaScript contract and Rust implementation on identical inputs.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import {PLETHORA_PLACEMENTS,canonicalPlacement,officialURL} from '../../js/plethora-config.js';
import {tierPath} from '../../js/site/page-tiers.js';
import {createHmac,createHash} from 'node:crypto';
import {coverage,engagements,firstDaySample} from '../../compound/impact/metrics.js';
import {eligibility,classification} from '../../api/_compound-v2/impact/eligibility.js';
import {parseSlug} from '../../compound/v2/config.js';
import {destination} from '../../api/_compound-v2/model.js';
import {resolveCode} from '../../api/_compound-v2/codes.js';
import {points,rank} from '../../js/army/domain.js';
import {memberTier,localDay} from '../../api/_legion/layers.js';
import {validate,validChallenge} from '../../api/_live-interviews.js';
import {hackLiveMode} from '../../hack/live-mode-config.js';
const fixtures=[];
const {validateRequest,configuration,shortDestination}=await import('../../api/_support.js');
const form={name:' Fixture ',contact:'fixture@example.test',pain:'Launch\nfeedback',times:'today after 3pm PT',tier:'quick',source:'linkedin'};
for(const body of [{},form,...['quick','coffee','meet','bogus','constructor'].flatMap(tier=>[false,true,'yes'].map(coffeePaid=>({...form,tier,coffeePaid}))),...['name','contact','pain','times'].flatMap(key=>[null,'', '  ', 'a'.repeat(601),'🥋'.repeat(41),'\uFEFFFixture\uFEFF','\u0085'].map(value=>({...form,[key]:value}))),...['x','linkedin','direct','evil'].map(source=>({...form,source}))]){
 let expected;try{expected={fields:validateRequest(body)};}catch(e){expected={error:e.message};}fixtures.push({operation:'support-form',body,expected});
}
{
 const keys=['BMC_URL','LINKEDIN_PROFILE_URL','X_USER_ID'],saved=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 for(const env of [{},{BMC_URL:'javascript:alert(1)',LINKEDIN_PROFILE_URL:'https://user:pass@example.test',X_USER_ID:'abc'},{BMC_URL:'https://example.test/coffee?utm_source=old&utm_source=again&keep=1',LINKEDIN_PROFILE_URL:'https://example.test/profile',X_USER_ID:'12345678'}]){
  for(const k of keys)delete process.env[k];Object.assign(process.env,env);
  for(const value of ['call-li','call-x','bmc-li','bmc-x','dinner-li','dinner-x','roll-li','roll-x','nope'])for(const query of [{},{utm_content:'valid_1',utm_term:'word',utm_id:'campaign'},{utm_content:'x&secret=bad',secret:'never-forwarded'}])fixtures.push({operation:'support-config',value,env,query,expected:{config:configuration(),url:shortDestination(value,query)}});
 }
 for(const k of keys){if(saved[k]===undefined)delete process.env[k];else process.env[k]=saved[k];}
}

for(const body of [null,[],{}, {name:'  Gabe\u0000',project:'robot\nname',handle:'@gabe'}, {name:'é'.repeat(80),project:'test',handle:'@x'}, {name:'🥋'.repeat(41),project:'test',handle:'@x'}, {name:'A',project:'B',handle:'C',website:'spam'}, {name:'A',project:'B',handle:'C',website:[]}, {name:'A',project:'B',handle:'C',website:false}]){
 let expected;try{expected={fields:validate(body)};}catch(e){expected={error:e.message};}fixtures.push({operation:'live-form',body,expected});
}
{
 const secret='public-fixture-only',at=1700000000000,nonce='0123456789abcdef01234567',base=at+'.'+nonce,token=base+'.'+createHmac('sha256',secret).update('live-interview:'+base).digest('hex');
 const saved=process.env.PRIVACY_SECRET;process.env.PRIVACY_SECRET=secret;
 for(const value of [token,token+'x','',token.replace(nonce,nonce.toUpperCase())])for(const age of [-1,0,2999,3000,1799999,1800000])fixtures.push({operation:'live-challenge',secret,value,now:at+age,expected:{valid:validChallenge(value,at+age)}});
 if(saved===undefined)delete process.env.PRIVACY_SECRET;else process.env.PRIVACY_SECRET=saved;
}
for(const mode of ['auto','on','off','ON','other'])for(const now of [1794243599999,1794243600000,1794243600001])fixtures.push({operation:'hack-mode',mode,now,expected:hackLiveMode(mode,now)});
for(const status of ['anonymous','member','approved','deleting'])for(const value of [0,1,29,30,100,300,700,1500,3000,'10',-5,null])for(const legion of [undefined,{rank:'senator'},{rank:'centurio'}]){const user={status,missionPoints:value,legion};fixtures.push({operation:'army',user,expected:{points:points(user),rank:rank(user),tier:memberTier(user)}});}
for(const value of ['Europe/Brussels','America/Los_Angeles','Asia/Hong_Kong','UTC','Pacific/Auckland','America/New_York'])for(const at of ['2026-11-01T09:01:59Z','2026-11-01T12:02:00Z','2026-03-29T02:01:59Z','2026-03-29T02:02:00Z','2026-11-20T04:01:59Z','2026-11-20T04:02:00Z']){const now=Date.parse(at);fixtures.push({operation:'day',value,now,expected:{day:localDay(now,value)}});}

for(const platform of ['tt','ig','x','li','yt','tw'])for(const views of [null,0,'000','99',' 42 ','1e3',-1,1.5,9007199254740992])for(const post_type of ['original','reply','repost','quote']){
 const post={platform,views,likes:99,comments:8,shares:null,saves:0,post_type,media_type:'video',original_by_gabe:true,posted_at:'2026-11-20T00:00:00.000Z',metrics_at:'2026-11-20T12:00:00.000Z'};
 fixtures.push({operation:'metrics',post,expected:{coverage:coverage(post),engagements:engagements(post),eligibility:eligibility(post),classification:classification(post),sample:firstDaySample(post)}});
}
for(const post of [{},{platform:'yt',views:0,likes:0,comments:0,shares:0},{platform:'x',views:1,post_kind:'self_thread',native_video:true},{views:10,posted_at:'2026-11-20T00:00:00Z',metrics_at:'2026-11-22T00:00:00Z'}])fixtures.push({operation:'metrics',post,expected:{coverage:coverage(post),engagements:engagements(post),eligibility:eligibility(post),classification:classification(post),sample:firstDaySample(post)}});
const slugs=['tt-gl-nl-mom1','ig-collab-nl-mom1','x-gm-en-b8','tt-bjj-pt-bjj2'];
for(const value of [...slugs,'li-gl-en-startup2','yt-gm-en-mom1','tw-gm-en-live3','xx-gm-en-a1','tt-gl-nl-mom0','tt-gl-nl-mom10000','tt-gl-en-unknown1'])for(const query of [{},{utm_source:'x'},{utm_SOURCE:'external'},{utm_campaign:'a b',utm_medium:'dm'},{c:'PT-BJJ-2'}])fixtures.push({operation:'slug',value,query,expected:{parsed:parseSlug(value),destination:destination(value,query)}});
for(const value of ['NL-MOM-1','nlmom1','NL-MOM1','pt-bjj-2','PTBJJ2','en-b8','en-b0',' EN-B-8 ','unknown','NL-MOM-9999','nl--mom1'])for(const query of [{},{utm_source:'x',utm_campaign:'kept'}])for(const source of ['url','typed'])fixtures.push({operation:'code',value,slugs,query,source,expected:resolveCode(value,slugs.map(parseSlug),query,source)});

for(const value of [...Object.keys(PLETHORA_PLACEMENTS),'bio',...Object.keys(PLETHORA_PLACEMENTS).map(x=>'plethora-'+x),'plethora-bio','nope','__proto__','home&x=1','HOME','../game','']) fixtures.push({operation:'plethora',value,expected:{canonical:canonicalPlacement(value),url:canonicalPlacement(value)?officialURL(value):null}});
for(const value of ['/','/wiki/corvus','/wiki/corvus/','/wiki/corvus/index.html','/wiki/%63orvus/INDEX/','//wiki//pidgy///','/wiki/corvus/namesakes','/legion/call-room','/legion/hacker-room','/wiki/%FF','/wiki/corvus%','/wiki/corvus+','/wiki/CORVUS']) fixtures.push({operation:'tier',value,expected:{path:tierPath(value)}});
for(const secret of ['fixture-only','sëcret-🔑'])for(const value of ['', 'session-id', 'corvus:rate-limit:2026-11-20:abuse','café']) fixtures.push({operation:'crypto',secret,value,expected:{sign:createHmac('sha256',secret).update(value).digest('base64url'),hash:createHash('sha256').update(value+secret).digest('hex')}});
const run=spawnSync('target/debug/corvus-contract',[],{input:fixtures.map(({expected,...x})=>JSON.stringify(x)).join('\n')+'\n',encoding:'utf8'});
assert.equal(run.status,0,run.stderr);
const results=run.stdout.trim().split('\n').map(JSON.parse);assert.equal(results.length,fixtures.length);
fixtures.forEach((f,i)=>assert.deepEqual(results[i],f.expected,`${f.operation} ${f.value}`));
writeFileSync('rust/fixtures/core-contracts.json','[\n'+fixtures.map(x=>JSON.stringify(x)).join(',\n')+'\n]\n');
console.log(`PASS: ${fixtures.length} legacy ↔ Rust contract fixtures (redirects, protected paths, cookie signatures, video codes, metric null/zero and eligibility).`);
