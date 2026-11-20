import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {shareCopy,trackedShort,replyPostID,shareDraft,todayDrafts} from '../../compound/v2/share-links.js';
import {PLATFORMS,LANGUAGES,HOOKS,parseSlug,codeURL,fullURL,pinnedComment} from '../../compound/v2/config.js';
const fixtures=[];
function add(input,fn){let expected;try{expected=fn()}catch(e){expected={error:e.message}}fixtures.push({...input,operation:'compound-share',expected});}
for(const lang of Object.keys(LANGUAGES))for(const hook of Object.keys(HOOKS))for(const p of Object.keys(PLATFORMS)){
 const slug=p+'-gm-'+lang+'-'+hook+'1',v=parseSlug(slug);
 add({slug,action:'copy'},()=>shareCopy(v));
 for(const platform of ['x','reply','linkedin','whatsapp'])add({slug,action:'draft',platform,reply:'https://x.com/gabe_maxxing/status/1234'},()=>shareDraft(v,platform,'https://x.com/gabe_maxxing/status/1234'));
 add({slug,action:'urls',medium:'story'},()=>({code:codeURL(v),full:fullURL(v,'story'),pinned:pinnedComment(v)}));
}
for(const slug of ['x-gm-en-b8','bad','X-GM-EN-B8'])for(const source of ['x','linkedin','whatsapp','tiktok',''])for(const medium of ['post','comment','dm','story',''])add({slug,action:'tracked',source,medium},()=>trackedShort({slug},source,medium));
for(const value of ['https://x.com/a/status/1','twitter.com/a/status/1',' MOBILE.X.COM/a/status/1234/video/4?x=1 ','http://x.com/a/status/1','https://x.com.evil.test/a/status/1','https://a@x.com/a/status/1','https://x.com:444/a/status/1','https://x.com:443/a/status/1','https://x.com/i/status/1','https://x.com/i/web/status/123','https://x.com/abcdefghijklmnop/status/123','https://x.com/a/status/0123','https://x.com/a/status/123/photo/5','https://x.com/a/status/123/','https://x.com/a/status/123//','javascript:alert(1)','https://x.com/a/status/12345678901234567890123456'])add({action:'reply',value},()=>replyPostID(value));
for(const day of ['2026-11-01','2026-11-20']){const videos=[{slug:'x-gm-en-b8'},{slug:'tt-gl-nl-mom1',is_example:true},{slug:'invalid'},{slug:'li-gm-fr-int2'}];add({action:'today',videos,day},()=>todayDrafts(videos,new Date(day+'T19:00:00Z')));}
const r=spawnSync('target/debug/corvus-contract',[],{input:fixtures.map(({expected,...v})=>JSON.stringify(v)).join('\n')+'\n',encoding:'utf8',maxBuffer:30*1024*1024});assert.equal(r.status,0,r.stderr);const results=r.stdout.trim().split('\n').map(JSON.parse);assert.equal(results.length,fixtures.length);fixtures.forEach((f,i)=>assert.deepEqual(results[i],f.expected,JSON.stringify({...f,expected:undefined})));console.log(`PASS: ${fixtures.length} localized Compound share/code/pinned URLs, exact tracking/draft encoding, reply URL validation, invalid inputs and Pacific-day lists.`);
