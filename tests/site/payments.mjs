import assert from 'node:assert/strict';import crypto from 'node:crypto';import Stripe from 'stripe';import {createClient} from 'redis';
const namespace='site:payments:'+crypto.randomBytes(6).toString('hex')+':';
Object.assign(process.env,{REDIS_URL:'redis://127.0.0.1:16380/4',SESSION_SECRET:'site-local-tests-only',ARMY_NAMESPACE:namespace+'army:',LEGION_NAMESPACE:namespace+'legion:',LEGION_STRIPE_MODE:'TEST',LEGION_PAYMENT_LINK_ID_TEST:'plink_test_safe',LEGION_STRIPE_WEBHOOK_SECRET_TEST:'whsec_local_only',LEGION_PAYMENT_LINK_TEST:'https://buy.stripe.com/test_fixture'});
const {checkout,webhook}=await import('../../api/_legion/payments.js'),{members}=await import('../../api/_legion/store.js');
const payment=await checkout({email:'checkout@example.test',handle:'checkout_test'}),ref=new URL(payment.url).searchParams.get('client_reference_id');
const valid={id:'evt_test_local',type:'checkout.session.completed',livemode:false,data:{object:{id:'cs_test_local',payment_status:'paid',currency:'usd',amount_total:100,payment_link:'plink_test_safe',payment_intent:'pi_local',client_reference_id:ref}}};
async function send(event,alter=false){const payload=JSON.stringify(event),signature=Stripe.webhooks.generateTestHeaderString({payload,secret:'whsec_local_only'});return webhook(new Request('https://corvus.gent/api/legion/stripe',{method:'POST',headers:{'stripe-signature':signature},body:alter?payload+' ':payload}));}
assert.equal((await send(valid,true)).status,400,'tampered body rejected');
for(const patch of [{amount_total:101},{currency:'eur'},{payment_link:'wrong'},{payment_status:'unpaid'},{payment_intent:''}]){
 const event=structuredClone(valid);Object.assign(event.data.object,patch);assert((await(await send(event)).json()).ignored);assert.equal((await members()).length,0);
}
const wrongMode=structuredClone(valid);wrongMode.livemode=true;assert((await(await send(wrongMode)).json()).ignored);
assert((await(await send(valid)).json()).ok);assert.equal((await members()).length,1);assert((await(await send(valid)).json()).duplicate);assert.equal((await members()).length,1);
const tooLarge=await webhook(new Request('https://corvus.gent/api/legion/stripe',{method:'POST',body:'a'.repeat(128001)}));assert.equal(tooLarge.status,413);
const r=createClient({url:'redis://127.0.0.1:16380/4'});await r.connect();for await(const key of r.scanIterator({MATCH:namespace+'*',COUNT:200}))await r.del(key);await r.quit();
console.log('PASS: real Stripe signature, tampering, mode/currency/amount/link/paid checks, one admission on replay, body-size limit.');process.exit(0);
