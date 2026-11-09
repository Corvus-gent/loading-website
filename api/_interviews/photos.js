import sharp from 'sharp';import crypto from 'node:crypto';import {put,del} from '@vercel/blob';import {redis} from '../_redis.js';import {key,RETENTION} from './store.js';
export async function uploadPhoto(data,{putBlob=put}={}){
 if(typeof data!=='string'||data.length>2400000||!/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(data))throw Error('Choose a JPEG, PNG or WebP photo under 1.7 MB.');
 let image;try{image=await sharp(Buffer.from(data.slice(data.indexOf(',')+1),'base64'),{limitInputPixels:20000000}).rotate().resize(1400,1400,{fit:'inside',withoutEnlargement:true}).jpeg({quality:82}).toBuffer();}catch{throw Error('This photo could not be read. Try a JPEG instead.');}
 const blob=await putBlob('hack3/interviews/'+crypto.randomUUID()+'.jpg',image,{access:'public',contentType:'image/jpeg',addRandomSuffix:false,cacheControlMaxAge:3600});
 try{await redis(['ZADD',key('photos'),Date.now()+RETENTION*1000,blob.url]);}catch(e){await del(blob.url).catch(()=>{});throw e;}return blob.url;
}
export async function deletePhoto(url,{deleteBlob=del}={}){if(!url)return;const u=new URL(url);if(u.protocol!=='https:'||!u.hostname.endsWith('.public.blob.vercel-storage.com')||!/^\/hack3\/interviews\/[a-f0-9-]+\.jpg$/.test(u.pathname))return;await redis(['ZADD',key('photos'),Date.now(),url]);await deleteBlob(url);await redis(['ZREM',key('photos'),url]);}
export async function cleanupPhotos(){if(!process.env.BLOB_READ_WRITE_TOKEN)return;if(!await redis(['SET',key('photo-cleanup'),'1','NX','EX',3600]))return;const urls=await redis(['ZRANGEBYSCORE',key('photos'),'-inf',Date.now(),'LIMIT',0,200]);await Promise.allSettled(urls.map(url=>deletePhoto(url)));}
