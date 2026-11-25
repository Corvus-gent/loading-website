import crypto from 'node:crypto';
import {readFileSync} from 'node:fs';
import {redis} from '../_redis.js';
import {SCHEMA_VERSION,validateLead,makeOffer,draftLink,validHttps} from './model/schema.js';
import {assess,rankByValue} from './model/score.js';
const PAGE=readFileSync(new URL('./page.html',import.meta.url),'utf8');
const APP=readFileSync(new URL('./app.js',import.meta.url),'utf8');
const STYLE=readFileSync(new URL('./style.css',import.meta.url),'utf8');
const OFFERS=JSON.parse(readFileSync(new URL('../../config/offers.json',import.meta.url),'utf8')).tiers;
const SEED=JSON.parse(readFileSync(new URL('../../data/warm-contacts.json',import.meta.url),'utf8'));
const BASE='/scraper/fiverr-leads',KEY='leadhunter:v1:';
const hash=s=>crypto.createHash('sha256').update(String(s)).digest();
const equal=(a,b)=>crypto.timingSafeEqual(hash(a),hash(b));
const html=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function failureKind(error){const m=String(error?.message||'');if(/temporarily paused/i.test(m))return 'storage-maintenance';if(/encrypted transport/i.test(m))return 'storage-tls-required';if(/certificate|SSL|TLS/i.test(m))return 'storage-tls-error';if(/WRONGPASS|NOAUTH|NOPERM/i.test(m))return 'storage-auth-error';if(/timeout|timed out/i.test(m))return 'storage-timeout';return /^[A-Z_]{3,40}$/.test(error?.code||'')?error.code:'request-error';}
export function safeFailureMessage(error,env){let message=String(error?.message||'');for(const raw of Object.values(env)){if(typeof raw!=='string'||raw.length<8)continue;message=message.replaceAll(raw,'[redacted]');try{const u=new URL(raw);if(u.password)message=message.replaceAll(u.password,'[redacted]');}catch{}}return message.replace(/(?:https?|rediss?):\/\/\S+/g,'[endpoint]').replace(/[A-Za-z0-9_-]{32,}/g,'[redacted]').slice(0,180);}
// Browsers send `Origin: null` on POSTs from a page with a no-referrer policy (form logins included),
// so an exact Origin match alone locked everyone out. Accept a matching Origin, or else the
// browser-set Sec-Fetch-Site: same-origin. Anything cross-site or unlabelled stays blocked.
export function sameOrigin(req){const o=req.headers.origin,site=req.headers['sec-fetch-site'];if(o&&o!=='null')return o===`https://${req.headers.host}`&&(!site||site==='same-origin');return site==='same-origin';}
export function session(password,now=Date.now()){const token=`${now+12*3600000}.${crypto.randomBytes(16).toString('hex')}`;return token+'.'+crypto.createHmac('sha256','leadhunter:'+password).update(token).digest('hex');}
export function authenticated(req,password,now=Date.now()){
 const value=String(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('leadhunter='))?.slice(11)||'';
 const parts=value.split('.');if(parts.length!==3||!/^\d{13}$/.test(parts[0])||Number(parts[0])<=now||Number(parts[0])>now+12*3600000||! /^[a-f0-9]{32}$/.test(parts[1]))return false;
 const mac=crypto.createHmac('sha256','leadhunter:'+password).update(parts.slice(0,2).join('.')).digest('hex');return equal(mac,parts[2]);
}
const login=message=>`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>leadhunter · private</title><style>${STYLE}</style><body><main class="login"><p class="eyebrow">corvus / private tools</p><h1>leadhunter<span>.</span></h1><p>One good conversation. One website to ship.</p><form action="${BASE}/login" method="post"><label>Password<input name="password" type="password" autocomplete="current-password" required maxlength="256"></label><button>Unlock</button><p role="alert">${html(message)}</p></form></main></body></html>`;
function body(req){if(typeof req.body==='object'&&req.body!==null)return req.body;const raw=String(req.body||'');if(raw.length>2000000)throw Error('Payload too large');return String(req.headers['content-type']).includes('application/x-www-form-urlencoded')?Object.fromEntries(new URLSearchParams(raw)):JSON.parse(raw||'{}');}
const fields=['name','contact','need','budget_min','budget_max','currency','urgency','warm','next_action','status'];
export function createHandler({db=redis,env=process.env,clock=Date.now}={}) {
 const setting=async()=>JSON.parse(await db(['GET',KEY+'settings'])||'{}');
 const snapshot=async()=>JSON.parse(await db(['GET',KEY+'snapshot'])||'{"leads":[],"statuses":[],"generated_at":null}');
 async function records(){const rows=await db(['HGETALL',KEY+'records']);if(Array.isArray(rows)){const out=[];for(let i=1;i<rows.length;i+=2)out.push(JSON.parse(rows[i]));return out;}return Object.values(rows||{}).map(x=>JSON.parse(x));}
 async function load(){for(const row of SEED.contacts){const lead=validateLead({...row,source:'warm',warm:true});await db(['HSETNX',KEY+'records',lead.id,JSON.stringify(lead)]);}const snap=await snapshot(),settings=await setting(),overrides=await records();const cfg={cal:validHttps(settings.cal||env.CAL_LINK||snap.config?.cal),revolut:validHttps(settings.revolut||env.REVOLUT_LINK||snap.config?.revolut)};
 const map=new Map((snap.leads||[]).filter(x=>!x.expires_at||Date.parse(x.expires_at)>clock()).map(x=>[x.id,x]));for(const row of overrides)if(row.source==='warm'||row.warm||row.status!=='new'||map.has(row.id))map.set(row.id,row);
 const leads=rankByValue([...map.values()].map(raw=>{const row=validateLead(raw);row.updated_at=raw.updated_at;row.assessment=assess(row,OFFERS,snap.fx,clock());row.score=row.assessment.score;const b=row.assessment.budget_eur;row.offer=makeOffer(b?{...row,budget_min:b.min,budget_max:b.max,currency:'EUR'}:row,OFFERS,cfg.revolut);const o=raw.outreach;
 const body=o?.body?o.body.replaceAll('{CAL_LINK}',cfg.cal||'{CAL_LINK}').replaceAll('{REVOLUT_LINK}',cfg.revolut||'{REVOLUT_LINK}'):`Hey ${row.name}, I can help with ${row.need}. I'm Gabe. Want to talk it through for 10 minutes? ${cfg.cal||'{CAL_LINK}'}`;
 row.outreach={body,subject:'Your website',url:cfg.cal&&cfg.revolut?draftLink(row.contact,row.contact_kind||'',body):'',ready:Boolean(cfg.cal&&cfg.revolut&&draftLink(row.contact,row.contact_kind||'',body)),missing:[!cfg.cal&&'CAL_LINK',!cfg.revolut&&'REVOLUT_LINK'].filter(Boolean)};
 row.offer_draft=cfg.revolut?draftLink(row.contact,row.contact_kind||'',row.offer.text):'';return row;}));return {...snap,schema_version:SCHEMA_VERSION,leads,config:cfg};}
 return async(req,res)=>{
  res.setHeader('Cache-Control','private, no-store');res.setHeader('Vercel-CDN-Cache-Control','no-store');res.setHeader('X-Robots-Tag','noindex, nofollow, noarchive');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('X-Frame-Options','DENY');res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'self'; frame-ancestors 'none'");
  const action=String(req.query?.leadsAction||'page'),method=req.method,password=env.LEADS_PASSWORD;
  const json=(code,data)=>res.status(code).json(data),send=(code,type,data)=>{res.setHeader('Content-Type',type+'; charset=utf-8');return res.status(code).send(data);};
  if(!password||password.length<16)return send(503,'text/html',login('Private access is being configured.'));
  try {
   if(action==='ingest'){
    if(method!=='POST')return json(405,{error:'POST required'});
    if(!env.LEADS_INGEST_TOKEN||!equal(req.headers.authorization,'Bearer '+env.LEADS_INGEST_TOKEN))return json(401,{error:'Unauthorized'});
    const incoming=body(req);if(incoming.schema_version!==SCHEMA_VERSION||!Array.isArray(incoming.leads)||incoming.leads.length>500||!Array.isArray(incoming.statuses)||incoming.statuses.length>12||!Number.isFinite(Date.parse(incoming.generated_at))||Math.abs(clock()-Date.parse(incoming.generated_at))>3600000)return json(400,{error:'Invalid v1 snapshot'});
    const prior=await snapshot();if(Date.parse(prior.generated_at||0)>Date.parse(incoming.generated_at))return json(409,{error:'Stale snapshot'});
    const map=new Map((prior.leads||[]).map(x=>[x.id,x]));
    for(const raw of incoming.leads){if(raw.source==='warm'||raw.warm)throw Error('Runner cannot overwrite warm contacts');const row=validateLead(raw);row.expires_at=new Date(Math.min(Date.parse(row.expires_at)||clock()+86400000,clock()+86400000)).toISOString();row.first_seen_at=map.get(row.id)?.first_seen_at||row.first_seen_at;row.outreach=raw.outreach;map.set(row.id,row);}
    const next={schema_version:SCHEMA_VERSION,generated_at:incoming.generated_at,scanned:Math.max(0,Number(incoming.scanned)||0),fx:incoming.fx&&typeof incoming.fx==='object'?incoming.fx:null,config:{cal:validHttps(incoming.config?.cal),revolut:validHttps(incoming.config?.revolut)},statuses:incoming.statuses.map(s=>({source:String(s.source).slice(0,30),state:String(s.state).slice(0,20),detail:String(s.detail).slice(0,500),found:Math.max(0,Number(s.found)||0),checked_at:incoming.generated_at})),leads:[...map.values()].filter(x=>Date.parse(x.expires_at)>clock()).slice(0,500)};
    await db(['SET',KEY+'snapshot',JSON.stringify(next),'EX','108000']);return json(200,{ok:true,count:next.leads.length});
   }
   if(action==='login'&&method==='POST'){
    if(!sameOrigin(req))return json(403,{error:'Same-origin login required'});
    const ip=String(req.headers['x-forwarded-for']||'unknown').split(',')[0];const key=KEY+'login:'+crypto.createHmac('sha256',password).update(ip).digest('hex');
    const count=Number(await db(['EVAL',"local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],900) end; return n",'1',key]));
    if(count>10)return send(429,'text/html',login('Too many attempts. Try again in 15 minutes.'));
    if(!equal(body(req).password,password))return send(401,'text/html',login('That password did not match.'));
    res.setHeader('Set-Cookie',`leadhunter=${session(password,clock())}; HttpOnly; Secure; SameSite=Strict; Path=${BASE}; Max-Age=43200`);res.setHeader('Location',BASE);return res.status(303).end();
   }
   if(!authenticated(req,password,clock()))return action==='page'?send(200,'text/html',login('')):json(401,{error:'Unlock leadhunter first'});
   if(method==='GET'){
    if(action==='page')return send(200,'text/html',PAGE);
    if(action==='app.js')return send(200,'text/javascript',APP);
    if(action==='style.css')return send(200,'text/css',STYLE);
    if(action==='data.json')return json(200,await load());
    return json(404,{error:'Not found'});
   }
   if(method!=='POST')return json(405,{error:'Method not allowed'});
   if(!sameOrigin(req))return json(403,{error:'Same-origin request required'});
   if(action==='logout'){res.setHeader('Set-Cookie',`leadhunter=; HttpOnly; Secure; SameSite=Strict; Path=${BASE}; Max-Age=0`);res.setHeader('Location',BASE);return res.status(303).end();}
   const input=body(req);
   if(action==='settings'){const config={cal:validHttps(input.cal),revolut:validHttps(input.revolut)};if((input.cal&&!config.cal)||(input.revolut&&!config.revolut))throw Error('Use full HTTPS links');await db(['SET',KEY+'settings',JSON.stringify(config)]);return json(200,{ok:true});}
   if(action==='delete'){
    const row=(await records()).find(x=>x.id===input.id);if(!row||row.source!=='warm')return json(404,{error:'Warm contact not found'});
    if(Number(input.revision)!==row.revision)return json(409,{error:'This contact changed. Refresh before deleting.'});
    const script="local old=redis.call('HGET',KEYS[1],ARGV[1]); if not old or (cjson.decode(old).revision or 0)~=tonumber(ARGV[2]) then return 0 end; redis.call('HDEL',KEYS[1],ARGV[1]); return 1";
    const deleted=await db(['EVAL',script,'1',KEY+'records',row.id,String(row.revision)]);return json(deleted?200:409,{ok:Boolean(deleted)});
   }
   if(action==='save'){
    const all=await load();const existing=all.leads.find(x=>x.id===input.id);if(input.id&&!existing)return json(404,{error:'Lead expired or not found'});
    const changes=Object.fromEntries(fields.filter(k=>Object.hasOwn(input,k)).map(k=>[k,input[k]]));
    const next=validateLead({...existing,...changes,id:existing?.id||crypto.randomUUID(),source:existing?.source||'warm',warm:existing?changes.warm??existing.warm:true,status:changes.status||existing?.status||'new',urgency:changes.urgency||existing?.urgency||'unknown',revision:(existing?.revision||0)+1});
    if(!next.contact)throw Error('Add an email, WhatsApp number or social handle');
    const previousRevision=existing?.revision||0;if(existing&&Number(input.revision)!==previousRevision)return json(409,{error:'This lead changed. Refresh before saving.'});
    const script="local old=redis.call('HGET',KEYS[1],ARGV[1]); if old and (cjson.decode(old).revision or 0)~=tonumber(ARGV[2]) then return 0 end; redis.call('HSET',KEYS[1],ARGV[1],ARGV[3]); return 1";
    if(!Number(await db(['EVAL',script,'1',KEY+'records',next.id,String(previousRevision),JSON.stringify(next)])))return json(409,{error:'This lead changed. Refresh before saving.'});
    return json(200,{ok:true,id:next.id});
   }
   return json(404,{error:'Not found'});
  }catch(error){if(/Invalid|Name and|Budget|Use |Add an|Runner cannot|Payload/.test(error.message))return json(400,{error:error.message});console.error('leadhunter request failed',action,error.name,failureKind(error),safeFailureMessage(error,env));return json(503,{error:'Could not save or load right now. Your last saved data is unchanged.'});}
 };
}
export default createHandler();
