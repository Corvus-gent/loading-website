import crypto from 'node:crypto';
import sharp from 'sharp';
import {dailyIPHash,rateLimit} from './_privacy.js';

export const config={api:{bodyParser:{sizeLimit:'3mb'}}};
const clean=(value,max)=>typeof value==='string'?value.trim().replace(/[\x00-\x1f\x7f]/g,' ').slice(0,max):'';
export function createHandler({send=fetch,limit=rateLimit,ip=dailyIPHash,mailKey=()=>process.env.RESEND_API_KEY}={}){
 return async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'Use the upload form.'});}
  const origins=['https://corvus.gent','https://www.corvus.gent',...['VERCEL_URL','VERCEL_BRANCH_URL'].map(k=>process.env[k]&&'https://'+process.env[k])];
  if(!origins.includes(req.headers.origin)||!String(req.headers['content-type']||'').startsWith('application/json'))return res.status(403).json({error:'Please send your logo from corvus.gent/logo.'});
  let b;try{b=typeof req.body==='string'?JSON.parse(req.body):req.body;}catch{}
  if(!b||typeof b!=='object'||Array.isArray(b))return res.status(400).json({error:'Invalid submission.'});
  if(b.website)return res.status(400).json({error:'Please reload and try again.'});
  const name=clean(b.name,80)||'A fellow crow',email=clean(b.email,160),message=clean(b.message,1200);
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return res.status(400).json({error:'Enter an email so Gabe can reply.'});
  if(typeof b.image!=='string'||b.image.length>2800000||!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(b.image))return res.status(400).json({error:'Choose a PNG, JPG or WebP under 2 MB.'});
  const bytes=Buffer.from(b.image.slice(b.image.indexOf(',')+1),'base64');
  if(!bytes.length||bytes.length>2*1024*1024)return res.status(413).json({error:'Keep your logo under 2 MB.'});
  if(!mailKey())return res.status(503).json({error:'Uploads are temporarily unavailable. Your file has not been sent. Try again later.'});
  try{
   if(!await limit('logo-submit:hour:'+ip(req,'logo-submit'),5,3600)||!await limit('logo-submit:global',60,86400))return res.status(429).json({error:'Too many submissions. Please try again later.'});
   let image;try{const source=sharp(bytes,{limitInputPixels:20000000,animated:false});const metadata=await source.metadata();if(!['png','jpeg','webp'].includes(metadata.format)||(metadata.pages||1)>1)throw Error();image=await source.rotate().resize({width:2048,height:2048,fit:'inside',withoutEnlargement:true}).png().toBuffer();}catch{return res.status(400).json({error:'That image could not be read. Try another PNG, JPG or WebP.'});}
   const id=crypto.createHash('sha256').update(image).update(email).update(name).update(message).digest('hex');
   const response=await send('https://api.resend.com/emails',{method:'POST',redirect:'error',headers:{Authorization:'Bearer '+mailKey(),'Content-Type':'application/json','Idempotency-Key':'logo-submission-'+id},signal:AbortSignal.timeout(12000),body:JSON.stringify({from:'Corvus <login@corvus.gent>',to:['gabriel@corvus.gent'],reply_to:email,subject:'New Corvus logo submission · '+name,text:['Someone thinks they can outdo you.','',name+' <'+email+'>','',message||'(No note attached.)','','Submitted privately from https://corvus.gent/logo'].join('\n'),attachments:[{filename:'corvus-logo-submission.png',content:image.toString('base64')}]})});
   if(!response.ok)throw Error('mail');
   return res.status(200).json({ok:true});
  }catch{return res.status(503).json({error:'Could not send your logo. Please try again; your file is still selected.'});}
 };
}
export default createHandler();
