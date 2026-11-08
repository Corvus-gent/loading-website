import assert from 'node:assert/strict';
if(process.env.REDIS_URL!=='redis://127.0.0.1:16380/7')throw Error('Only isolated local test Redis');
process.env.PLETHORA_TEST_PREFIX='plethora:test:'+Date.now();process.env.SESSION_SECRET='test-only-secret';process.env.PLETHORA_ADMIN_KEY='test-only-key';process.env.CRON_SECRET='test-cron';
const {default:handler,track,report,snapshot,csv,ptDay}=await import('../../api/_plethora.js');
const{PLETHORA_PLACEMENTS}=await import('../../js/plethora-config.js');const{redis}=await import('../../api/_redis.js');const p=process.env.PLETHORA_TEST_PREFIX,n=Object.keys(PLETHORA_PLACEMENTS).length,day=new Date().toISOString().slice(0,10),now=Date.parse(day+'T20:00:00Z'),snapAt=Date.parse(day+'T00:00:00Z')+86400000+8*3600000;
const request=(ua='Mozilla iPhone',ip='198.51.100.2')=>({method:'GET',query:{},headers:{'user-agent':ua,'x-forwarded-for':ip,'x-vercel-ip-country':'BE'}});
async function run(req){const r={headers:{}};const res={setHeader:(k,v)=>r.headers[k]=v,status:n=>(r.status=n,res),json:data=>r.data=data,end:body=>r.body=body};await handler(req,res);return r;}
try{
 await redis(['HSET',p+':clicks','bio',7]);await redis(['HSET',p+':day:'+day,'bio',3]);
 for(const id of Object.keys(PLETHORA_PLACEMENTS)){assert.equal(await track(request(),id,now),true);assert.equal(await track(request(),id,now+1),false);}
 let d=await report(now+10);assert.equal(d.total,n+7);assert.equal(d.raw,n*2);assert.equal(d.last24h,n);assert.equal(d.rows.length,n);assert.equal(d.destinations.ossman,9);assert.equal(d.destinations.download,n-9);assert.equal(d.destinations.unknown,7);assert.equal(d.platforms.ios,n);assert.equal(d.platforms.unknown,7);assert.equal(d.history.at(-1).total,n);assert.equal(d.categories.reduce((s,c)=>s+c.total,0),n+7);
 assert.equal(await track(request(),'bio',now+2),false);assert.equal((await report(now+10)).raw,n*2+1);assert.equal((await report(now+10)).rows.find(r=>r.id==='plethora-bio-x').total,8);
 const parallel=await Promise.all(Array.from({length:20},()=>track(request('Mozilla Android','198.51.100.3'),'home',now+3)));assert.equal(parallel.filter(Boolean).length,1);assert.equal((await report(now+10)).raw,n*2+21);
 const noCount=request('Mozilla Desktop','198.51.100.4');noCount.query.noCount='1';assert.equal(await track(noCount,'qr',now+5),true); // obsolete bypass cannot discard real clicks
 let event=(await redis(['ZRANGE',p+':events:'+day,0,-1])).map(JSON.parse).find(e=>e.device==='desktop');assert.equal(event.country,'BE');assert.equal(event.device,'desktop');assert.equal(event.destination,'download');assert.ok(!JSON.stringify(event).includes('198.51')&&!Object.hasOwn(event,'ip'));
 for(const ua of ['Googlebot','Twitterbot','facebookexternalhit','WhatsApp','curl'])assert.equal(await track(request(ua),'home',now),false);
 assert.equal(await track({...request(),method:'HEAD'},'home',now),false);
 assert.equal(ptDay(Date.parse('2026-11-08T07:59:59Z')),'2026-11-07');assert.equal(ptDay(Date.parse('2026-11-08T08:00:00Z')),'2026-11-08');assert.equal(ptDay(Date.parse('2026-07-08T07:00:00Z')),'2026-07-08');
 assert.equal((await snapshot(Date.parse('2026-11-09T07:00:00Z'))).skipped,true);assert.equal((await snapshot(Date.parse('2026-07-08T08:00:00Z'))).skipped,true);
 const snap=await snapshot(snapAt,true);assert.equal(snap.saved,1);let saved=JSON.parse(await redis(['GET',p+':snapshot:'+day]));assert.equal(saved.total,n+2);assert.equal(saved.raw,n*2+22);assert.equal(await redis(['TTL',p+':snapshot:'+day]),-1);assert.equal(await redis(['TTL',p+':ptday:'+day]),-1);assert.ok(await redis(['GET',p+':snapshot:legacy-utc:'+day]));
 await snapshot(snapAt+60000,true);assert.equal(JSON.parse(await redis(['GET',p+':snapshot:'+day])).total,saved.total);
 // A late write to yesterday is picked up by a later catch-up, with no reset.
 assert.equal(await track(request('Mozilla Desktop','198.51.100.99'),'game',now+50),true);await snapshot(snapAt+120000,true);assert.equal(JSON.parse(await redis(['GET',p+':snapshot:'+day])).total,saved.total+1);
 const exportText=await csv(),exportRows=exportText.trim().split('\r\n').slice(1).map(r=>r.split(','));assert.equal(exportRows.reduce((s,r)=>s+Number(r[5]),0),(await report(now+100)).total);assert.equal(exportRows.reduce((s,r)=>s+Number(r[6]),0),(await report(now+100)).raw);assert.ok(!exportText.includes('198.51')&&!exportText.includes('nonce'));
 for(const key of await redis(['KEYS',p+':dedupe:*']))assert.ok(Number(await redis(['TTL',key]))>0&&Number(await redis(['TTL',key]))<=1800);
 assert.equal((await run({...request(),query:{action:'snapshot'}})).status,401);assert.equal((await run({...request(),query:{action:'admin'}})).status,401);
 let r=await run({...request(),query:{action:'admin'},headers:{authorization:'Bearer test-only-key'}});assert.equal(r.status,200);assert.ok(!JSON.stringify(r.data).includes('198.51'));
 r=await run({...request(),query:{action:'csv'}});assert.equal(r.status,200);assert.match(r.headers['Content-Type'],/text\/csv/);
 const midnight=Date.parse(day+'T00:00:00Z')+86400000;assert.equal(await track(request('Mozilla','198.51.100.50'),'pause',midnight-10),true);assert.equal(await track(request('Mozilla','198.51.100.50'),'pause',midnight+10),false);
 process.env.REDIS_MAINTENANCE='1';r=await run({...request(),query:{slug:'plethora-home'}});assert.equal(r.status,302);assert.match(r.headers.Location,/^https:\/\/plethora.studio\/download\?utm_source=gabe&/);r=await run({...request(),query:{action:'stats'}});assert.equal(r.data.ready,false);delete process.env.REDIS_MAINTENANCE;
 console.log('PASS: legacy totals preserved; raw + atomic 30min dedupe; country/device/destination; bots; TTLs; DST midnight; durable/catch-up snapshots; CSV reconciliation; private auth; Redis outage redirect.');
}finally{delete process.env.REDIS_MAINTENANCE;const keys=await redis(['KEYS',p+':*']);if(keys.length)await redis(['DEL',...keys]);}
process.exit(0);
