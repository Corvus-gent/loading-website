// Reproduce the self-hosted assets from the public-domain source in img/army/SOURCES.md.
// node tools/build-napoleon-art.mjs /path/to/original.jpg
import sharp from 'sharp';
import fs from 'node:fs/promises';
const input=process.argv[2];if(!input)throw Error('Supply the downloaded Commons original');
const out=new URL('../img/army/',import.meta.url);
const painting=await sharp(input).modulate({saturation:.10,brightness:.78}).toBuffer();
for(const width of [480,800,1200]){
 const resized=sharp(painting).resize(width);
 await resized.webp({quality:78,effort:5}).toFile(new URL(`napoleon-${width}.webp`,out).pathname);
}
const crow=await fs.readFile(new URL('napoleon-crow.svg',out));
const art=await sharp(painting).resize(690,812).composite([{input:await sharp(crow).resize(690,812).png().toBuffer()}]).png().toBuffer();
const crop=await sharp(art).extract({left:0,top:0,width:690,height:630}).toBuffer();
const lettering=Buffer.from(`<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="shade"><stop stop-color="#000"/><stop offset=".45" stop-color="#000" stop-opacity=".98"/><stop offset=".73" stop-color="#000" stop-opacity=".25"/><stop offset="1" stop-color="#000" stop-opacity=".1"/></linearGradient><radialGradient id="lamp"><stop stop-color="#ffd76a" stop-opacity=".23"/><stop offset="1" stop-color="#ffd76a" stop-opacity="0"/></radialGradient></defs><rect width="1200" height="630" fill="url(#shade)"/><ellipse cx="850" cy="145" rx="170" ry="140" fill="url(#lamp)"/><g font-family="monospace"><text x="64" y="87" fill="#ffd76a" font-size="19" letter-spacing="3">CORVUS / ENLISTMENT IS OPEN</text><text x="60" y="248" fill="#eee9dd" font-size="83" font-weight="700" letter-spacing="-5">the army</text><text x="60" y="337" fill="#eee9dd" font-size="83" font-weight="700" letter-spacing="-5">is recruiting.</text><text x="64" y="413" fill="#b7b0a0" font-size="19">most people scroll. a few build.</text><text x="64" y="560" fill="#ffd76a" font-size="20">corvus.gent/join-the-army-now →</text></g></svg>`);
await sharp({create:{width:1200,height:630,channels:3,background:'#000'}}).composite([{input:crop,left:510,top:0},{input:lettering}]).webp({quality:78,effort:5}).toFile(new URL('gate-napoleon-og.webp',out).pathname);
for(const name of (await fs.readdir(out)).filter(x=>/^(napoleon-.*\.webp|gate-napoleon-og.webp)$/.test(x)))console.log(name,(await fs.stat(new URL(name,out))).size);
