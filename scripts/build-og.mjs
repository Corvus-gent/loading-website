// Original typography plus the repository's existing raven vector; no external image service.
import sharp from 'sharp';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const rows=JSON.parse(await fs.readFile('seo/manifest.json','utf8'));
const bird=(await fs.readFile('img/link-crow.svg','utf8')).replace('0 0 140 40','-4 -16 148 62').replace('#141414','#141107').replace('#d8d8d8','#ffd76a');
const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
await fs.mkdir('og/pages',{recursive:true});
let old={};try{old=JSON.parse(await fs.readFile('seo/image-hashes.json','utf8'));}catch{}
const hashes={};let count=0;
for(const r of rows){
 const lines=[];let line='';for(const word of r.title.split(/\s+/)){if(line&&(line+' '+word).length>25){lines.push(line);line=word;}else line+=(line?' ':'')+word;}if(line)lines.push(line);
 const size=lines.length>3?56:68,step=size+12,start=lines.length>3?210:230;
 const text=lines.map((l,i)=>`<text x="64" y="${start+i*step}" font-size="${size}" font-weight="700" fill="${i===lines.length-1?'#ffd76a':'#eee9dc'}">${esc(l)}</text>`).join('');
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><defs><radialGradient id="glow"><stop stop-color="#6b4c0d" stop-opacity=".55"/><stop offset="1" stop-color="#070706" stop-opacity="0"/></radialGradient></defs><rect width="1200" height="630" fill="#080807"/><ellipse cx="1030" cy="170" rx="550" ry="440" fill="url(#glow)"/><path d="M64 116H1136M64 530H1136" stroke="#5a4821"/><g font-family="monospace"><text x="64" y="76" font-size="20" fill="#d7cba6" letter-spacing="4">CORVUS / BUILT IN PUBLIC</text>${text}<text x="64" y="581" font-size="21" fill="#c9c0a9">${esc(new URL(r.canonical).host+r.route.replace(/^\/stats\//,'/'))}</text><text x="1136" y="581" text-anchor="end" font-size="28" fill="#ffd76a">↗</text></g><image x="860" y="26" width="260" height="86" href="data:image/svg+xml;base64,${Buffer.from(bird).toString('base64')}"/></svg>`;
 const hash=crypto.createHash('sha256').update(svg).digest('hex');hashes[r.image]=hash;
 if(old[r.image]!==hash||!await fs.stat('.'+r.image).catch(()=>null)){await sharp(Buffer.from(svg)).png({compressionLevel:9,palette:true}).toFile('.'+r.image);count++;}
}
await fs.writeFile('seo/image-hashes.json',JSON.stringify(hashes,null,2)+'\n');console.log(`OG artwork: ${count} images generated; ${rows.length} total (1200×630).`);
