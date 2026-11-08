import {waitUntil} from '@vercel/functions';
import {authorized,login,logout,sameOrigin,limit,identity,analytics} from './security.js';
import {parseSlug,destination,attribution,EVENTS} from './model.js';
import * as store from './store.js';
import {DEADLINE} from '../../compound/v2/config.js';
const human=req=>!(/bot|crawler|spider|preview|curl|wget|headless|facebookexternalhit|slack|discord/i.test(req.headers['user-agent']||'')||/prefetch/i.test(req.headers.purpose||req.headers['sec-purpose']||''));
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 const q=req.query||{};
 try{
  if(q.short==='1'&&['GET','HEAD'].includes(req.method)){
   const target=destination(q.slug,q);if(!target)return res.status(404).json({error:'That video code is not valid.'});
   // Valid links keep redirecting even during a storage outage. Registration is checked on the landing page.
   if(req.method==='GET'&&human(req))waitUntil((async()=>{if(await limit(req,'redirect',120))if(await store.get(q.slug))await store.event('redirect',q.slug);})().catch(()=>{}));
   res.setHeader('Location',target);return res.status(302).end();
  }
  if(req.method==='GET'){
   if(q.session==='1')return res.status(200).json({authorized:authorized(req)});
   if(q.private==='1'){
    if(!authorized(req))return res.status(401).json({error:'Sign in first.'});
    return res.status(200).json({...await store.report(),feedback:await store.privateFeedback(),sync:{enabled:false,mode:'manual',note:'Oriane is not connected. Enter metrics from your own posts.'}});
   }
   res.setHeader('Cache-Control','public, max-age=0, s-maxage=15, stale-while-revalidate=120');
   return res.status(200).json({...await store.report(),deadline:DEADLINE,server_time:new Date().toISOString()});
  }
  if(req.method!=='POST')return res.status(405).json({error:'Use GET or POST.'});
  const apiAdmin=String(req.headers.authorization||'').startsWith('Bearer ')&&authorized(req);
  if((!sameOrigin(req)&&!apiAdmin)||!String(req.headers['content-type']||'').startsWith('application/json'))return res.status(403).json({error:'Please use the page.'});
  if(typeof req.body==='string'&&Buffer.byteLength(req.body)>12000)return res.status(413).json({error:'Please keep it short.'});
  let b;try{b=typeof req.body==='string'?JSON.parse(req.body):req.body;}catch{return res.status(400).json({error:'Invalid request.'});}
  if(!b||Array.isArray(b)||typeof b!=='object'||JSON.stringify(b).length>12000)return res.status(400).json({error:'Invalid request.'});
  if(!await limit(req,'all',150))return res.status(429).json({error:'Take a breath. Try again in a minute.'});
  if(b.action==='login'){if(!await limit(req,'login',5,300))return res.status(429).json({error:'Too many attempts. Try again in five minutes.'});return login(res,b.password)?res.status(200).json({ok:true}):res.status(401).json({error:'Wrong password.'});}
  if(b.action==='logout'){logout(res);return res.status(200).json({ok:true});}
  if(['add','edit','hide_feedback'].includes(b.action)){
   if(!authorized(req))return res.status(401).json({error:'Owner sign-in required.'});
   if(b.action==='hide_feedback'){await store.hideFeedback(b.id);return res.status(200).json({ok:true});}
   let row;try{row=await store.save(b.video,b.action==='edit');}catch(e){return res.status(400).json({error:e.message});}return res.status(200).json({video:row});
  }
  if(b.website)return res.status(400).json({error:'Please leave the hidden field empty.'});
  if(!parseSlug(b.slug)||!await store.get(b.slug))return res.status(404).json({error:'This video is not registered yet.'});
  const policy=analytics(b,req),tags=policy.enabled?attribution(b.attribution):{},detail={tags,visitor:policy.visitor};
  if(b.action==='event'){
   if(!['pageview','share_click','outbound_click','code_entered'].includes(b.type))return res.status(400).json({error:'Invalid event.'});
   if(!human(req))return res.status(200).json({ok:true,skipped:true});
   if(b.type==='code_entered'&&/^[A-Z]{2}-[A-Z]+[1-9]\d{0,3}$/.test(b.code||''))detail.code=b.code;
   await store.event(b.type,b.slug,detail);return res.status(200).json({ok:true});
  }
  if(b.action==='vote'){
   if(!['up','down'].includes(b.choice))return res.status(400).json({error:'Choose up or down.'});
   const result=await store.vote(identity(req,res),b.slug,b.choice);if(result.added)await store.event('vote',b.slug,detail);return res.status(200).json(result);
  }
  if(b.action==='feedback'){
   if(typeof b.text!=='string'||!b.text.trim()||b.text.length>1000||typeof(b.handle||'')!=='string'||(b.handle||'').length>80)return res.status(400).json({error:'Write a note (max 1,000 characters), and an optional handle (max 80).'});
   if(!await limit(req,'feedback',3))return res.status(429).json({error:'Three notes per minute. Make them count.'});
   const result=await store.feedback(identity(req,res),b.slug,b.text.trim().replace(/[\u0000-\u001f\u007f]/g,' '),(b.handle||'').trim());if(result.added)await store.event('feedback',b.slug,detail);return res.status(200).json(result);
  }
  return res.status(400).json({error:'Unknown action.'});
 }catch{return res.status(503).json({error:'The counters lost their connection. Your vote was not confirmed. Please retry.'});}
}
