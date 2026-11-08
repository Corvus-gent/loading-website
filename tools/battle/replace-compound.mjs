import fs from 'node:fs/promises';import {spawn} from 'node:child_process';import crypto from 'node:crypto';
const source=process.argv[2];if(!source)throw Error('Usage: node tools/battle/replace-compound.mjs /path/to/new.mp4');
await fs.access(source);await fs.mkdir('tests/results/battle',{recursive:true});
const previous=await fs.readFile('public/battle/compound.mp4');
try{await fs.copyFile('public/battle/compound.mp4','public/battle/compound-v1.mp4',1);await fs.copyFile('public/battle/compound.jpg','public/battle/compound-v1.jpg',1);}catch(e){if(e.code!=='EEXIST')throw e;}
const run=args=>new Promise((resolve,reject)=>{const p=spawn('ffmpeg',['-hide_banner','-loglevel','error','-y',...args],{stdio:['ignore','ignore','pipe']});let e='';p.stderr.on('data',b=>e+=b);p.on('close',code=>code?reject(Error(e)):resolve());});
const next='tests/results/battle/compound-next.mp4';
await run(['-i',source,'-vf','scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2,setsar=1','-c:v','libx264','-preset','veryfast','-crf','28','-pix_fmt','yuv420p','-c:a','aac','-b:a','96k','-movflags','+faststart','-threads','4',next]);
const size=(await fs.stat(next)).size;if(size>8000000)throw Error('New video exceeds 8 MB; current public file untouched');
await run(['-ss','0.5','-i',next,'-frames:v','1','-q:v','3','tests/results/battle/compound-next.jpg']);
await fs.copyFile(next,'public/battle/compound.mp4');await fs.copyFile('tests/results/battle/compound-next.jpg','public/battle/compound.jpg');
console.log(JSON.stringify({bytes:size,previousSHA256:crypto.createHash('sha256').update(previous).digest('hex'),archiveSHA256:crypto.createHash('sha256').update(await fs.readFile('public/battle/compound-v1.mp4')).digest('hex')}));
