import {latestReport,runReport} from './reports.js';
import {equal} from '../_compound/security.js';
import {winner,selectWinner} from './push.js';
import {resolveCode} from './codes.js';
import {markPosted} from './uploads.js';
import {uploadQueue} from '../../compound/v2/upload-queue.js';
import {waitUntil} from '@vercel/functions';
import {authorized,login,logout,sameOrigin,limit,identity,analytics} from './security.js';
import {parseSlug,destination,attribution,EVENTS} from './model.js';
import * as store from './store.js';
import {configured,syncIfDue,syncStatus} from './sync.js';
import {DEADLINE,parseCode,videoPath} from '../../compound/v2/config.js';
const human=req=>!(/bot|crawler|spider|preview|curl|wget|headless|facebookexternalhit|slack|discord/i.test(req.headers['user-agent']||'')||/prefetch/i.test(req.headers.purpose||req.headers['sec-purpose']||''));
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 const q=req.query||{};
 if(q.interviews==='1'||q.interviewAdmin==='1'||q.interviewPage||q.interviewCard)return (await import('../_interviews/handler.js')).default(req,res);
 try{
  if(q.reportJob==='1'&&req.method==='GET'){const owner=authorized(req),cron=!!process.env.CRON_SECRET&&equal(String(req.headers.authorization||''),'Bearer '+process.env.CRON_SECRET);if(!owner&&!cron)return res.status(401).json({error:'Owner or scheduler access required.'});return res.status(200).json(await runReport({force:owner&&q.force==='1',trigger:owner?'owner':'cron'}));}
  if(q.report==='1'&&req.method==='GET'){if(!authorized(req))return res.status(401).json({error:'Sign in first.'});return res.status(200).json(await latestReport());}
  if(q.codeLink==='1'&&['GET','HEAD'].includes(req.method)){
   const result=resolveCode(q.code,await store.videos(),q,'url');
   if(req.method==='GET'&&human(req)){if(!await limit(req,'code',120))return res.status(429).json({error:'Please retry in a minute.'});await store.event('code_entered','code:'+result.code,{code:result.code,source:'url',lang:result.parsed?.lang||''});}
   res.setHeader('Location',result.destination);return res.status(302).end();
  }
  if(q.short==='1'&&['GET','HEAD'].includes(req.method)){
   const target=destination(q.slug,q);if(!target)return res.status(404).json({error:'That video code is not valid.'});
   // Valid links keep redirecting even during a storage outage. Registration is checked on the landing page.
   if(req.method==='GET'&&human(req))waitUntil((async()=>{if(await limit(req,'redirect',120))if(await store.get(q.slug))await store.event('redirect',q.slug);})().catch(()=>{}));
   res.setHeader('Location',target);return res.status(302).end();
  }
  if(req.method==='GET'){
   if(q.push==='1'){res.setHeader('Cache-Control','public, max-age=0, s-maxage=15, stale-while-revalidate=60');return res.status(200).json(await winner());}
   if(q.session==='1')return res.status(200).json({authorized:authorized(req)});
   if(q.private==='1'){
    if(!authorized(req))return res.status(401).json({error:'Sign in first.'});
    if(configured())waitUntil(syncIfDue().catch(()=>{}));
    const report=await store.report({privateData:true});return res.status(200).json({...report,upload_queue:uploadQueue(report.videos),feedback:await store.privateFeedback(),sync:await syncStatus(),push:await winner(),briefing:await latestReport()});
   }
   if(configured())waitUntil(syncIfDue().catch(()=>{}));
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
  if(['add','edit','hide_feedback','mark_posted','set_winner'].includes(b.action)){
   if(!authorized(req))return res.status(401).json({error:'Owner sign-in required.'});
   if(b.action==='set_winner'){try{return res.status(200).json(await selectWinner(b.slug));}catch(e){return res.status(400).json({error:e.message});}}
   if(b.action==='hide_feedback'){await store.hideFeedback(b.id);return res.status(200).json({ok:true});}
   let row;try{row=b.action==='mark_posted'?await markPosted(b.slug,b.post_url):await store.save(b.video,b.action==='edit');}catch(e){return res.status(400).json({error:e.message});}return res.status(200).json({video:row});
  }
  if(b.website)return res.status(400).json({error:'Please leave the hidden field empty.'});
  if(b.action==='push_event'){
   if(!['view','watch','comment','share'].includes(b.type))return res.status(400).json({error:'Invalid action.'});
   if(!human(req))return res.status(200).json({ok:true,skipped:true});
   const picked=(await winner()).winner;if(!picked||picked.slug!==b.slug)return res.status(409).json({error:'The selected post changed. Refresh the page.'});
   const policy=analytics(b,req);await store.event('push_'+b.type,picked.slug||'push',{tags:policy.enabled?{...attribution(b.attribution),utm_content:'push'}:{},visitor:policy.visitor});return res.status(200).json({ok:true});
  }
  if(b.action==='code'){
   const source=b.source==='url'?'url':'typed',result=resolveCode(b.code,await store.videos(),b.query||{},source),policy=analytics(b,req);
   await store.event('code_entered','code:'+result.code,{tags:policy.enabled?attribution(b.attribution):{},visitor:policy.visitor,code:result.code,source,lang:result.parsed?.lang||''});
   if(!result.parsed)return res.status(400).json({error:'Code not found yet, pick a version below'});
   return res.status(200).json({destination:result.destination,matches:result.matches});
  }

  if(!parseSlug(b.slug)||!await store.get(b.slug))return res.status(404).json({error:'This video is not registered yet.'});
  const policy=analytics(b,req),tags=policy.enabled?attribution(b.attribution):{},detail={tags,visitor:policy.visitor};
  if(b.action==='event'){
   if(!['pageview','share_click','outbound_click','code_entered'].includes(b.type))return res.status(400).json({error:'Invalid event.'});
   if(!human(req))return res.status(200).json({ok:true,skipped:true});
   if(b.type==='code_entered'&&parseCode(b.code))detail.code=parseCode(b.code).code;
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
