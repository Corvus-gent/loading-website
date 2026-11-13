import assert from 'node:assert/strict';
import {PAYMENT_URL} from '../../js/site/action-config.js';
import {paymentURL} from '../../api/_legion/payments.js';
const keys=['LEGION_STRIPE_MODE','LEGION_PAYMENT_LINK_LIVE','LEGION_PAYMENT_LINK_TEST'];
const saved=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
try{
 process.env.LEGION_PAYMENT_LINK_LIVE='https://buy.stripe.com/live_fixture';
 process.env.LEGION_PAYMENT_LINK_TEST='https://buy.stripe.com/test_fixture';
 process.env.LEGION_STRIPE_MODE='LIVE';
 assert.equal(paymentURL(''),process.env.LEGION_PAYMENT_LINK_LIVE);
 assert.equal(paymentURL('https://buy.stripe.com/new_fixture'),'https://buy.stripe.com/new_fixture');
 assert.equal(paymentURL(),PAYMENT_URL||process.env.LEGION_PAYMENT_LINK_LIVE);
 process.env.LEGION_STRIPE_MODE='TEST';
 assert.equal(paymentURL('https://buy.stripe.com/new_fixture'),process.env.LEGION_PAYMENT_LINK_TEST);
 console.log('Payment URL: production override, legacy fallback and isolated test checkout passed.');
}finally{for(const k of keys)if(saved[k]===undefined)delete process.env[k];else process.env[k]=saved[k];}
