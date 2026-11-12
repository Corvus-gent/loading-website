import assert from 'node:assert/strict';
import {createClient} from 'redis';
process.env.REDIS_URL='redis://127.0.0.1:16380/7';
process.env.REPORT_TOKEN='test-report-token';
const client=createClient({url:process.env.REDIS_URL,socket:{reconnectStrategy:false}});await client.connect();assert.equal(await client.dbSize(),0,'empty local test DB only');
const store=args=>client.sendCommand(args.map(String));
const {createCountHandler,visitorCounters,countDay}=await import('../api/_visitor-counts.js');
const {checks}=await import('../api/_health.js');
const {pages}=await import('../api/_stats-snap.js');
const {default:report,reportData,markdown}=await import('../api/_report.js');
const {recordError}=await import('../api/_function-errors.js');
const res=()=>({headers:{},setHeader(k,v){this.headers[k]=v;},status(n){this.code=n;return this;},json(v){this.body=v;return this;},send(v){this.body=v;return this;},end(){return this;}});
const now=Date.now(),day=countDay(now),hit=createCountHandler({store,now:()=>now}),ok=createCountHandler({store,now:()=>now,soldier:true});
const req=body=>({method:'POST',body,headers:{origin:'https://corvus.gent'}});
try{
 let r=res();await hit(req({page:'/call/?email=private@example.test',day}),r);assert.equal(r.code,204);assert.equal(r.headers['Set-Cookie'],undefined);
 await hit(req({page:'/call/',day}),res());await ok(req({day}),res());
 assert.deepEqual(await visitorCounters(day,store),{unseen:{day:2,all:2},soldiers:{day:1,all:1}});
 assert.deepEqual({...await client.hGetAll('unseen:pages:'+day)},{'/call/':'2'});
 for(const key of await client.keys('*')){assert.ok(!key.includes('private'));if(!key.endsWith(':all'))assert.ok(await client.ttl(key)>0);}
 for(const body of [{day,page:'/call/',email:'bad'}, {day:'2000-01-01',page:'/'},{day,page:'x'.repeat(161)}]){r=res();await hit(req(body),r);assert.equal(r.code,400);}
 r=res();await hit({...req({day,page:'/'}),headers:{origin:'https://evil.test'}},r);assert.equal(r.code,403);
 r=res();await hit({...req({day,page:'/'}),method:'GET'},r);assert.equal(r.code,405);
 await hit(req({day,page:'/private/'}),res());assert.equal((await visitorCounters(day,store)).unseen.day,2);
 const jobs=[];const snap=()=>JSON.stringify({state:'ready',updated:new Date(now-90000).toISOString()});const probe=checks({store:async()=>pages.map(snap),now:()=>now,refresh:()=>new Promise(()=>{}),enqueue:p=>jobs.push(p)});
 const start=performance.now();await probe.snapshots();assert.ok(performance.now()-start<100);assert.equal(jobs.length,1,'background work never blocks health');
 const broken=checks({store:async()=>pages.map(()=>null),now:()=>now,refresh:async()=>{},enqueue:()=>{}});await assert.rejects(broken.snapshots(),/missing/);
 r=res();await report({method:'GET',headers:{},query:{}},r);assert.equal(r.code,401);
 await client.set('report:markdown:v1','# fixture',{EX:60});r=res();await report({method:'GET',headers:{'x-report-token':'test-report-token'},query:{}},r);assert.equal(r.code,200);assert.equal(r.body,'# fixture');assert.equal(r.headers['Cache-Control'],'private, no-store');
 await recordError('snapshot','overview:visitors',store);assert.equal(await client.lLen('report:errors'),1);await recordError('bad','secret@email',store);assert.equal(await client.lLen('report:errors'),1);
 const reportStore=async args=>args[0]==='MGET'&&args[1].startsWith('stats:snap:')?pages.map(snap):args[0]==='INFO'?'used_memory:1234\r\npassword:secret\r\n':store(args);
 const data=await reportData({store:reportStore,health:async()=>({status:'ok',checks:{redis:{ok:true,ms:5}}}),query:async sql=>sql.includes('INTERVAL')?[['notice_ok','/private/person@example.test',1,new Date(now).toISOString()]]:[[day,4,7]],now:()=>now});
 const md=markdown(data);assert.match(md,/today: 6/);assert.match(md,/soldiers who said ok today: 1/);assert.ok(!md.includes('person@example.test'));assert.ok(!md.includes('secret'));assert.match(md,/1234/);
 console.log('counting: anonymous schema/counters/TTL, origin/private exclusion, soldiers, non-blocking health, report auth/cache/redaction and error codes passed');
}finally{await client.flushDb();await client.disconnect();}
process.exit(0);
