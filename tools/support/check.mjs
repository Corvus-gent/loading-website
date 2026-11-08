import assert from 'node:assert/strict';import crypto from 'node:crypto';
if(process.env.REDIS_URL!=='redis://127.0.0.1:16380/8')throw Error('Local DB 8 only');
process.env.SUPPORT_TEST_PREFIX='support:test:'+Date.now();process.env.SESSION_SECRET='support-local-only';process.env.CALL_ADMIN_KEY='local-admin-only';process.env.RESEND_API_KEY='local-mail-mock';
const{default:handler,supportReport,configuration,challenge,notifyRequest}=await import('../../api/_support.js');const{redis}=await import('../../api/_redis.js');const{SUPPORT_LINKS}=await import('../../js/support-config.js');const prefix=process.env.SUPPORT_TEST_PREFIX;
let mails=[];globalThis.fetch=async(url,options)=>{assert.equal(url,'https://api.resend.com/emails');mails.push(JSON.parse(options.body));return{ok:true};};
const req=(query={},method='GET',body,ip='198.51.100.41')=>({query,method,body,headers:{'user-agent':'Mozilla iPhone','x-forwarded-for':ip,'content-type':'application/json',origin:'http://127.0.0.1:4395'}});
async function run(q){const r={headers:{}};const res={setHeader:(k,v)=>r.headers[k]=v,status:n=>(r.status=n,res),json:b=>r.body=b,end:b=>r.raw=b};await handler(q,res);return r;}
const admin=(body)=>{const r=req({action:'admin'},body?'POST':'GET',body);r.headers.authorization='Bearer '+process.env.CALL_ADMIN_KEY;return r;};
const body=tier=>({name:'Support QA',contact:'qa@example.com',pain:'Launch feedback',times:'today after 3pm PT',tier,coffeePaid:tier!=='quick',source:'linkedin',requestId:crypto.randomUUID(),challenge:challenge(Date.now()-4000).token});
try{
 for(const[id,rule]of Object.entries(SUPPORT_LINKS)){const r=await run(req({slug:id}));assert.equal(r.status,302);const u=new URL(r.headers.Location,'https://corvus.gent');assert.equal(u.searchParams.get('utm_source'),rule.source);assert.equal(u.searchParams.get('utm_medium'),'social');assert.equal(u.searchParams.get('utm_campaign'),'diogenes');if(rule.kind==='roll')assert.equal(u.searchParams.get('from'),'support');if(rule.kind==='bmc')assert.equal(u.origin+u.pathname,'https://buymeacoffee.com/gabe.maxxing');await run(req({slug:id}));}
 assert.equal((await supportReport()).total,16);assert.ok((await supportReport()).rows.every(r=>r.unique===1));await run(req({slug:'call-li'},'HEAD'));assert.equal((await supportReport()).total,16);
 assert.equal((await run(req({action:'admin'}))).status,401);assert.equal(configuration().xURL,'https://x.com/gabe_maxxing');
 const invalid=body('coffee');invalid.coffeePaid=false;assert.equal((await run(req({},'POST',invalid))).status,400);invalid.coffeePaid=true;invalid.website='bot';assert.equal((await run(req({},'POST',invalid))).status,400);
 const cross=req({},'POST',body('quick'));cross.headers.origin='https://evil.test';assert.equal((await run(cross)).status,403);
 const early=body('quick');early.challenge=challenge().token;assert.equal((await run(req({},'POST',early))).status,400);
 for(const[tier,i]of ['quick','coffee','meet'].map((t,i)=>[t,i])){const b=body(tier),r=req({},'POST',b,'198.51.100.'+(50+i));assert.equal((await run(r)).status,201);assert.equal((await run(r)).status,200);assert.equal((await run(req({},'POST',body(tier),'198.51.100.'+(50+i)))).status,429);}
 assert.equal(mails.length,3);assert.equal(mails[0].reply_to,'qa@example.com');assert.match(mails[1].text,/PARACETAMAIL/);
 const list=await run(admin());assert.equal(list.body.rows.length,3);const row=list.body.rows[0],key=prefix+':request:'+row.id,ttl=Number(await redis(['TTL',key]));assert.ok(ttl>0&&ttl<=60*86400);assert.equal(row.mailSent,true);
 assert.equal((await run(admin({id:row.id,status:'scheduled'}))).status,200);assert.ok(Number(await redis(['TTL',key]))<=ttl);assert.equal(JSON.parse(await redis(['GET',key])).status,'scheduled');
 assert.equal((await run(admin({id:row.id,status:'done'}))).status,200);assert.equal(await notifyRequest(row.id),true);assert.equal(mails.length,3);
 assert.ok(!JSON.stringify(await supportReport()).includes('qa@example.com'));const keys=await redis(['KEYS',prefix+':*']);assert.ok(!keys.join().includes('198.51'));for(const k of keys.filter(k=>/:dedupe:|:cool:|:hour:|:submit:|:request:/.test(k)))assert.ok(Number(await redis(['TTL',k]))>0);
 process.env.REDIS_MAINTENANCE='1';assert.equal((await run(req({slug:'roll-x'}))).status,302);assert.equal((await run(req({},'POST',body('quick')))).status,503);delete process.env.REDIS_MAINTENANCE;
 console.log('PASS: 8 redirects, UTM counts/dedupe, 3 booking tiers, paid honor checkbox, 3 mocked email notifications, retry idempotency, private admin/statuses, fixed 60-day TTLs, origin/honeypot/cooldown, no personal public stats, graceful outage.');
}finally{delete process.env.REDIS_MAINTENANCE;const keys=await redis(['KEYS',prefix+':*']);if(keys.length)await redis(['DEL',...keys]);}process.exit(0);
