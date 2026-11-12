// Test only the disposable local Redis database. No production mutations.
import assert from 'node:assert/strict';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {createClient} from 'redis';
import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
const origin=process.env.SITE_TEST_ORIGIN || 'http://127.0.0.1:4477';
assert.equal(new URL(origin).hostname,'127.0.0.1');
assert.equal(process.env.REDIS_URL,'redis://127.0.0.1:16380/4');
Object.assign(process.env,{SESSION_SECRET:'site-local-tests-only',LEGION_NAMESPACE:'site:test:legion:'});
const {localDay,memberTier,meter}=await import('../../api/_legion/layers.js');
const {key}=await import('../../api/_legion/security.js');
const {tierPath}=await import('../../js/site/page-tiers.js');
assert.equal(tierPath('/wiki/pidgy/%69ndex.html'),'/wiki/pidgy');
for (const [time,zone,day] of [
 ['2026-11-09T12:01:59Z','America/Los_Angeles','2026-11-08'],['2026-11-09T12:02:00Z','America/Los_Angeles','2026-11-09'],
 ['2026-03-08T11:02:00Z','America/Los_Angeles','2026-03-08'],['2026-10-25T03:01:59Z','Europe/Brussels','2026-10-24']
]) assert.equal(localDay(new Date(time),zone),day);
assert.equal(memberTier({status:'pending',verifiedAt:'yes'}),'email');
for(const [rank,tier] of [['tiro','soldier'],['centurio','hacker'],['legatus','call'],['praetor','call']]) assert.equal(memberTier({legion:{rank}}),tier);
const id=randomUUID(), start=new Date('2026-11-09T12:00:00Z').getTime();
for(const [at,tab,op,expected] of [[0,'a','read',242000],[3000,'b','read',239000],[5000,'a','pause',237000],[8000,'b','pause',234000],[99000,'c','read',234000],[120000,'c','read',242000]])
 assert.equal(Number(await meter(id,'America/Los_Angeles',tab,op,start+at)),expected);
const db=createClient({url:process.env.REDIS_URL});await db.connect();
const browser=await chromium.launch();
try{
 await mkdir('test-results/layers',{recursive:true});
 for(const width of [390,1440]){
  const ctx=await browser.newContext({viewport:{width,height:width===390?844:900},timezoneId:'Europe/Brussels'});
  const p=await ctx.newPage();
  await p.goto(origin);await p.locator('[data-site-languages]').waitFor();
  assert.equal(await p.locator('.portal-sections a').count(),5);assert.equal(await p.locator('.site-quiet-footer a').count(),4);
  assert.equal(await p.locator('[data-cardneto-egg],[data-plethora-banner],[data-gem-grid],.site-nav').count(),0);
  assert(await p.locator('[data-newsletter]').isVisible());assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await p.screenshot({path:'test-results/layers/home-'+width+'.png',fullPage:true});
  await p.goto(origin+'/sf/larp/');await p.locator('.sf-photos img').last().scrollIntoViewIfNeeded();
  await p.waitForFunction(()=>[...document.querySelectorAll('.sf-photos img')].every(i=>i.naturalWidth>0));
  await p.screenshot({path:'test-results/layers/sf-'+width+'.png',fullPage:true});
  assert.equal((await p.goto(origin+'/wiki/corvus/namesakes/')).status(),403);
  await p.goto(origin+'/wiki/corvus/');await p.locator('.layer-clock').waitFor();
  const cookie=(await ctx.cookies()).find(c=>c.name==='corvus_layer');
  const session=JSON.parse(Buffer.from(cookie.value.split('.')[0],'base64url'));
  assert.equal(session.zone,'Europe/Brussels');
  const bucket=key('taste:{'+session.id+':'+localDay(Date.now(),session.zone)+'}');
  await db.hSet(bucket,'used',241500);
  await p.evaluate(()=>localStorage.clear());
  await p.goto(origin+'/wiki/pidgy/');await p.getByRole('heading',{name:'402 · payment required'}).waitFor({timeout:12000});
  assert.equal((await p.goto(origin+'/wiki/corvus/index.html')).status(),402);
  const altered=Buffer.from(JSON.stringify({...session,tier:'call'})).toString('base64url')+'.'+cookie.value.split('.')[1];
  await ctx.addCookies([{name:'corvus_layer',value:altered,url:origin}]);
  assert.equal((await p.goto(origin+'/legion/call-room/')).status(),403);
  await ctx.close();
 }
 // Consume the same single-use confirmation and signed Army sessions used by real visitors.
 const ctx=await browser.newContext();
 const req=ctx.request, email='layer-'+id+'@example.test';
 const post=(data)=>req.post(origin+'/api/legion',{headers:{Origin:origin,'x-test-ip':'layers-'+id},data});
 const hash=value=>createHash('sha256').update(value).digest('hex');
 const proof=randomBytes(32).toString('base64url'), subscriber=hash(email);
 await db.set(key('subscriber:'+subscriber),JSON.stringify({email,status:'pending',confirmation:hash(proof)}),{EX:60});
 await db.set(key('confirm:'+hash(proof)),subscriber,{EX:60});
 assert.equal((await post({action:'confirm',token:proof})).status(),200);
 assert.equal((await post({action:'confirm',token:proof})).status(),400);
 assert.equal((await req.get(origin+'/wiki/corvus/namesakes/')).status(),200);
 await db.del(key('subscriber:'+subscriber));
 assert.equal((await req.get(origin+'/wiki/corvus/namesakes/')).status(),403);
 assert.equal((await post({action:'login',password:'site-admin-test'})).status(),200);
 let member;
 for (const rank of ['tiro','centurio','legatus','praetor']) {
  if(!member) {
   const invite=await (await post({action:'create_invite',rank,name:'Layer QA',max_uses:1})).json();
   const claimed=await post({action:'claim',token:new URL(invite.link).pathname.split('/').pop(),email});
   assert.equal(claimed.status(),200);
   member=(await (await req.get(origin+'/api/legion?action=admin')).json()).members.find(m=>m.email===email);
   assert(member);
  } else assert.equal((await post({action:'rank',id:member.id,rank})).status(),200);
  const article=await req.get(origin+'/wiki/corvus/');
  assert.equal(article.status(),200);assert(!(await article.text()).includes('class="layer-clock"'));
  assert.equal((await req.get(origin+'/legion/hacker-room/')).status(),rank==='tiro'?403:200);
  assert.equal((await req.get(origin+'/legion/call-room/')).status(),['legatus','praetor'].includes(rank)?200:403);
 }
 await ctx.close();
 console.log('PASS: five doors, forms, photos, two viewports, signed tiers, shared active-tab budget, localStorage reset, real HTTP 402, local 04:02 and DST.');
}finally{await browser.close();await db.quit();}
process.exit(0);
