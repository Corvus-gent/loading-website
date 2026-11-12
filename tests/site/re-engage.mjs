import assert from 'node:assert/strict';
import {createHmac, randomBytes} from 'node:crypto';
import {createClient} from 'redis';
const prefix = 'test:reengage:' + randomBytes(6).toString('hex') + ':';
Object.assign(process.env, {REDIS_URL:'redis://127.0.0.1:16380/4', SESSION_SECRET:'reengage-local-only',
  LEGION_NAMESPACE:prefix, VERCEL_ENV:'production', CRON_SECRET:'local-cron-only', RE_ENGAGE_ENABLED:'false'});
const {key, sha} = await import('../../api/_legion/security.js');
const {DAY, INTERVAL, destinations, enabled} = await import('../../api/_legion/re-engage-config.js');
const {recordVisit, runReengagement, candidate} = await import('../../api/_legion/re-engage.js');
const {unsubscribe} = await import('../../api/_legion/newsletter.js');
const {sendMail} = await import('../../api/_legion/mail.js');
const {default:handler} = await import('../../api/re-engage.js');
const db = createClient({url:process.env.REDIS_URL}); await db.connect();
const now = Date.UTC(2026,10,12,16,23), sent = [];
const send = async message => { sent.push(message); return {ok:true}; };
const logs = [], log = (...args) => logs.push(args);
function cookie(hash, exp=now+DAY) {
  const data = Buffer.from(JSON.stringify({subscriber:hash,exp})).toString('base64url');
  return 'corvus_layer=' + data + '.' + createHmac('sha256',process.env.SESSION_SECRET).update('layer-v1:' + data).digest('base64url');
}
const req = hash => ({headers:{cookie:cookie(hash)}});
async function seed(name, days, extra={}) {
  const email = name+'@example.test', hash=sha(email);
  const row = {email,status:'confirmed',confirmed_at:new Date(now-60*DAY).toISOString(),
    reengage:{lastSeen:now-days*DAY,seen:[],...extra}};
  await db.set(key('subscriber:'+hash),JSON.stringify(row),{EX:86400});
  await db.zAdd(key('subscribers'),{score:now,value:hash}); return hash;
}
async function clear() { for await (const k of db.scanIterator({MATCH:prefix+'*'})) await db.del(k); }
async function observed(at=now) { await db.set(key('reengage:observed-from'),String(now-60*DAY)); await db.set(key('reengage:last-run'),String(at)); }
async function snapshot() { const rows=[];for await (const k of db.scanIterator({MATCH:prefix+'*'})) rows.push([k,await db.dump(k)]);return rows.sort((a,b)=>a[0].localeCompare(b[0])); }
function response() { return {headers:{},statusCode:200,setHeader(k,v){this.headers[k]=v;},status(n){this.statusCode=n;return this;},json(v){this.body=v;return this;},end(){return this;}}; }
try {
  const seven=await seed('seven',7), fourteen=await seed('fourteen',14), thirty=await seed('thirty',30);
  await seed('active',6); await seed('seen-all',30,{seen:destinations.map(p=>p.id)});
  await seed('suppressed',30,{suppressed:true}); await seed('recent',30,{lastAttempt:now-INTERVAL+DAY});
  const pending=await seed('pending',30); const p=JSON.parse(await db.get(key('subscriber:'+pending)));p.status='pending';await db.set(key('subscriber:'+pending),JSON.stringify(p));
  await observed();
  const before=await snapshot();
  await recordVisit(req(seven),{path:'/build/'},now);
  const dry=await runReengagement({now,send,log});
  assert(dry.dryRun); assert.equal(dry.candidates,3); assert.equal(sent.length,0);
  assert.deepEqual(await snapshot(),before,'off means no visit writes, reservations, tokens or cursor changes');
  assert(!JSON.stringify(logs).includes('@')); assert.equal(logs.length,3);
  for(const value of [undefined,'false','1','TRUE']) { if(value===undefined)delete process.env.RE_ENGAGE_ENABLED;else process.env.RE_ENGAGE_ENABLED=value;assert(!enabled()); }
  process.env.RE_ENGAGE_ENABLED='true';process.env.VERCEL_ENV='preview';assert(!enabled());process.env.VERCEL_ENV='production';
  const anonymous=await snapshot();
  await recordVisit({headers:{}},{path:'/build/'},now);
  await recordVisit({headers:{cookie:cookie(seven)+'x'}},{path:'/build/'},now);
  await recordVisit({headers:{cookie:cookie(seven,now-1)}},{path:'/build/'},now);
  await recordVisit(req(pending),{path:'/build/'},now);
  assert.deepEqual(await snapshot(),anonymous,'anonymous, forged, expired and pending visits create no records');
  const concurrent=await Promise.all([runReengagement({now,send,log}),runReengagement({now,send,log})]);
  assert.equal(concurrent.reduce((n,r)=>n+r.sent,0),3);assert.equal(sent.length,3);
  assert.deepEqual(sent.map(m=>m.subject).sort(),['a light under the door','still a little strange in here','the crow left a mark'].sort());
  for(const m of sent) { assert.equal((m.text.match(/https:\/\//g)||[]).length,2);assert(m.text.includes('Unsubscribe: '+m.unsubscribeUrl)); }
  assert.equal((await runReengagement({now:now+1,send,log})).attempted,0);
  const raw=new URL(sent.find(m=>m.to==='seven@example.test').unsubscribeUrl).searchParams.get('token');
  await unsubscribe(raw);assert.equal(await db.get(key('subscriber:'+seven)),null);
  await seed('seven',30);assert.equal((await runReengagement({now:now+2,send,log})).attempted,0,'re-subscription cannot bypass 14-day cap');
  await recordVisit(req(fourteen),{path:'/build/'},now+10);
  let row=JSON.parse(await db.get(key('subscriber:'+fourteen)));
  assert.equal(row.reengage.lastSeen,now+10);assert.deepEqual(row.reengage.seen,['ledger']);assert.equal(row.reengage.stage,0);
  assert((await db.ttl(key('subscriber:'+fourteen)))<=86400,'visits do not extend subscription retention');
  await recordVisit({headers:{cookie:cookie(fourteen),dnt:'1'}},{path:'/sf/larp/'},now+20);
  row=JSON.parse(await db.get(key('subscriber:'+fourteen)));assert(row.reengage.suppressed);assert.equal(row.reengage.lastSeen,now+10);
  assert.equal(candidate(row,now-60*DAY,now+40*DAY),null);
  await recordVisit(req(fourteen),{path:'/sf/larp/'},now+30);
  row=JSON.parse(await db.get(key('subscriber:'+fourteen)));assert(!row.reengage.suppressed);assert.deepEqual(row.reengage.seen,['ledger','sf-field-notes']);
  const threshold={status:'confirmed',confirmed_at:new Date(now-60*DAY).toISOString(),reengage:{lastSeen:now-7*DAY}};
  assert.equal(candidate(threshold,now-60*DAY,now-1),null);assert.equal(candidate(threshold,now-60*DAY,now).template.days,7);
  threshold.reengage.lastAttempt=now-INTERVAL;assert(candidate(threshold,now-60*DAY,now));threshold.reengage.lastAttempt++;assert.equal(candidate(threshold,now-60*DAY,now),null);
  await clear();await seed('sequence',7);await observed();
  const series=[];
  for(const at of [now,now+INTERVAL,now+2*INTERVAL]) {
    await observed(at);
    assert.equal((await runReengagement({now:at,send:async m=>{series.push(m);return {ok:true};},log})).sent,1);
  }
  assert.deepEqual(series.map(m=>m.subject),['a light under the door','the crow left a mark','still a little strange in here']);
  assert.equal(new Set(series.map(m=>m.text.match(/https:\/\/corvus\.gent[^\s]+/)[0])).size,3,'each letter points to a different unseen page');
  await clear();await seed('failure',30);await observed();
  assert.equal((await runReengagement({now,send:async()=>{throw Error('ambiguous timeout');},log})).failed,1);
  assert.equal((await runReengagement({now:now+1,send,log})).attempted,0,'ambiguous send must not be retried within 14 days');
  await clear();await seed('warmup',60);
  assert.equal((await runReengagement({now,send,log})).attempted,0,'activation never backfills an old list');
  await observed();await db.set(key('reengage:last-run'),String(now-3*DAY));
  assert.equal((await runReengagement({now,send,log})).attempted,0,'a pause restarts observation');
  let res=response();await handler({method:'GET',headers:{}},res);assert.equal(res.statusCode,401);
  res=response();await handler({method:'POST',headers:{origin:'https://evil.example'},body:{}},res);assert.equal(res.statusCode,403);
  process.env.RE_ENGAGE_ENABLED='false';res=response();await handler({method:'GET',headers:{authorization:'Bearer local-cron-only'}},res);assert.equal(res.statusCode,200);assert(res.body.dryRun);
  process.env.LEGION_MAIL_FROM='The Crow <crow@corvus.gent>';process.env.LEGION_MAIL_REPLY_TO='gabe@corvus.army';process.env.RESEND_API_KEY='local-fake-key';delete process.env.LEGION_TEST_MAIL;
  const originalFetch=globalThis.fetch;let payload;
  globalThis.fetch=async(url,options)=>{assert.equal(url,'https://api.resend.com/emails');payload=JSON.parse(options.body);return {ok:true};};
  try { assert((await sendMail({to:'mail@example.test',subject:'test',text:'test',unsubscribeUrl:'https://corvus.gent/letters/unsubscribe/?token=test'},'local-only')).ok); }
  finally { globalThis.fetch=originalFetch; }
  assert.equal(payload.from,'The Crow <crow@corvus.gent>');assert.equal(payload.reply_to,'gabe@corvus.army');assert(payload.headers['List-Unsubscribe']);
  console.log('PASS: disabled dry-run/no writes, confirmed-only signed visits, privacy suppression, thresholds, unseen links, concurrency, 14-day cap/re-subscribe, unsubscribe, TTL, timeout suppression, warmup/resume, cron auth and mail identity.');
} finally { await clear();await db.quit(); }
process.exit(0);
