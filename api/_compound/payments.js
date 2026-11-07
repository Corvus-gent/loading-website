import crypto from 'node:crypto';
import Stripe from 'stripe';
import {redis,pipeline} from '../_redis.js';
import {key,event} from './store.js';
import {attribution,FUND_DEADLINE} from './model.js';
export const paymentMode=()=>process.env.COMPOUND_STRIPE_MODE||(process.env.VERCEL_ENV==='production'?'live':'test');
export async function donationLink(raw,journey={}){
 const mode=paymentMode(),url=process.env[mode==='live'?'COMPOUND_PAYMENT_LINK_LIVE':'COMPOUND_PAYMENT_LINK_TEST'];
 if(!url)throw Error('payments not connected yet');
 const link=new URL(url);if(link.protocol!=='https:'||link.hostname!=='buy.stripe.com')throw Error('payment configuration');
 const ref='compound_'+crypto.randomBytes(16).toString('hex'),tags=attribution(raw);
 await redis(['SET',key('checkout',ref),JSON.stringify({...tags,visitor:journey.visitor||null,visit:journey.visit||null,version:journey.version||null}),'EX',7*86400]);
 link.searchParams.set('client_reference_id',ref);return{url:link.href,test:mode==='test'};
}
export async function processStripeEvent(e){
 const mode=paymentMode();if(Boolean(e.livemode)!==(mode==='live'))return{ignored:true};
 const s=e.data?.object||{};
 if(['checkout.session.completed','checkout.session.async_payment_succeeded'].includes(e.type)){
  const expected=process.env[mode==='live'?'COMPOUND_PAYMENT_LINK_ID_LIVE':'COMPOUND_PAYMENT_LINK_ID_TEST'];
  if(!expected||s.payment_link!==expected||s.payment_status!=='paid'||s.currency!=='eur'||!Number.isInteger(s.amount_total)||s.amount_total<100||s.amount_total>1000000||!s.payment_intent)return{ignored:true};
  const tags=JSON.parse(await redis(['GET',key('checkout',s.client_reference_id||'none')])||'{}'),source=tags.source||'direct';
  const fund=Number(e.created)*1000<=Date.parse(FUND_DEADLINE)?key('fund',mode):key('fund-late',mode);
  const data={amount:s.amount_total,refunded:0,source,fund,tags};
  const script=`if not redis.call('SET',KEYS[1],ARGV[1],'NX','EX',31536000) then return 0 end;redis.call('INCRBY',KEYS[2],ARGV[2]);redis.call('HINCRBY',KEYS[3],ARGV[3],ARGV[2]);redis.call('HINCRBY',KEYS[3],ARGV[4],1);return 1`;
  const added=await redis(['EVAL',script,3,key('payment',mode,s.payment_intent),fund,key('donation-sources',mode),JSON.stringify(data),s.amount_total,source+':cents',source+':payments']);
  if(added)await event('donation_success',tags.version,tags,tags.visitor,{method:'stripe',amount:s.amount_total,visit:tags.visit});
  return{added:!!added};
 }
 if(e.type==='charge.refunded'&&s.payment_intent&&Number.isInteger(s.amount_refunded)){
  const script=`local raw=redis.call('GET',KEYS[1]);if not raw then return 0 end;local r=cjson.decode(raw);local target=math.min(r.amount,tonumber(ARGV[1]));local diff=target-r.refunded;if diff<=0 then return 0 end;r.refunded=target;redis.call('SET',KEYS[1],cjson.encode(r),'KEEPTTL');redis.call('DECRBY',r.fund,diff);redis.call('HINCRBY',KEYS[2],r.source..':cents',-diff);return cjson.encode({amount=diff,tags=r.tags})`;
  const raw=await redis(['EVAL',script,2,key('payment',mode,s.payment_intent),key('donation-sources',mode),s.amount_refunded]);if(raw){const refund=JSON.parse(raw);await event('donation_refund',refund.tags?.version,refund.tags,refund.tags?.visitor,{method:'stripe',amount:refund.amount,visit:refund.tags?.visit});}return{refunded:!!raw};
 }
 return{ignored:true};
}
export async function stripeWebhook(request){
 const mode=paymentMode(),secret=process.env[mode==='live'?'STRIPE_WEBHOOK_SECRET_LIVE':'STRIPE_WEBHOOK_SECRET_TEST'];
 if(!secret)return Response.json({error:'not configured'},{status:503});
 const chunks=[];let size=0;const reader=request.body?.getReader();
 if(reader)for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>128000){await reader.cancel();return new Response(null,{status:413});}chunks.push(Buffer.from(value));}
 let e;try{e=Stripe.webhooks.constructEvent(Buffer.concat(chunks),request.headers.get('stripe-signature')||'',secret);}catch{return Response.json({error:'invalid signature'},{status:400});}
 try{return Response.json(await processStripeEvent(e),{headers:{'Cache-Control':'no-store'}});}catch{return Response.json({error:'temporarily unavailable'},{status:503});}
}
