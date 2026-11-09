import Stripe from 'stripe';
import {redis} from '../_redis.js';
import {normalizeEmail,cleanUsername,validUsername} from '../../js/army/domain.js';
import {key,token,sha,clean} from './security.js';
import {put,get,admit} from './store.js';
export const mode=()=>process.env.LEGION_STRIPE_MODE||(process.env.VERCEL_ENV==='production'?'LIVE':'TEST');
export async function checkout(b){
 const email=normalizeEmail(b.email),name=clean(b.handle,40),url=process.env['LEGION_PAYMENT_LINK_'+mode()];if(!url)throw Error('payment_unavailable');
 if(name&&!validUsername(cleanUsername(name)))throw Error('handle');
 const ref='legion_'+token();await put('checkout:'+sha(ref),{email,name,created_at:new Date().toISOString()},7*86400);const u=new URL(url);if(u.protocol!=='https:'||u.hostname!=='buy.stripe.com')throw Error('payment_unavailable');u.searchParams.set('client_reference_id',ref);u.searchParams.set('prefilled_email',email);return {url:u.href};
}
export async function processPayment(event){
 const session=event.data?.object||{},live=mode()==='LIVE';if(event.livemode!==live||!['checkout.session.completed','checkout.session.async_payment_succeeded'].includes(event.type)||session.payment_status!=='paid'||session.amount_total!==100||session.currency!=='usd'||session.payment_link!==process.env['LEGION_PAYMENT_LINK_ID_'+mode()]||!session.payment_intent||!/^cs_(test_|live_)?[A-Za-z0-9]+$/.test(session.id||''))return {ignored:true};
 const pending=await get('checkout:'+sha(session.client_reference_id||''));if(!pending)return {ignored:true};
 const result=await admit({email:pending.email,handle:pending.name,name:pending.name,rank:'tiro',source:'paid',receipt:session.payment_intent});
 await put('paid-session:'+sha(session.id),{ok:true,rank:'tiro',name:result.user?.legion?.name||'soldier'},7*86400);return {ok:true,duplicate:!!result.duplicate};
}
export async function webhook(request){
 const secret=process.env['LEGION_STRIPE_WEBHOOK_SECRET_'+mode()];if(!secret)return Response.json({error:'unavailable'},{status:503});
 if(Number(request.headers.get('content-length'))>128000)return Response.json({error:'size'},{status:413});const reader=request.body?.getReader(),chunks=[];let size=0;if(reader){for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>128000){await reader.cancel();return Response.json({error:'size'},{status:413});}chunks.push(Buffer.from(value));}}const bytes=Buffer.concat(chunks);let e;try{e=Stripe.webhooks.constructEvent(bytes,request.headers.get('stripe-signature')||'',secret);}catch{return Response.json({error:'signature'},{status:400});}
 try{return Response.json(await processPayment(e));}catch{return Response.json({error:'retry'},{status:503});}
}
