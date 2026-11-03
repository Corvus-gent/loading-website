import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { redis } from '../api/_redis.js';
import { createSession } from '../api/_session.js';
import { parseTrackLink,loadTracks } from '../api/_music-store.js';
import music from '../api/music.js';
import admin from '../api/music-admin.js';
if(process.env.REDIS_URL!=='redis://127.0.0.1:16379/15')throw new Error('Tests require isolated local Redis database 15');
await redis(['FLUSHDB']);
let checks=0;
const expect=(actual,expected,label)=>{assert.deepEqual(actual,expected,label);checks++;};
const origin='https://corvus.gent';
function response(){return {code:200,headers:{},setHeader(k,v){this.headers[k]=v;},status(n){this.code=n;return this;},json(data){this.body=data;return this;},end(){return this;}};}
async function call(handler,{method='GET',body={},cookie='',ip='test-a',query={},from=origin}={}){const res=response();await handler({method,body,query,headers:{cookie,origin:from,'x-forwarded-for':ip}},res);return res;}
async function visitor(ip='test-a'){const r=await call(music,{ip});return {cookie:r.headers['Set-Cookie'].split(';')[0],ip};}
async function session(email){const res=response();await createSession(res,email);return res.headers['Set-Cookie'].split(';')[0];}
async function proof(user,action){
 const r=await call(music,{...user,query:{challenge:action}});assert.equal(r.code,200);const ch=r.body.challenge;
 let nonce=0;for(;;nonce++){const h=crypto.createHash('sha256').update(`${ch.salt}:${nonce}`).digest();let bits=0;for(const b of h){if(!b)bits+=8;else{bits+=Math.clz32(b)-24;break;}}if(bits>=ch.bits)break;}
 return {challenge:ch.id,nonce};
}
async function post(user,body){return call(music,{...user,method:'POST',body:{...body,...await proof(user,body.action)}});}
const owner=await session('gabriel@corvus.gent'),other=await session('someone@corvus.gent');
expect((await call(admin)).code,401,'anonymous admin denied');
expect((await call(admin,{cookie:other})).code,403,'other corvus account denied');
expect((await call(admin,{cookie:other,method:'POST',body:{action:'remove',id:'x'}})).code,403,'other account cannot mutate');
const baseline=(await call(admin,{cookie:owner})).body;
expect(baseline.tracks.length,258,'complete seed');
const first=baseline.tracks[0].id,second=baseline.tracks[1].id;
expect((await call(admin,{cookie:owner,method:'POST',from:'https://evil.example',body:{action:'remove',id:first,revision:baseline.revision}})).code,403,'cross origin admin denied');
expect((await call(admin,{cookie:owner,method:'POST',body:{action:'order',ids:[first,first],revision:baseline.revision}})).code,400,'invalid order denied');
const reverse=baseline.tracks.map(t=>t.id).reverse();
let result=await call(admin,{cookie:owner,method:'POST',body:{action:'order',ids:reverse,revision:baseline.revision}});
expect(result.code,200,'owner order accepted');expect(result.body.tracks[0].id,reverse[0],'order persisted');
expect((await call(admin,{cookie:owner,method:'POST',body:{action:'remove',id:first,revision:baseline.revision}})).code,409,'stale edit cannot overwrite');
const revision=result.body.revision;
const competing=await Promise.all([call(admin,{cookie:owner,method:'POST',body:{action:'update',id:first,genre:'us hip-hop',note:'one',revision}}),call(admin,{cookie:owner,method:'POST',body:{action:'update',id:first,genre:'us hip-hop',note:'two',revision}})]);
expect(competing.map(r=>r.code).sort(),[200,409],'concurrent admin edits protected');
expect(parseTrackLink('https://evil.example/track/0wwPcA6wtMf6HUMpIRdeP7'),null,'untrusted host rejected');
expect(parseTrackLink('https://music.apple.com@evil.example/us/song/123'),null,'userinfo URL rejected');
expect(parseTrackLink('https://music.apple.com/us/album/name/123'),null,'album without track rejected');
expect(parseTrackLink('https://music.apple.com/be/album/name/123?i=456'),{provider:'apple',id:'456',country:'be'},'Apple song URL parsed');
expect(parseTrackLink('https://open.spotify.com/intl-nl/track/0wwPcA6wtMf6HUMpIRdeP7?si=abc'),{provider:'spotify',id:'0wwPcA6wtMf6HUMpIRdeP7'},'Spotify locale parsed');
const user=await visitor(),different=await visitor('test-b');
let p=await proof(user,'vote');
expect((await call(music,{...different,method:'POST',body:{action:'vote',id:first,...p}})).code,403,'proof bound to voter');
p=await proof(user,'vote');
expect((await call(music,{...user,method:'POST',body:{action:'poll',choice:'spotify',...p}})).code,403,'proof bound to action');
p=await proof(user,'vote');
expect((await call(music,{...user,method:'POST',body:{action:'vote',id:first,...p}})).code,200,'main track accepts like');
expect((await call(music,{...user,method:'POST',body:{action:'vote',id:first,...p}})).code,403,'proof cannot be replayed');
await post(user,{action:'vote',id:first});
expect((await call(music,user)).body.votes[first],1,'same visitor cannot double vote');
const proofs=await Promise.all([proof(user,'vote'),proof(user,'vote')]);
await Promise.all(proofs.map(p=>call(music,{...user,method:'POST',body:{action:'vote',id:second,...p}})));
expect((await call(music,user)).body.votes[second],1,'concurrent votes counted once');
expect((await post(user,{action:'vote',id:'unknown'})).code,400,'unknown vote rejected');
await post(user,{action:'poll',choice:'spotify'});await post(user,{action:'poll',choice:'apple'});
expect((await call(music,user)).body.poll,{spotify:1,apple:0,mine:'spotify'},'poll only counts first vote');
expect((await call(music,{...user,method:'POST',body:{action:'suggest',website:'bot'}})).code,400,'honeypot rejected');
// Catalog responses are deterministic fixtures; no external requests or email are sent.
globalThis.fetch=async url=>{
 const id=new URL(url).searchParams.get('id');
 if(String(url).startsWith('https://itunes.apple.com/lookup'))return {ok:true,json:async()=>({results:[{kind:'song',trackId:Number(id),trackName:'Fixture '+id,artistName:'Fixture artist'}]})};
 throw new Error('Unexpected external request');
};
const newbie=await visitor('newbie');
const np=await proof(newbie,'suggest');
// Force a future server not-before to reliably test minimum dwell even on slow machines.
const saved=JSON.parse(await redis(['GET',`music:challenge:${np.challenge}`]));saved.notBefore=Date.now()+10000;await redis(['SET',`music:challenge:${np.challenge}`,JSON.stringify(saved),'EX','300']);
expect((await call(music,{...newbie,method:'POST',body:{action:'suggest',url:'https://music.apple.com/us/song/100001',...np}})).code,403,'fast submissions rejected');
const aged=await visitor('suggest-a');const vid=aged.cookie.split('=')[1].split('.')[0];await redis(['SET',`music:seen:${vid}`,String(Date.now()-5000),'EX','3600']);
const twoProofs=await Promise.all([proof(aged,'suggest'),proof(aged,'suggest')]);
const simultaneous=await Promise.all(twoProofs.map((p,i)=>call(music,{...aged,method:'POST',body:{action:'suggest',url:`https://music.apple.com/us/song/${100010+i}`,...p}})));
expect(simultaneous.map(r=>r.code).sort(),[200,429],'concurrent suggestions obey cooldown');
const failed=simultaneous.find(r=>r.code===429);expect(failed.body.retryAfter>0,true,'timer returned');expect(Number(failed.headers['Retry-After'])>0,true,'Retry-After header returned');
const newCookie=await visitor('suggest-a');const newVid=newCookie.cookie.split('=')[1].split('.')[0];await redis(['SET',`music:seen:${newVid}`,String(Date.now()-5000),'EX','3600']);
expect((await post(newCookie,{action:'suggest',url:'https://music.apple.com/us/song/100012'})).code,429,'IP cooldown survives cookie reset');
expect((await post({...aged,ip:'new-ip'},{action:'suggest',url:'https://music.apple.com/us/song/100013'})).code,429,'voter cooldown survives IP change');
const suggestionId=simultaneous.find(r=>r.code===200).body.suggestions[0].id;
let snapshot=await loadTracks();
result=await call(admin,{cookie:owner,method:'POST',body:{action:'promote',id:suggestionId,genre:'pop 00s',position:2,revision:snapshot.revision}});
expect(result.code,200,'owner promotes suggestion');expect(result.body.tracks[1].id,suggestionId,'promotion position correct');expect(result.body.suggestions.length,0,'promotion removes suggestion atomically');
result=await call(admin,{cookie:owner,method:'POST',body:{action:'add',url:'https://music.apple.com/us/song/100099',genre:'rock',position:1,revision:result.body.revision}});
expect(result.code,200,'Apple URL can be added');expect(result.body.tracks[0].artist,'Fixture artist','metadata resolved');
const added=result.body.tracks[0];
expect((await call(admin,{cookie:owner,method:'POST',body:{action:'add',url:'https://music.apple.com/us/song/100099',genre:'rock',position:1,revision:result.body.revision}})).code,409,'duplicate Apple URL rejected');
result=await call(admin,{cookie:owner,method:'POST',body:{action:'remove',id:added.id,revision:result.body.revision}});
expect(result.code,200,'owner removes song');expect(result.body.tracks.some(t=>t.id===added.id),false,'removed song absent');
// Exercise daily and total caps in the isolated database.
const {ipHash}=await import('../api/_music-security.js');
const rateUser=await visitor('rate-user'),rateVid=rateUser.cookie.split('=')[1].split('.')[0];
await redis(['SET',`music:seen:${rateVid}`,String(Date.now()-5000),'EX','3600']);
const ipKey=ipHash({headers:{'x-forwarded-for':'rate-user'}});
await redis(['SET',`music:suggday:${ipKey}`,'5','EX','86400']);
expect((await post(rateUser,{action:'suggest',url:'https://music.apple.com/us/song/100100'})).body.error,'daily_limit','five-per-day server limit');
await redis(['DEL',`music:suggday:${ipKey}`]);
for(let i=0;i<300;i++)await redis(['HSET','music:sugg',`fixture_${i}`,'fixture']);
expect((await post(rateUser,{action:'suggest',url:'https://music.apple.com/us/song/100101'})).body.error,'box_full','300-suggestion cap');
expect((await post(rateUser,{action:'suggest',url:'https://evil.example/us/song/100102'})).code,400,'invalid URL reports input error');
console.log(`${checks} music API checks passed (real local Redis, including atomic races).`);
await redis(['FLUSHDB']);process.exit(0);
