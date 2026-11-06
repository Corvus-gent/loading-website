import crypto from 'node:crypto';
import process from 'node:process';
import {digest} from './_security.js';
import {armyDiscord} from './_discord.js';
import {DAY,TIERS,CONSUL_SEATS,activeTier,cleanUsername,validUsername,normalizeEmail} from '../../js/army/domain.js';

// Official schema: https://cdn.buymeacoffee.com/assets/integrations/bmc-webhooks-openapi.json
export function verifyBMC(raw,signature,secret){
 if(!secret||typeof signature!=='string'||! /^[a-f0-9]{64}$/i.test(signature))return false;
 const expected=crypto.createHmac('sha256',secret).update(raw).digest();
 return crypto.timingSafeEqual(expected,Buffer.from(signature,'hex'));
}
export function tierName(value){
 const name=String(value||'').trim().toLowerCase();
 return TIERS.slice(0,-1).find(t=>new RegExp('^'+t+'(?:\\s|\\(|$)').test(name))||null;
}
const iso=value=>Number.isFinite(Number(value))&&Number(value)>0?new Date(Number(value)*1000).toISOString():null;
export function bmcPayments(store){
 async function normalize(event){
  const d=event.data||{},type=String(event.type||'');
  if(!Number.isSafeInteger(event.event_id)||event.event_id<1||!Number.isFinite(event.created)||Math.abs(event.created*1000-store.now())>7*DAY*1000||!d||Array.isArray(d))throw Error('payload');
  if(!/^(donation|membership|extra_purchase|commission_order|wishlist_payment|recurring_donation)\.(created|updated|started|refunded|cancelled|paused)$/.test(type))throw Error('payload');
  if(event.live_mode!==true)return {test:true};
  const note=String(d.support_note||'').trim().slice(0,1000),exact=cleanUsername(note.replace(/^@|^corvus\s*:\s*/i,''));
  let username=validUsername(exact)?exact:null,account=username?await store.byName(username):null;
  if(!account?.verifiedAt){
   const candidates=[...new Set((note.match(/(?:^|\s)@([a-z][a-z0-9_-]{2,23})\b/ig)||[]).map(v=>v.trim().slice(1).toLowerCase()))];
   const found=(await Promise.all(candidates.slice(0,10).map(n=>store.byName(n)))).filter(u=>u?.verifiedAt);
   account=found.length===1?found[0]:null;if(account)username=account.username;
  }
  // A BMC email is transient: hash lookup against an existing verified account,
  // then discard it. Unknown payer identities and messages never reach Redis.
  let emailAccount=null;try{emailAccount=await store.byEmail(normalizeEmail(d.supporter_email));}catch{}
  if(emailAccount?.verifiedAt){if(account&&account.id!==emailAccount.id)account=null;else account=emailAccount;}
  const subscription=type.startsWith('membership.'),tier=subscription?tierName(d.membership_level_name):null;
  const amount=Number(d.amount),currency=String(d.currency||'').toUpperCase();
  if(!Number.isFinite(amount)||amount<0||amount>1e8||!/^[A-Z]{3}$/.test(currency))throw Error('payload');
  const state=type.endsWith('.refunded')||d.refunded===true||d.refunded==='true'?'refunded':type.endsWith('.cancelled')||d.status==='canceled'?'cancelled':type.endsWith('.paused')||d.status==='paused'?'paused':'active';
  const record={event:String(event.event_id),type,level:tier,amount,currency,date:iso(event.created),username:account?.username||username||null,uid:account?.id||null,
   state,until:subscription?iso(d.current_period_end):null,interval:d.duration_type==='year'?'year':'month',
   // Irreversible payment/subscription identifier needed for out-of-order events.
   object:d.id!=null?digest(type.split('.')[0]+':'+String(d.id)):null,
   coffees:type.startsWith('donation.')?Math.max(0,Math.min(10000,Math.floor(Number(d.coffee_count)||1))):0};
  // Senator is never inferred from an arbitrary $1000 gift: only an explicitly
  // named senator product or level qualifies; everything ambiguous is reviewed.
  if(!subscription&&state==='active'&&amount>=1000&&currency==='USD'&&Array.isArray(d.extras)&&d.extras.some(e=>tierName(e.title)==='senator'))record.level='senator';
  // Consul: only an explicitly named consul product of at least $10,000, and only while
  // a seat is free. A third buyer is left unlevelled so Gabe reviews and refunds by hand.
  if(!subscription&&state==='active'&&amount>=10000&&currency==='USD'&&Array.isArray(d.extras)&&d.extras.some(e=>tierName(e.title)==='consul')){
   const held=(await store.all()).filter(s=>s.membership?.tier==='consul'&&s.membership.state!=='refunded'&&s.id!==account?.id).length;
   record.level=held<CONSUL_SEATS?'consul':null;
  }
  return record;
 }
 async function accept(event){
  const p=await normalize(event);if(p.test)return {test:true};
  const k=store.key('bmc:event:'+p.event),receipt=store.key('bmc:seen:'+p.event);
  const added=Number(await store.run(['EVAL',`if redis.call('EXISTS',KEYS[1])==1 then return 0 end
local record=cjson.decode(ARGV[1]);if record.uid~=cjson.null then local user=redis.call('GET',KEYS[4]);if not user or cjson.decode(user).status=='deleting' then record.uid=cjson.null;record.username=cjson.null else redis.call('SADD',KEYS[5],KEYS[2]);redis.call('EXPIRE',KEYS[5],31708800) end end
redis.call('SET',KEYS[1],'1','EX',ARGV[3]);redis.call('SET',KEYS[2],cjson.encode(record),'EX',ARGV[4]);redis.call('ZADD',KEYS[3],ARGV[2],ARGV[5]);return 1`,5,receipt,k,store.key('bmc:pending'),store.key('u:'+(p.uid||'none')),store.key('owned:'+(p.uid||'none')),JSON.stringify(p),store.now(),400*DAY,30*DAY,p.event]));
  return {accepted:!!added,event:p.event};
 }
 async function processPayment(eventID){
  if(!/^\d{1,20}$/.test(String(eventID)))throw Error('payment');
  return store.lock('payment:'+eventID,async()=>{
   let p=await store.get('bmc:event:'+eventID);
   if(!p){await store.run(['ZREM',store.key('bmc:pending'),eventID]);return {missing:true};}
   let user=p.uid?await store.getUser(p.uid):p.username?await store.byName(p.username):null;
   if(!user?.verifiedAt||user.status==='deleting')user=null;
   // Count each underlying donation once, even if delivery ids change on retry.
   if(p.coffees&&p.object){
    await store.run(['EVAL',`local previous=tonumber(redis.call('GET',KEYS[1]) or '0');local target=tonumber(ARGV[1]);if ARGV[2]=='refunded' then target=-1 elseif previous==-1 then return 0 end;local delta=math.max(0,target)-math.max(0,previous);redis.call('SET',KEYS[1],target,'EX',ARGV[3]);redis.call('INCRBY',KEYS[2],delta);return delta`,2,store.key('bmc:coffee:'+p.object),store.key('bmc:coffees'),p.coffees,p.state,400*DAY]);
   }
   if(user){
    await store.lock(user.id,async()=>{
     const current=await store.getUser(user.id);if(!current||current.status==='deleting')return;
     p.uid=current.id;p.username=current.username;
     const last=current.payment;
     if(!last||p.date>=last.date){current.paid=p.state!=='refunded';current.payment={date:p.date,amount:p.amount,currency:p.currency};}
     const previous=current.membership,level=p.level||(previous?.object===p.object&&p.type.startsWith('membership.')?previous.tier:null);
     const order={active:0,paused:1,cancelled:2,refunded:3};
     if(level&&(!previous||p.date>previous.updated||p.date===previous.updated&&order[p.state]>=order[previous.state])){
      current.membership={tier:level,state:p.state,until:p.until||previous?.until||null,interval:p.interval,amount:p.amount,currency:p.currency,updated:p.date,object:p.object};
      current.expires=new Date(Math.max(Date.parse(current.expires),store.now()+365*DAY*1000)).toISOString();
     }
     await store.persist(current);await store.own(current.id,'bmc:event:'+eventID,p,365*DAY);
     if(p.object)await store.own(current.id,'bmc:owner:'+p.object,current.id,365*DAY);
    });
    await store.run(['ZREM',store.key('bmc:unmatched'),eventID]);
   }else{
    if(p.object){const uid=await store.get('bmc:owner:'+p.object);if(uid&&await store.getUser(uid)){p.uid=uid;await store.run(['SET',store.key('bmc:event:'+eventID),JSON.stringify(p),'EX',30*DAY]);await store.run(['ZADD',store.key('bmc:pending'),store.now(),eventID]);return {retry:true};}}
    await store.run(['ZADD',store.key('bmc:unmatched'),store.now(),eventID]);
   }
   await store.run(['ZREM',store.key('bmc:pending'),eventID]);
   await store.run(['DEL',store.key('public')]);
   if(user&&process.env.DISCORD_BOT_TOKEN){try{await armyDiscord(store).sync(await store.getUser(user.id));}catch{/* The periodic reconciliation retries role delivery. */}}
   return {matched:!!user};
  });
 }
 async function drain(){const ids=await store.run(['ZRANGE',store.key('bmc:pending'),0,99]);let matched=0;for(const id of ids){const r=await processPayment(id);if(r.matched)matched++;}return {processed:ids.length,matched};}
 async function unmatched(){const ids=await store.run(['ZREVRANGE',store.key('bmc:unmatched'),0,99]);const rows=[];for(const id of ids){const p=await store.get('bmc:event:'+id);if(p)rows.push({event:p.event,type:p.type,level:p.level,amount:p.amount,currency:p.currency,date:p.date,username:p.username});else await store.run(['ZREM',store.key('bmc:unmatched'),id]);}return rows;}
 async function link(eventID,username){
  const user=await store.byName(cleanUsername(username)),p=await store.get('bmc:event:'+String(eventID));if(!user?.verifiedAt||!p)throw Error('missing');
  if(p.uid&&p.uid!==user.id)throw Error('payment');p.uid=user.id;p.username=user.username;
  await store.run(['SET',store.key('bmc:event:'+p.event),JSON.stringify(p),'EX',30*DAY]);return processPayment(p.event);
 }
 return {normalize,accept,process:processPayment,drain,unmatched,link};
}
export const linkToll=(store,event,username)=>bmcPayments(store).link(event,username);
