import {authorized,sameOrigin,limited,key,sha} from './security.js';
import {rateLimit} from '../_privacy.js';
import * as senate from './senate.js';
export default async function handler(req,res){const q=req.query||{};res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Robots-Tag','noindex');try{
 if(req.method==='GET'){
  if(q.action==='click'){const p=await senate.profile(q.slug);if(!p||p.status!=='active')throw Error('missing');const link=q.slot==='cta'?p.content.cta:p.content.links[Number(q.slot)];if(!link?.url)throw Error('missing');await senate.count(req,p.slug,q.slot==='cta'?'cta':'link-'+q.slot);let target=link.url;const u=new URL(target);if(['compound.mov','www.compound.mov'].includes(u.hostname)){const go=new URL('/go/compound-'+(p.slug==='simon-lorenzo'?'simon':p.slug),'https://corvus.gent');go.searchParams.set('to',u.href);target=go.href;}res.setHeader('Location',target);return res.status(302).end();}
  if(q.action==='admin'){if(!await authorized(req))throw Error('unauthorized');return res.status(200).json({profiles:await senate.adminList()});}
  if(q.slug){const p=await senate.profile(q.slug);if(!p||p.status!=='active')throw Error('missing');return res.status(200).json(senate.publicProfile(p));}
  return res.status(200).json({profiles:await senate.publicList()});
 }
 if(req.method!=='POST')return res.status(405).end();if(!sameOrigin(req)||!String(req.headers['content-type']||'').startsWith('application/json'))throw Error('forbidden');let b;try{b=typeof req.body==='string'?JSON.parse(req.body):req.body}catch{}if(!b||Array.isArray(b)||JSON.stringify(b).length>(b.action==='upload'?4000000:16000))throw Error('fields');
 if(b.action==='view'){const p=await senate.profile(b.slug);if(p?.status==='active')await senate.count(req,b.slug,'view');return res.status(200).json({ok:true});}
 if(['lock','revoke_edit','revert'].includes(b.action)){if(!await authorized(req))throw Error('unauthorized');return res.status(200).json(await senate.manage(b.slug,b.action,b.value));}
 if(!await limited(req,'spotlight',100,3600))throw Error('rate');const p=await senate.editing(b.token);
 if(b.action==='load')return res.status(200).json({...senate.publicProfile(p),locked:p.locked});
 if(b.action==='upload'){if(!await rateLimit(key('spotlight-upload:'+sha(b.token)),10,3600))throw Error('rate');return res.status(200).json(await (await import('./senate-upload.js')).upload(p,b));}
 if(b.action==='publish'){if(!await rateLimit(key('spotlight-save:'+sha(b.token)),30,3600))throw Error('rate');return res.status(200).json(senate.publicProfile(await senate.publish(p,b.content,{expected:b.revision})));}
 throw Error('fields');
 }catch(e){const messages={image_size:'Use a JPG, PNG or WebP up to 5 MB.',image_format:'Use a still JPG, PNG or WebP photo.',missing:'This spotlight is not public yet.',unauthorized:'Sign in first.',forbidden:'Please use this page.',edit_token:'This private edit link is invalid or has been revoked.',locked:'Gabe has locked editing for this spotlight.',conflict:'This spotlight changed. Reload before publishing.',plain_text:'Use plain text within the character limits; no HTML.',headline:'Add a headline (up to 80 characters).',links:'Use up to four labelled HTTPS links.',url:'Use a full https:// URL.',image:'Upload your image through this editor.',fields:'Check the form fields.',rate:'Too many saves. Please retry later.'};return res.status(e.message==='missing'?404:e.message==='unauthorized'||e.message==='edit_token'?401:e.message==='forbidden'||e.message==='locked'?403:e.message==='conflict'?409:e.message==='rate'?429:messages[e.message]?400:503).json({error:messages[e.message]||'Could not save. Please retry.'});}}
