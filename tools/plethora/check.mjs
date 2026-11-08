import assert from 'node:assert/strict';import {createClient} from 'redis';
if(process.env.REDIS_URL!=='redis://127.0.0.1:16380/7')throw Error('Only isolated local test Redis');
process.env.PLETHORA_TEST_PREFIX='plethora:test:'+Date.now();process.env.SESSION_SECRET='test-only-secret';process.env.PLETHORA_ADMIN_KEY='test-only-key';process.env.PLETHORA_REFERRAL_CODE='GABE-TEST';process.env.PLETHORA_PT='123';process.env.PLETHORA_PLAY_URL='https://play.google.com/store/apps/details?id=studio.test.plethora';
const {default:handler,track,report}=await import('../../api/_plethora.js');const{PLETHORA_PLACEMENTS}=await import('../../js/plethora-config.js');const {redis}=await import('../../api/_redis.js');const prefix=process.env.PLETHORA_TEST_PREFIX;
const request=(placement,ua='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',extra={})=>({method:'GET',query:placement?{slug:'plethora-'+placement}:{},headers:{'user-agent':ua,'x-forwarded-for':'198.51.100.2'},...extra});
async function run(req){const result={status:200,headers:{}};const res={setHeader:(k,v)=>result.headers[k]=v,status:n=>{result.status=n;return res;},json:data=>{result.data=data;return result;},end:()=>result};await handler(req,res);return result;}
try{
 let r=await run(request(null));assert.equal(r.data.referralCode,'GABE-TEST');
 for(const placement of Object.keys(PLETHORA_PLACEMENTS)){r=await run(request(placement));assert.equal(r.status,302);const u=new URL(r.headers.Location);assert.equal(u.hostname,'apps.apple.com');assert.equal(u.searchParams.get('ct'),'corvus-'+placement);assert.equal(u.searchParams.get('pt'),'123');assert.equal(u.searchParams.get('ref'),'GABE-TEST');assert.equal(r.headers['Cache-Control'],'no-store');await run(request(placement));}
 let data=await report();assert.equal(data.total,Object.keys(PLETHORA_PLACEMENTS).length);assert.equal(data.last24h,data.total);
 r=await run(request('home','Mozilla/5.0 (Macintosh; Intel Mac OS X)'));assert.equal(r.headers.Location,'/plethora?from=home');
 r=await run(request('home','Mozilla/5.0 (Linux; Android 15)'));const play=new URL(r.headers.Location);assert.equal(play.hostname,'play.google.com');assert.equal(play.searchParams.get('referrer'),'utm_source=corvus&utm_campaign=home');
 r=await run({...request('home','Macintosh'),query:{slug:'plethora-home',ios:'1'}});assert.match(r.headers.Location,/apps.apple.com/);
 r=await run({...request('home','Macintosh'),query:{slug:'plethora-home',store:'1'}});assert.match(r.headers.Location,/apps.apple.com/);
 // Landing CTA is not counted again, even after the dedupe window / network changes.
 const noCount={...request('home'),query:{slug:'plethora-home',store:'1',noCount:'1'},headers:{'user-agent':'iPhone','x-forwarded-for':'198.51.100.7'}};
 await run(noCount);assert.equal((await report()).total,data.total);
 await run(request('bio'));assert.equal((await report()).total,data.total); // aliases bio-x, same identity
 const pub=await run({...request(null),query:{action:'stats'}});assert.equal(pub.status,200);assert.equal(pub.data.rows.length,35);assert.equal(pub.data.platforms.ios,35);assert.equal(pub.data.categories.reduce((n,c)=>n+c.total,0),35);assert.equal(pub.data.history.length,7);assert.ok(pub.data.history.slice(0,6).every(d=>d.total===null));
 assert.equal(pub.data.rows.filter(r=>r.id==='plethora-bio').length,0);
 await redis(['HINCRBY',prefix+':clicks','bio',7]);assert.equal((await report()).rows.find(r=>r.id==='plethora-bio-x').total,8);assert.equal((await report()).platforms.unknown,7);await redis(['HINCRBY',prefix+':clicks','bio',-7]);
 for(const [ua,p]of [['Mozilla Android','android'],['Mozilla Mac','desktop']]){await track({...request('qr',ua),headers:{'user-agent':ua,'x-forwarded-for':'198.51.100.'+(p==='android'?80:81)}},'qr');assert.equal((await report()).platforms[p],1);}
 data=await report();
 delete process.env.PLETHORA_PLAY_URL;r=await run(request('home','Android'));assert.equal(r.headers.Location,'/plethora?from=home&platform=android');process.env.PLETHORA_PLAY_URL='https://evil.test/';r=await run(request('home','Android'));assert.equal(r.headers.Location,'/plethora?from=home&platform=android');delete process.env.PLETHORA_PLAY_URL;
 const count=data.total;await run({...request('home'),method:'HEAD',headers:{'user-agent':'iPhone','x-forwarded-for':'198.51.100.3'}});for(const ua of ['Twitterbot','facebookexternalhit','WhatsApp/2','Googlebot'])await run({...request('home',ua),headers:{'user-agent':ua,'x-forwarded-for':'198.51.100.3'}});assert.equal((await report()).total,count);
 assert.equal((await run(request('invalid'))).status,404);assert.equal((await run({...request('home'),method:'POST'})).status,405);
 assert.equal((await run({...request(null),query:{action:'admin'}})).status,401);
 r=await run({...request(null),query:{action:'admin'},headers:{authorization:'Bearer test-only-key'}});assert.equal(r.status,200);assert.equal(r.data.rows.length,Object.keys(PLETHORA_PLACEMENTS).length);assert.ok(!JSON.stringify(r.data).includes('198.51'));
 const crossMidnight=Date.parse('2026-11-08T00:00:00Z'),testReq={...request('game'),headers:{'user-agent':'iPhone','x-forwarded-for':'198.51.100.55'}};assert.equal(await track(testReq,'game',crossMidnight-100),true);assert.equal(await track(testReq,'game',crossMidnight+100),false);
 await redis(['ZADD',prefix+':recent:home',Date.now()-86400001,'old']);assert.equal((await report()).rows.find(x=>x.id==='plethora-home').last24h,1);
 const keys=await redis(['KEYS',prefix+':*']);for(const key of keys.filter(k=>k.includes(':dedupe:')))assert.ok(Number(await redis(['TTL',key]))>0&&Number(await redis(['TTL',key]))<=1800);for(const key of keys.filter(k=>k.includes(':recent:')))assert.ok(Number(await redis(['TTL',key]))>0);
 delete process.env.PLETHORA_REFERRAL_CODE;delete process.env.PLETHORA_PT;r=await run(request('footer'));assert.ok(!r.headers.Location.includes('ref=')&&!r.headers.Location.includes('pt='));
 process.env.REDIS_MAINTENANCE='1';r=await run(request('home'));assert.equal(r.status,302);r=await run(request(null));assert.equal(r.data.ready,false);delete process.env.REDIS_MAINTENANCE;
 console.log(`${Object.keys(PLETHORA_PLACEMENTS).length} placements PASS: iOS/iPad/Android/desktop, 302, attribution, dedupe + midnight, exact 24h, TTLs, auth, bots/HEAD, optional config`);
}finally{const keys=await redis(['KEYS',prefix+':*']);if(keys.length)await redis(['DEL',...keys]);}
process.exit(0);
