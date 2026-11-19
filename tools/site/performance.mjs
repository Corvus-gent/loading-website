import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import sharp from 'sharp';
const output = 'img/performance';
const files = ['index.html','public/realm-entry.html',...['realm','legion','gabe','daily','sf/larp'].map(p=>p+'/index.html')];
const attr = (tag,key) => new RegExp('\\s'+key+'\\s*=\\s*(["\'])(.*?)\\1','i').exec(tag)?.[2];
function set(tag,key,value) {
  const re = new RegExp('\\s'+key+'\\s*=\\s*(["\'])(.*?)\\1','i');
  const field = ' '+key+'="'+String(value).replaceAll('&','&amp;').replaceAll('"','&quot;')+'"';
  return re.test(tag) ? tag.replace(re,()=>field) : tag.replace(/\s*\/?>$/,end=>field+end);
}
async function asset(name, image, width, png=false) {
  const resized = sharp(image).resize(name==='logo'?{width,height:width,fit:'fill',withoutEnlargement:true}:{width,withoutEnlargement:true});
  const data = await (png ? resized.png({compressionLevel:9}) : resized.webp(name==='logo'?{lossless:true}:{quality:82})).toBuffer();
  const hash = createHash('sha256').update(data).digest('hex').slice(0,12);
  const file = output+'/'+name+'-'+width+'-'+hash+(png?'.png':'.webp');
  await fs.writeFile(file,data); return {url:'/'+file+'?v='+hash,file,width,bytes:data.length};
}
export async function optimizeImages() {
  await fs.mkdir(output,{recursive:true});
  const logo = await fs.readFile('logo.png');
  const logos = await Promise.all([asset('logo',logo,32),asset('logo',logo,64)]);
  const icon = await asset('logo',logo,64,true), photos = new Map();
  for (const row of JSON.parse(await fs.readFile('sf/larp/photos.json','utf8'))) {
    const src='/sf/larp/'+row.photo, input=await fs.readFile('.'+src), dimensions=await sharp(input).metadata();
    const variants=[];
    // Existing 360px WebPs are already appropriately sized. Never upscale them.
    if (dimensions.width>720) for (const width of [360,720]) variants.push(await asset(row.photo.split('/').at(-1).replace(/\.\w+$/,''),input,width));
    photos.set(src,{dimensions,variants});
  }
  for (const file of files) {
    let photoIndex=0, html=await fs.readFile(file,'utf8');
    html=html.replace(/<link\b[^>]*>/gi,tag => attr(tag,'rel')==='icon' && (attr(tag,'href')==='/logo.png' || attr(tag,'data-perf-icon')==='true') ? set(set(tag,'data-perf-icon','true'),'href',icon.url) : tag);
    html=html.replace(/<img\b[^>]*>/gi,tag => {
      const src=attr(tag,'data-perf-src') || attr(tag,'src');
      if (src==='/logo.png') {
        tag=set(tag,'data-perf-src',src);
        tag=set(tag,'src',logos[0].url); tag=set(tag,'srcset',logos.map(a=>a.url+' '+a.width+'w').join(', '));
        tag=set(tag,'sizes',(attr(tag,'width') || '28')+'px');
        tag=set(tag,'loading','lazy'); return set(tag,'decoding','async');
      }
      const photo=photos.get(src);if (!photo) return tag;
      const first=photoIndex++===0, {dimensions,variants}=photo;
      tag=set(tag,'data-perf-src',src);
      tag=set(tag,'width',dimensions.width); tag=set(tag,'height',dimensions.height);
      // Keep the gallery's existing CSS aspect-ratio/object-fit crop unchanged.
      const style=(attr(tag,'style') || '').replace(/(?:^|;)\s*height\s*:[^;]*/gi,'').replace(/^;+|;+$/g,'');
      tag=set(tag,'style',(style?style+';':'')+'height:auto');
      tag=set(tag,'loading',first?'eager':'lazy'); tag=set(tag,'fetchpriority',first?'high':'low');tag=set(tag,'decoding','async');
      if (variants.length) {
        tag=set(tag,'src',variants[0].url);tag=set(tag,'srcset',variants.map(a=>a.url+' '+a.width+'w').join(', '));
        tag=set(tag,'sizes','(max-width:700px) calc(100vw - 36px), (max-width:833px) calc((100vw - 66px) / 2), (max-width:1120px) calc((100vw - 84px) / 3), 346px');
      }
      return tag;
    });
    await fs.writeFile(file,html);
  }
  console.log('Performance: small content-hashed logo/favicon, responsive SF photos, explicit dimensions and lazy below-fold images.');
  return {files,logos,icon,photos};
}
if (process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) await optimizeImages();
