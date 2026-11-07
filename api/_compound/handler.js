import {redis,pipeline} from '../_redis.js';
import {sameOrigin,authorized,login,limit,identity} from './security.js';
import * as store from './store.js';
import {clean,attribution,EVENTS,validVersion,timeBucket,RETENTION} from './model.js';
import {COMPOUND_LINKS,compoundDestination} from '../../js/compound-links.js';
import {donationLink} from './payments.js';
export default async function compound(req,res){
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 const q=req.query||{};
 try{
 if(req.method==='GET'){
  if(q.session==='1')return res.status(200).json({authorized:authorized(req,q.role==='admin'?'admin':'stats')});
  if(q.slug){
   const destination=compoundDestination(q.slug,q.c);if(!destination)return res.status(404).json({error:'missing'});
   const [source,medium]=COMPOUND_LINKS[q.slug];
   try{if(await limit(req,'short-links',120))await store.event('link_click',null,{source,medium,campaign:'compound-1000',term:q.slug,content:q.c},null);}catch{}
   res.setHeader('Location',destination);return res.status(302).end();
  }
  if(q.private==='1'){
   if(!authorized(req,q.role==='admin'?'admin':'stats'))return res.status(401).json({error:'sign in first'});
   return res.status(200).json({...await store.privateStats(q.version),admin:authorized(req,'admin')});
  }
  if(q.live==='1'){res.setHeader('Cache-Control','public, s-maxage=1');return res.status(200).json({poll:await store.get('live-poll')});}
  res.setHeader('Cache-Control','public, s-maxage=3, stale-while-revalidate=10');return res.status(200).json(await store.summary(q.version));
 }
 if(req.method!=='POST')return res.status(405).json({error:'method not allowed'});
 const apiAdmin=authorized(req,'admin')&&String(req.headers.authorization||'').startsWith('Bearer ');
 if((!sameOrigin(req)&&!apiAdmin)||!String(req.headers['content-type']).startsWith('application/json'))return res.status(403).json({error:'please use the page'});
 const b=typeof req.body==='string'?JSON.parse(req.body):req.body||{};
 if(Array.isArray(b)||JSON.stringify(b).length>20000)return res.status(413).json({error:'too much data'});
 if(!await limit(req,'all',150))return res.status(429).json({error:'take a breath. try again in a minute.'});
 if(!['login','publish','live_poll','hide_text','revolut','event','donate','watched','pick','battle','profile','prediction','transition','transition_tag','transition_text','vote','category','text','reaction','poll'].includes(b.action))throw Error('action');
 if(b.website)return res.status(400).json({error:'please leave the hidden field empty'});
 if(b.action==='login'){
  if(!await limit(req,'login',5))return res.status(429).json({error:'try again in a minute'});
  return login(res,b.role==='admin'?'admin':'stats',b.password)?res.status(200).json({ok:true}):res.status(401).json({error:'wrong password'});
 }
 if(b.action==='publish'||b.action==='live_poll'||b.action==='hide_text'||b.action==='revolut'){
  if(!authorized(req,'admin'))return res.status(401).json({error:'admin sign-in required'});
  if(b.action==='revolut')return res.status(200).json({revolut:await store.setRevolut(b)});
  if(b.action==='publish')return res.status(200).json({version:await store.publish(b)});
  if(b.action==='hide_text'){if(!/^[a-f0-9-]{36}$/.test(b.id||''))throw Error('text');if(!await store.hideText(b.id))return res.status(404).json({error:'missing'});return res.status(200).json({ok:true});}
  if(b.version!=='all'&&!await store.version(b.version))throw Error('version');return res.status(200).json({poll:await store.pushPoll(b.version,b)});
 }
 if(!/^[a-f0-9-]{36}$/.test(b.visit||''))delete b.visit;
 const tags=attribution(b.attribution),consented=(b.analytics===true||b.analytics==='session')&&req.headers['sec-gpc']!=='1'&&req.headers.dnt!=='1';
 const visitor=consented&&/^[a-f0-9-]{36}$/.test(b.visitor||'')?b.visitor:null;
 const v=await store.version(b.version);
 if(b.action==='event'){
  if(!EVENTS.includes(b.event))throw Error('event');
  if(['play','watch','dropoff'].includes(b.event)&&!v)throw Error('version');
  let name=b.event;
  if(name==='watch'){if(![25,50,75,100].includes(b.percent))throw Error('watch');name+=':'+b.percent;}
  if(name==='dropoff')name+=':'+Math.floor(timeBucket(b.t,v.duration)/5)*5;
  await store.event(name,v?.id,tags,visitor,b);return res.status(200).json({ok:true});
 }
 if(b.action==='donate'){if(!await limit(req,'checkout',10))return res.status(429).json({error:'try again shortly'});const method=b.method==='revolut'?'revolut':'stripe';let link;if(method==='revolut'){const url=(await store.get('revolut'))?.url||process.env.COMPOUND_REVOLUT_URL;if(!url)throw Error('revolut not connected yet');link={url};}else link=await donationLink(tags,{visitor,visit:visitor?b.visit:null,version:v?.id});await store.event('donation_click',v?.id,tags,visitor,{method,visit:b.visit});await store.event('donation_click_'+method,v?.id,tags,null);return res.status(200).json(link);}
 if(!await limit(req,'contributions',200,86400))return res.status(429).json({error:'enough chaos for today. come back tomorrow.'});
 const uid=identity(req,res);
 if(b.action==='watched'){if(!v||!Number.isFinite(b.percent)||b.percent<25||b.percent>100)throw Error('watch');return res.status(200).json(await store.watched(uid,v.id));}
 if(['pick','battle'].includes(b.action)){const result=await store.duel(uid,b);if(result.added)await store.event(b.action,b.winner,tags,visitor,b);return res.status(200).json(result);}
 if(b.action==='profile')return res.status(200).json({handle:await store.profile(uid,b.handle)});
 if(b.action==='prediction'){const result=await store.predict(uid,b);if(result.added)await store.event('prediction',v?.id,tags,visitor,{choice:b.win});return res.status(200).json(result);}
 if(!v&&b.action!=='text')throw Error('version');
 let result;
 if(['transition','transition_tag','transition_text'].includes(b.action)){if(b.action==='transition_text'&&!await limit(req,'text',3))return res.status(429).json({error:'three ideas per minute'});result=await store.transition(uid,v,b);}
 else if(['vote','category'].includes(b.action))result=await store.feedback(uid,v.id,b);
 else if(b.action==='text'){
  if(!await limit(req,'text',3))return res.status(429).json({error:'three ideas per minute. make them count.'});result=await store.saveText(uid,v?.id||'none',b.text);
 }else if(b.action==='reaction'){
  if(!await limit(req,'reactions',60))return res.status(429).json({error:'give that reaction a moment'});result=await store.reaction(uid,v.id,b.type,timeBucket(b.t,v.duration));
 }else if(b.action==='poll')result=await store.answer(uid,v.id,b.poll,b.option);
 else throw Error('action');
 if(result.added)await store.event(b.action,v?.id,tags,visitor,b);
 return res.status(200).json(result);
 }catch(error){const safe=['version','vote','category','timestamp','reaction','poll','poll expired','prediction','text','event','watch','handle','label','video','duration','cues','action','payments not connected yet','revolut not connected yet','revolut link','amount','slot','cutlist','transition','tag','battle','watch two cuts first'];return res.status(safe.includes(error.message)?400:503).json({error:safe.includes(error.message)?error.message:'the crow lost its connection. please try again.'});}
}
