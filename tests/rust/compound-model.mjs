import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHmac} from 'node:crypto';
import {summarize} from '../../api/_compound-v2/summary.js';
import {platformID} from '../../api/_compound-v2/sync.js';
import {buildReport} from '../../api/_compound-v2/reports.js';
import {validateExport} from '../../api/_compound-v2/uploads.js';
import {postURL} from '../../api/_compound-v2/push.js';
import {uploadQueue} from '../../compound/v2/upload-queue.js';
import {parseSlug,voteCode} from '../../compound/v2/config.js';
import {video,publicVideo,attribution} from '../../api/_compound-v2/model.js';
import {authorized,sameOrigin,analytics} from '../../api/_compound-v2/security.js';
const at='2026-11-20T00:00:00.000Z',fixtures=[];
const base={slug:'x-gm-en-b8',post_url:'https://x.com/gabe_maxxing/status/2119755391261376589',views:100,likes:2,comments:0,shares:0};
const bodies=[{},null,[],{slug:'nope'},base,{slug:'tt-gl-nl-mom1'},{slug:'tt-gl-nl-mom99'},{slug:'tt-gl-nl-mom99',is_example:true},...['views','likes','comments','shares'].flatMap(key=>[null,0,1,-1,1.5,1e12,1e12+1,true,false,'',' ', ' 99 ','1e3','0x10','0b11','0o10','Infinity','garbage',[],[1],['12'],[null],[true],{},[1,2]].map(value=>({...base,[key]:value}))),...['post_url','compound_url'].flatMap(key=>['','http://x.com/user/status/1','https://www.x.com/user/status/1#section','https://x.com.evil.test/a','https://evil.test','https://user:secret@x.com/a','https://compound.mov/v/abc?x=1#fragment','https://youtube.com/shorts/123','https://youtu.be/a','https://tiktok.com:444/@a/video/1',false,true,{},'a'.repeat(1501)].map(value=>({...base,[key]:value}))),...['pending','ready','posted','bad',null,{}].map(status=>({...base,status})),...['','2026-11-09','2026-11-09T17:00:00Z','2026-11-09T09:00:00-08:00','2026-11-09T17:00:00.123Z','2026-11-09T17:00:00','2026-11-09T17:00','Mon, 09 Nov 2026 17:00:00 GMT','not a date'].map(posted_at=>({...base,posted_at})),...[null,0,true,'',' note\n\u0000\u007f\uFEFF ', '🥋'.repeat(90),'🥋'.repeat(91)].map(hook_line=>({...base,hook_line})),{...base,vote_code:'en-b8'},{...base,vote_code:'EN-B-8'},{...base,is_example:true},{...base,post_url:''}];
for(const pending of [false,true])for(const body of bodies){
 let expected;try{const row=video(body,{allowPending:pending});row.updated_at=at;expected={video:row,public:publicVideo(row),attribution:attribution({})};}catch(e){expected={error:e.message};}
 fixtures.push({operation:'compound-model',body,pending,at,tags:{},expected});
}
for(const tags of [{utm_source:'x',utm_campaign:'good',referrer:'https://www.instagram.com/private?email=hidden'}, {source:'x',medium:'dm',campaign:'campaign',content:'slug',referrer:'t.co'}, {utm_source:'a b',source:'valid',referrer:'https://private.test/path?secret'}, {referrer:'javascript:alert(1)'},{utm_source:null,source:'fallback',referrer:''},null]){
 const row=video(base);row.updated_at=at;fixtures.push({operation:'compound-model',body:base,at,tags,expected:{video:row,public:publicVideo(row),attribution:attribution(tags)}});
}
const asset={...parseSlug('tt-gl-nl-mom2'),vote_code:'NL-MOM-2',share_url:'https://compound.mov/v/fixture',download_url:'https://cdn.example.test/file.mp4?token=fixture',local_path:'/fixture/tt-gl-nl-mom2.mp4',caption:'Link in de comments 👇',export_order:2,round:'R05'};
for(const body of [asset,{},...[null,'bad','https://user:pass@cdn.test/a','http://cdn.test/a','https://cdn.test/a'].map(download_url=>({...asset,download_url})),...['local.mp4','/fixture/file.png','/fixture/é-video.MP4'].map(local_path=>({...asset,local_path})),...[-1,0,1.5,'2',null,9007199254740992].map(export_order=>({...asset,export_order})),...['R03','R04','R05','R06',''].map(round=>({...asset,round})),{...asset,platform:'li'},{...asset,vote_code:'NL-MOM2'},{...asset,caption:'\u0000bad'}])for(const value of ['https://x.com/gabe_maxxing/status/123?x=1#f','https://twitter.com/gabe/status/123','https://www.tiktok.com/@gabe/video/456','https://instagram.com/reel/Ab_c-9/','https://m.tiktok.com/@gabe/video/2','https://youtube.com/shorts/a','https://x.com/u/status/notid','javascript:alert(1)','https://x.com/u/status/1/photo/1']){
 let expected;try{expected={asset:validateExport(body),post:postURL(value)};}catch(e){expected={error:e.message};}fixtures.push({operation:'compound-export',body,value,expected});
}
let random=1234567;const pick=n=>{random=(Math.imul(random,1664525)+1013904223)>>>0;return random%n;};
for(let round=0;round<70;round++){
 const rows=[];for(let i=0;i<80;i++){const platform=['tt','ig','x','li','tw','yt'][pick(6)],account=['gl','gm','bjj','collab'][pick(4)],lang=['nl','en','fr','pt','es','de','it'][pick(7)],status=['ready','pending','posted'][pick(3)],slug=platform+'-'+account+'-'+lang+'-a'+(i+1);rows.push({...parseSlug(slug),status,export_order:pick(7),post_url:status==='posted'?'https://example.test/'+slug:'',posted_at:status==='posted'?new Date(Date.parse(at)-pick(3)*1800000).toISOString():null,is_example:pick(20)===0});}
 fixtures.push({operation:'compound-queue',videos:rows,now:Date.parse(at),expected:uploadQueue(rows,Date.parse(at))});
}
for(let round=0;round<70;round++){
 const now=Date.parse(at),videos=[];
 for(let i=0;i<(round?20:0);i++)videos.push({slug:'x-gm-en-b'+(i+1),post_url:pick(10)===0?'':'https://x.com/gabe/status/'+i,views:pick(70000),is_example:pick(10)===0,variant:['base','goofy','short','long','unknown'][pick(5)],updated_at:pick(7)===0?null:new Date(now-pick(6)*1800000).toISOString()});
 const sample={at:new Date(now-1800000).toISOString(),posts:videos.map(v=>({...v,views:pick(70000),updated_at:new Date(now-3600000).toISOString()}))};
 for(const samples of [[],[sample],[{...sample,at:new Date(now).toISOString()},sample]])fixtures.push({operation:'compound-report',videos,samples,now,expected:buildReport(videos,samples,new Date(now))});
}
for(const platform of ['tt','ig','x'])for(const post_url of ['https://tiktok.com/@gabe/video/123/','https://m.tiktok.com/@a/video/444','https://vm.tiktok.com/123','https://instagram.com/reel/Ab_c-9/','https://instagram.com/p/____________________/','https://instagram.com/tv/a2345','https://instagram.com/p/a','https://instagram.com/p/'+'a'.repeat(21),'https://x.com/gabe/status/1','not-a-url']){const body={platform,post_url};fixtures.push({operation:'compound-platform-id',body,expected:{id:platformID(body)}});}
for(const views of [0,1,100])for(const votes of [0,1,10]){
 const now=Date.parse(at),row={...parseSlug('x-gm-en-b1'),views,votes,is_example:false},report={videos:[row,{...parseSlug('tt-gl-nl-mom1'),views,votes:0,is_example:false},{...parseSlug('ig-gl-en-a1'),views:9999,votes:9999,is_example:true}],totals:{views:views*2,votes}};
 const events=[...[-1,0,999,1001,-86400000,-86400001].map(delta=>({type:'vote',slug:'x-gm-en-b1',choice:'up',at:new Date(now+delta).toISOString(),handle:'PRIVATE',text:'PRIVATE'})),{type:'feedback',slug:row.slug,choice:'down',at},{type:'vote',slug:'unknown',choice:'up',at},{type:'vote',slug:'tt-gl-nl-mom1',choice:'bad',at}];
 for(const list of [[],events,events.slice().reverse()])fixtures.push({operation:'compound-summary',report,events:list,now,expected:summarize(report,list,now)});
}
const keys=['SESSION_SECRET','COMPOUND_V2_ADMIN_PASSWORD','COMPOUND_ADMIN_PASSWORD','VERCEL_URL','VERCEL_BRANCH_URL','VERCEL_PROJECT_PRODUCTION_URL','NODE_ENV'];const saved=Object.fromEntries(keys.map(k=>[k,process.env[k]])),now=Date.now(),clock=Date.now;
try{Date.now=()=>now;for(const env of [{SESSION_SECRET:'fixture'},{SESSION_SECRET:'fixture',COMPOUND_ADMIN_PASSWORD:'old-password',VERCEL_URL:'preview.example',NODE_ENV:'production'},{SESSION_SECRET:'fixture',COMPOUND_ADMIN_PASSWORD:'old-password',COMPOUND_V2_ADMIN_PASSWORD:'new-password',VERCEL_BRANCH_URL:'branch.example',VERCEL_PROJECT_PRODUCTION_URL:'prod.example'}]){
 for(const k of keys)delete process.env[k];Object.assign(process.env,env);const secret=env.COMPOUND_V2_ADMIN_PASSWORD||env.COMPOUND_ADMIN_PASSWORD;
 const cookies=['',...[-1,0,1,14400000,14401000,14401001].map(delta=>{const body=(now+delta)+'.fixture';return 'compound_v2_admin='+body+'.'+createHmac('sha256','fixture').update('compound-v2:'+body+':'+secret).digest('base64url');}),'compound_v2_admin=invalid','compound_v2_admin=1234567890123.nonce.bad'];
 for(const cookie of cookies)for(const authorization of ['', 'Bearer '+secret,'Bearer wrong','old-password'])for(const origin of ['https://corvus.gent','https://evil.test','https://preview.example','https://branch.example','https://prod.example','http://127.0.0.1:4420']){const headers={cookie,authorization,origin},body={analytics:true,visitor:'a'.repeat(36)};fixtures.push({operation:'compound-security',env,headers,body,now,expected:{authorized:authorized({headers}),origin:sameOrigin({headers}),analytics:analytics(body,{headers})}});}
 for(const body of [{},{analytics:true,visitor:'a'.repeat(36)},{analytics:'session',visitor:'-'.repeat(36)},{analytics:true,visitor:'A'.repeat(36)},{analytics:'true'}])for(const headers of [{},{dnt:'1'},{'sec-gpc':'1'},{dnt:'0'}])fixtures.push({operation:'compound-security',env,headers,body,now,expected:{authorized:authorized({headers}),origin:sameOrigin({headers}),analytics:analytics(body,{headers})}});
}}finally{Date.now=clock;for(const k of keys){if(saved[k]===undefined)delete process.env[k];else process.env[k]=saved[k];}}
// Intentional security correction: legacy origins contains undefined when Vercel vars are absent.
// Reject an absent Origin instead of retaining that CSRF bypass; bearer-admin bypass is separate.
let hardened=0;for(const fixture of fixtures)if(fixture.operation==='compound-security'&&!fixture.headers.origin&&fixture.expected.origin){fixture.expected.origin=false;hardened++;}
assert.ok(hardened>0);
const result=spawnSync('target/debug/corvus-contract',[],{input:fixtures.map(({expected,...f})=>JSON.stringify(f)).join('\n')+'\n',encoding:'utf8',maxBuffer:20*1024*1024});assert.equal(result.status,0,result.stderr);const rows=result.stdout.trim().split('\n').map(JSON.parse);assert.equal(rows.length,fixtures.length);fixtures.forEach((f,i)=>assert.deepEqual(rows[i],f.expected,JSON.stringify({...f,expected:undefined})));
console.log(`PASS: ${fixtures.length} Compound model/auth/attribution fixtures; zero metrics, native URLs, pending exports, private-field exclusion, legacy admin cookies and DNT/GPC.`);
