import {readFile} from 'node:fs/promises';import {waitUntil} from '@vercel/functions';import {authorized,sameOrigin,limit} from '../_compound-v2/security.js';import {list,get,save,remove,publicRow} from './store.js';import {uploadPhoto,deletePhoto,cleanupPhotos} from './photos.js';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 try{
  const q=req.query||{};
  if(['GET','HEAD'].includes(req.method)&&(q.interviewPage||q.interviewCard))return await (await import('./share.js')).default(req,res);
  if(['GET','HEAD'].includes(req.method)){
   if(q.interviewAdmin==='1'){if(!authorized(req))return res.status(401).json({error:'Sign in first.'});return res.status(200).json({interviews:await list(),photos:!!process.env.BLOB_READ_WRITE_TOKEN});}
   const legacy=JSON.parse(await readFile(new URL('../../hack/3/interviews.json',import.meta.url),'utf8'));
   res.setHeader('Cache-Control','public, max-age=0, s-maxage=5, stale-while-revalidate=10');waitUntil(cleanupPhotos().catch(()=>{}));
   return res.status(200).json({interviews:[...(await list()).map(publicRow),...(legacy.interviews||[])]});
  }
  if(req.method!=='POST')return res.status(405).json({error:'Use GET or POST.'});
  if(!authorized(req))return res.status(401).json({error:'Sign in first.'});
  if(!sameOrigin(req)&&!String(req.headers.authorization||'').startsWith('Bearer '))return res.status(403).json({error:'Please use the form.'});
  if(!String(req.headers['content-type']||'').startsWith('application/json'))return res.status(415).json({error:'Use JSON.'});
  if(!await limit(req,'interview-edit',30))return res.status(429).json({error:'Take a moment and retry.'});
  const text=typeof req.body==='string'?req.body:JSON.stringify(req.body);if(!text||Buffer.byteLength(text)>2500000)return res.status(413).json({error:'Photo too large. Choose a smaller photo.'});
  let body;try{body=JSON.parse(text);}catch{return res.status(400).json({error:'Invalid form.'});}if(!body||typeof body!=='object'||Array.isArray(body))return res.status(400).json({error:'Invalid form.'});
  if(body.action==='delete'){const old=await remove(body.n,body.updated_at);if(old.photo_url)waitUntil(deletePhoto(old.photo_url).catch(()=>{}));return res.status(200).json({ok:true});}
  if(body.action!=='save')return res.status(400).json({error:'Unknown action.'});
  const {fields}=await import('./store.js');fields(body);if(body.n){const old=await get(body.n);if(!old||old.updated_at!==body.updated_at)return res.status(409).json({error:'This entry changed. Reload before saving.'});}
  let photo;try{if(body.photo){if(!process.env.BLOB_READ_WRITE_TOKEN)return res.status(503).json({error:'Photo storage is unavailable. Save without the photo, then add it later.'});photo=await uploadPhoto(body.photo);}const result=await save(body,{photo_url:photo,remove_photo:body.remove_photo===true});if(photo&&!result.created)waitUntil(deletePhoto(photo).catch(()=>{}));if(result.oldPhoto&&result.oldPhoto!==result.row.photo_url)waitUntil(deletePhoto(result.oldPhoto).catch(()=>{}));return res.status(200).json({interview:result.row});}catch(e){if(photo)waitUntil(deletePhoto(photo).catch(()=>{}));throw e;}
 }catch(e){const safe=/^(Fill in|Use a|Confirm that|Invalid interview|Reload the form|This entry changed|Interview not found|The interview registry|Choose a JPEG|This photo could)/.test(e.message);return res.status(safe?400:503).json({error:safe?e.message:'Could not save right now. Your form is kept; please retry.'});}
}
