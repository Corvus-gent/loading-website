import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import sharp from 'sharp';
import jsQR from 'jsqr';
import {tagSVG,insignia} from '../../js/army/art.js';
import {serveProfile} from '../../api/_army/_images.js';
const labels=JSON.parse(await readFile('js/i18n/army.en.json','utf8'));
const env={PATH:process.env.PATH,SESSION_SECRET:'art-fixture-only',REDIS_URL:'redis://127.0.0.1:1/1',CORVUS_RUST_WRITES:'isolated'};
const run=rows=>{const p=spawnSync('target/debug/corvus-contract',[],{env,input:rows.map(r=>JSON.stringify({operation:'army-store',now:Date.now(),...r})).join('\n')+'\n',encoding:'utf8',maxBuffer:12e6});assert.equal(p.status,0,p.stderr);return p.stdout.trim().split('\n').map(s=>JSON.parse(s));};
const base={username:'migration-fixture',rank:'legatus',serial:42,created:'2026-11-20',recruits:8};
const rows=[];for(const poster of[false,true])for(const tier of[null,'miles','senator','consul','imperator'])for(const username of['gabe','a_very_long_name_24_chars',null,'<svg onload="no">&\''])rows.push({action:'art',body:{...base,tier,username},value:'abcd2345',poster,labels});
const normalize=(svg,poster)=>svg.replace(poster?/<rect x="790" y="1025" width="212" height="212" fill="#f4e8c9"\/><path d="[^"]+" fill="#090909"\/>/:/<rect x="825" y="330" width="136" height="136" fill="#f4e8c9"\/><path d="[^"]+" fill="#090909"\/>/,'__QR__').replace(/font-size="([\d.]+)"/g,(_,n)=>'font-size="'+Number(n).toFixed(8)+'"');
const results=run(rows);results.forEach((svg,i)=>{assert.equal(typeof svg,'string',JSON.stringify(svg));const r=rows[i];assert.equal(normalize(svg,r.poster),normalize(tagSVG(r.body,r.value,{poster:r.poster,labels}),r.poster));assert(!svg.includes('<svg onload='));assert(!svg.includes('__RUST_'));});
const icons=['tiro','miles','decanus','optio','centurio','tribunus','legatus','imperator','senator','unknown'];const iconRows=icons.flatMap(value=>[16,40,80].map(size=>({action:'insignia',value,size})));run(iconRows).forEach((svg,i)=>assert.equal(svg,insignia(iconRows[i].value,iconRows[i].size)));
for(const s of[base,{...base,tier:'senator'},{...base,tier:'imperator'},{...base,username:'a_longer-name_123',rank:'miles'}]){const expected=await new Promise((resolve,reject)=>serveProfile({setHeader(){},status(){return this},send:resolve},s).catch(reject));assert.equal(run([{action:'profile-html',body:s}])[0],expected);}
await mkdir('test-results/rust',{recursive:true});
for(const poster of[false,true]){
 const encoded=run([{action:'art-png',body:{...base,tier:'senator'},value:'abcd2345',poster}])[0];assert.equal(typeof encoded,'string',JSON.stringify(encoded));const bytes=Buffer.from(encoded,'base64');const meta=await sharp(bytes).metadata();assert.equal(meta.format,'png');assert.equal(meta.width,poster?1080:1200);assert.equal(meta.height,poster?1350:630);
 const {data,info}=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});const decoded=jsQR(Uint8ClampedArray.from(data),info.width,info.height);assert(decoded,'native QR must decode');assert.equal(decoded.data,'https://corvus.gent/r/abcd2345');
 await writeFile('test-results/rust/army-'+(poster?'poster':'dog-tag')+'.png',bytes);
 // A phone-width preview uses the real generated PNG, not a recreated mock-up.
 await sharp(bytes).resize({width:390}).png().toFile('test-results/rust/army-'+(poster?'poster':'dog-tag')+'-390.png');
}
console.log('PASS: 40 Army art markup comparisons, 30 exact insignia SVGs, original profile HTML/meta tags, escaped names, native 1200×630/1080×1350 PNGs and decoded byte-mode QR links. Font embedded; no system fonts or filesystem/external-image resolver.');
