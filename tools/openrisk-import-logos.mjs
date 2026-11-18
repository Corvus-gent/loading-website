import {rename,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import sharp from 'sharp';
import logos from '../api/_openrisk/logos.js';
import {catalog} from '../api/_openrisk/engine/index.js';

const out={...logos};
const officialIcons={intopix:'https://www.intopix.com/favicon.png'};
const directoryLogo=/^https:\/\/ctyjqoiryugiaxojrgve\.supabase\.co\/storage\/v1\/object\/public\/startup-logos\/[a-z0-9_.%-]+$/i;
const safeDomain=/^(?:[a-z0-9-]+\.)+[a-z]{2,}$/i;
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');

async function raster(url, min=14) {
  if (!url) return null;
  try {
    const response=await fetch(url,{redirect:'follow',signal:AbortSignal.timeout(5500)});
    if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) return null;
    const stream=response.body.getReader();
    const chunks=[];
    let size=0;
    while(true){
      const {done,value}=await stream.read();
      if(done) break;
      size+=value.length;
      if(size>1_500_000) { await stream.cancel(); return null; }
      chunks.push(Buffer.from(value));
    }
    const src=Buffer.concat(chunks);
    const art=sharp(src,{limitInputPixels:6_000_000});
    const {width,height}=await art.metadata();
    if(Math.min(width||0,height||0)<min) return null;
    return await art.resize(48,48,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).webp({quality:84}).toBuffer();
  } catch { return null; }
}

const duck=domain=>'https://icons.duckduckgo.com/ip3/'+domain+'.ico';
const google=domain=>'https://www.google.com/s2/favicons?domain='+encodeURIComponent(domain)+'&sz=64';
const placeholder = new Set((await Promise.all([duck('openrisk-test-placeholder.invalid'),google('openrisk-test-placeholder.invalid')].map(url=>raster(url)))).filter(Boolean).map(hash));
const targets=catalog.filter(row=>!out[row.id] && (row.logoUrl||row.domain));
const file=new URL('../api/_openrisk/logos.js',import.meta.url);
const pending=new URL(file.href+'.tmp');
let cursor=0,added=0,writing=Promise.resolve();
function persist(){
  writing=writing.then(async()=>{
    await writeFile(pending,'// Rasterized company logos and public favicons.\nexport default '+JSON.stringify(out,null,2)+';\n');
    await rename(pending,file);
  });
  return writing;
}
await Promise.all(Array.from({length:5},async()=>{
  while(cursor<targets.length){
    const row=targets[cursor++];
    const candidates=[
      officialIcons[row.id],
      directoryLogo.test(row.logoUrl||'') ? row.logoUrl : '',
      safeDomain.test(row.domain||'') ? duck(row.domain) : '',
      safeDomain.test(row.domain||'') ? google(row.domain) : '',
    ].filter(Boolean);
    for(const url of candidates){
      const bytes=await raster(url);
      if(!bytes || placeholder.has(hash(bytes))) continue;
      out[row.id]='data:image/webp;base64,'+bytes.toString('base64');
      if(++added%50===0) { console.log(added+' logos imported'); await persist(); }
      break;
    }
    await delay(180);
  }
}));
await persist();
console.log(added+' new logos; '+Object.keys(out).length+' available.');
