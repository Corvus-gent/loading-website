import {spawn} from 'node:child_process';
import fs from 'node:fs';
const input=process.env.COMPOUND_EXPORTS;
const files=[['codex','submission/videos/ossman-9x16.mp4'],['compound',input+'/ufc-03.mp4'],['compound-bonus-1',input+'/ufc-01.mp4'],['compound-bonus-2',input+'/ufc-02.mp4']];
const run=args=>new Promise((resolve,reject)=>{const p=spawn('ffmpeg',['-hide_banner','-loglevel','error','-y',...args],{stdio:['ignore','ignore','pipe']});let error='';p.stderr.on('data',b=>error+=b);p.on('close',code=>code?reject(Error(error)):resolve());});
for(const[name,source]of files){if(!fs.existsSync(source))continue;await run(['-i',source,'-vf','scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2,setsar=1','-c:v','libx264','-preset','veryfast','-crf','28','-pix_fmt','yuv420p','-c:a','aac','-b:a','96k','-movflags','+faststart','public/battle/'+name+'.mp4']);await run(['-ss','0.5','-i','public/battle/'+name+'.mp4','-frames:v','1','-q:v','3','public/battle/'+name+'.jpg']);const size=fs.statSync('public/battle/'+name+'.mp4').size;if(size>8000000)throw Error(name+' exceeds 8 MB');console.log(name+': '+size+' bytes');}
