import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import sharp from 'sharp';
import {optimizeImages} from '../../tools/site/performance.mjs';
const files=['index.html','public/realm-entry.html',...['realm','legion','gabe','daily','sf/larp'].map(p=>p+'/index.html')];
const read=(tag,key)=>new RegExp('\\s'+key+'=["\']([^"\']*)["\']','i').exec(tag)?.[1];
const images=html=>[...html.matchAll(/<img\b[^>]*>/gi)].map(m=>m[0]);
const content=html=>html.replace(/<img\b[^>]*>/gi,'').replace(/<link\b[^>]*>/gi,t=>read(t,'rel')==='icon'?'':t);
const before=await Promise.all(files.map(f=>fs.readFile(f,'utf8')));
const result=await optimizeImages();
assert(result.logos.reduce((n,a)=>n+a.bytes,0)+result.icon.bytes<(await fs.stat('logo.png')).size/8,'small logo assets replace the oversized PNG');
for(let i=0;i<files.length;i++){
 const html=await fs.readFile(files[i],'utf8');
 assert.equal(content(html),content(before[i]),files[i]+': gate, scripts, metadata and page content preserved');
 assert.deepEqual(images(html).map(t=>['alt','id','class','title'].map(k=>read(t,k))),images(before[i]).map(t=>['alt','id','class','title'].map(k=>read(t,k))));
 assert(!images(html).some(t=>read(t,'src')==='/logo.png'));
 const icon=[...html.matchAll(/<link\b[^>]*>/gi)].map(m=>m[0]).find(t=>read(t,'rel')==='icon');
 assert.equal(read(icon,'href'),result.icon.url);
}
const gallery=(await fs.readFile('sf/larp/index.html','utf8')).match(/<div class="site-grid sf-photos"[^>]*>([\s\S]*?)<\/div>/)[1];
const tags=images(gallery);assert.equal(tags.length,result.photos.size);
for(let i=0;i<tags.length;i++){
 assert(Number(read(tags[i],'width'))>0&&Number(read(tags[i],'height'))>0);
 assert.equal(read(tags[i],'loading'),i===0?'eager':'lazy');
 assert.equal(read(tags[i],'fetchpriority'),i===0?'high':'low');
 assert(read(tags[i],'style').includes('height:auto'));
}
for(const [src,photo]of result.photos)for(const variant of photo.variants){
 const info=await sharp(variant.file).metadata();assert.equal(info.width,variant.width);assert(variant.width<=photo.dimensions.width);assert.equal(info.format,'webp');assert(Math.abs(info.width/info.height-photo.dimensions.width/photo.dimensions.height)<0.001,'photo aspect ratio preserved');
 assert(variant.bytes<(await fs.stat('.'+src)).size);
}
const once=await Promise.all(files.map(f=>fs.readFile(f,'utf8')));await optimizeImages();assert.deepEqual(await Promise.all(files.map(f=>fs.readFile(f,'utf8'))),once,'repeatable output');
console.log('PASS: asset budgets, unchanged content/controls/alt text, explicit dimensions, eager first photo, lazy below-fold photos, no upscaling and idempotence.');
