import fs from 'node:fs/promises';import {spawn,execFileSync} from 'node:child_process';
const root='tests/results/ossman-demo/battle',out='public/battle/raw';
const run=args=>new Promise((resolve,reject)=>{const p=spawn('ffmpeg',['-hide_banner','-loglevel','error','-y',...args],{stdio:['ignore','ignore','pipe']});let err='';p.stderr.on('data',d=>err+=d);p.on('exit',code=>code?reject(Error(err)):resolve());});
function offset(file){const frames=execFileSync('ffmpeg',['-v','error','-i',file,'-t','2','-vf','scale=1:1','-f','rawvideo','-pix_fmt','rgb24','-']);for(let i=0;i<frames.length;i+=3)if((frames[i]+frames[i+1]+frames[i+2])/3<100)return i/3/25;return .5;}
const basic=['-an','-c:v','libx264','-preset','veryfast','-crf','19','-pix_fmt','yuv420p','-threads','4','-movflags','+faststart'];
const names=[['raw-gameplay-full',30],['raw-fighters',12],['raw-gameover',5],['raw-code',15],['raw-vote',5]];const manifest=[];
for(let j=0;j<names.length;j+=2)await Promise.all(names.slice(j,j+2).map(async([name,duration])=>{const input=root+'/'+name+'.webm',start=offset(input)+(name==='raw-gameover'?.3:name==='raw-vote'?.4:0);await run(['-ss',String(start),'-i',input,'-t',String(duration),'-vf','tpad=stop_mode=clone:stop_duration=0.5',...basic,out+'/'+name+'.mp4']);manifest.push({name,duration,start});console.log(name+' encoded');}));
const gameStart=manifest.find(m=>m.name==='raw-gameplay-full').start,events=JSON.parse(await fs.readFile(root+'/gameplay.json','utf8')).events.filter(e=>e.type==='finish').slice(0,3);
const inputs=events.flatMap(e=>['-ss',String(gameStart+e.t-.12),'-t','2','-i',root+'/raw-gameplay-full.webm']);
await run([...inputs,'-filter_complex','[0:v]setpts=PTS-STARTPTS[a];[1:v]setpts=PTS-STARTPTS[b];[2:v]setpts=PTS-STARTPTS[c];[a][b][c]concat=n=3:v=1:a=0[out]','-map','[out]',...basic,out+'/raw-finishes.mp4']);
manifest.push({name:'raw-finishes',duration:6,finishes:events});await fs.writeFile(root+'/encode.json',JSON.stringify(manifest,null,2));
execFileSync('zip',['-j','-q',out+'/raw-all.zip',...names.map(([n])=>out+'/'+n+'.mp4'),out+'/raw-finishes.mp4']);console.log('Six clips + ZIP ready.');
