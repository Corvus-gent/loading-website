import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {createClient} from 'redis';
const prefix='night-test:'+crypto.randomUUID()+':';
Object.assign(process.env,{REDIS_URL:'redis://127.0.0.1:16380/0',SESSION_SECRET:'local-night-test-only',LEGION_NAMESPACE:prefix+'legion:',ARMY_NAMESPACE:prefix+'army:',ADMIN_KEY:'local-admin-test-only',LEGION_TEST_ORIGIN:'http://127.0.0.1:8794',LEGION_TEST_MAIL:'1',LEGION_STRIPE_MODE:'TEST',LEGION_PAYMENT_LINK_TEST:'https://buy.stripe.com/test_example',LEGION_PAYMENT_LINK_ID_TEST:'plink_test',LEGION_STRIPE_WEBHOOK_SECRET_TEST:'whsec_local_only'});
const {default:handler}=await import('../api/_legion/handler.js');
const {processPayment}=await import('../api/_legion/payments.js');
const store=await import('../api/_legion/store.js');
let cookie='';
async function call(body,query={},extra={}){const out={headers:{}};const res={setHeader:(k,v)=>out.headers[k]=v,getHeader:k=>out.headers[k],status:n=>(out.status=n,res),json:d=>(out.body=d,out)};await handler({method:body?'POST':'GET',headers:{origin:process.env.LEGION_TEST_ORIGIN,'content-type':'application/json','x-forwarded-for':crypto.randomUUID(),cookie},body,query,...extra},res);return out;}
const client=createClient({url:process.env.REDIS_URL});await client.connect();
try{
 assert.equal((await call(null,{action:'admin'})).status,401);
 assert.equal((await call({action:'login',password:'wrong'})).status,401);
 const login=await call({action:'login',password:process.env.ADMIN_KEY});assert.equal(login.status,200);cookie=login.headers['Set-Cookie'].map(x=>x.split(';')[0]).join('; ');
 assert.equal((await call(null,{action:'admin'})).status,200);
 const created=await call({action:'create_invite',rank:'centurio',name:'Test builder',max_uses:1,days:1});assert.equal(created.status,200);const token=created.body.link.split('/').pop();
 const adminCookie=cookie;cookie='';
 assert.equal((await call(null,{action:'invite',token})).body.rank,'centurio');
 const claims=await Promise.all(Array.from({length:12},(_,i)=>call({action:'claim',email:`builder${i}@example.com`,handle:`builder${i}`,token})));
 assert.equal(claims.filter(x=>x.status===200).length,1,'one-use invitation is atomic');
 assert.equal((await call(null,{action:'invite',token})).status,410);
 const wall=await call(null);assert.equal(wall.body.members.length,1);assert.ok(!JSON.stringify(wall.body).includes('@example.com'),'emails stay private');
 const app=await call({action:'apply',who:'New Builder new@example.com',build:'A useful tool',why:'To share skills',source:'application'});assert.equal(app.status,200);
 cookie=adminCookie;const apps=await call(null,{action:'admin'});assert.equal(apps.body.applications.length,1);
 const review=await call({action:'decide',id:apps.body.applications[0].id,decision:'approve'});assert.equal(review.status,200);assert.ok((await store.members()).some(m=>m.email==='new@example.com'&&m.rank==='miles'));
 cookie='';const checkout=await call({action:'checkout',email:'paid@example.com',handle:'paidbuilder'});assert.equal(checkout.status,200);const ref=new URL(checkout.body.url).searchParams.get('client_reference_id');
 const event={type:'checkout.session.completed',livemode:false,data:{object:{id:'cs_test_example',payment_status:'paid',amount_total:100,currency:'usd',payment_link:'plink_test',payment_intent:'pi_local_test',client_reference_id:ref}}};
 assert.equal((await processPayment({...event,livemode:true})).ignored,true);
 assert.equal((await processPayment({...event,data:{object:{...event.data.object,amount_total:1}}})).ignored,true);
 const payments=await Promise.all([processPayment(event),processPayment(event)]);assert.equal(payments.filter(x=>x.duplicate).length,1);assert.equal((await store.members()).filter(x=>x.email==='paid@example.com').length,1);
 assert.equal((await call({action:'apply',who:'a@example.com',build:'thing',why:'reason'},{},{headers:{origin:'https://evil.example','content-type':'application/json'}})).status,403);
 console.log('Legion: admin auth, atomic invitation race, private wall, email review, signed-payment business validation, duplicate receipt and origin checks passed. No external mail or payments.');
}finally{const keys=[];for await(const k of client.scanIterator({MATCH:prefix+'*',COUNT:100}))keys.push(k);if(keys.length)await client.del(keys);await client.quit();}
process.exit(0);
