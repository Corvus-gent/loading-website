import fs from 'node:fs/promises';import {spawn,execFileSync} from 'node:child_process';
const dir='tests/results/ossman-demo',out='submission/videos';
function run(args){return new Promise((resolve,reject)=>{const p=spawn('ffmpeg',['-hide_banner','-loglevel','error','-y',...args],{stdio:['ignore','ignore','pipe']});let err='';p.stderr.on('data',d=>err+=d);p.on('exit',code=>code?reject(Error(err)):resolve());});}
const enc=['-an','-r','60','-c:v','libx264','-preset','veryfast','-crf','20','-pix_fmt','yuv420p','-threads','4','-movflags','+faststart'];
function offset(file){const frames=execFileSync('ffmpeg',['-v','error','-i',file,'-t','2','-vf','scale=1:1','-f','rawvideo','-pix_fmt','rgb24','-']);for(let i=0;i<frames.length;i+=3)if((frames[i]+frames[i+1]+frames[i+2])/3<100)return i/3/25;return .4;}
for(const name of ['9x16','1x1']){
 const h=name==='9x16'?1920:1080,root=dir+'/'+name;
 await run(['-loop','1','-framerate','60','-i',root+'-title.png','-t','2',...enc,root+'-intro.mp4']);
 await run(['-loop','1','-framerate','60','-i',root+'-end.png','-t','3',...enc,root+'-outro.mp4']);
 const game=root+'-game.webm',start=offset(game),data=JSON.parse(await fs.readFile(root+'-events.json','utf8')),finishes=data.events.filter(e=>e.type==='finish').slice(0,3),zoom=finishes.map(e=>`between(t,${e.t-.05},${e.t+.55})`).join('+');
 const capInputs=[0,1,2,3,4].flatMap(i=>['-loop','1','-framerate','25','-i',root+'-cap'+i+'.png']).concat([0,1,2].flatMap(i=>['-loop','1','-framerate','25','-i',root+'-finish'+i+'.png']));
 const filters=[`[0:v]trim=duration=16,setpts=PTS-STARTPTS,split=3[base][z][hudsource]`,`[z]crop=900:${Math.round(h/1.2/2)*2}:180:0,scale=1080:${h}:flags=neighbor[zoom]`,`[hudsource]crop=1080:${name==='9x16'?360:220}:0:0[hud]`,`[base][zoom]overlay=enable='${zoom}':shortest=1[zoombase]`,`[zoombase][hud]overlay=0:0:shortest=1[g0]`];
 if(name==='1x1')filters.push('[g0]scale=920:920:flags=lanczos,pad=1080:1080:80:0:color=0x080c16[g]');else filters.push('[g0]null[g]');
 const times=[[0,2.4],[2.4,7.5],[7.5,9.95],[9.95,13.65],[13.65,16]];for(let i=0;i<5;i++)filters.push(`[${i?'c'+(i-1):'g'}][${i+1}:v]overlay=enable='between(t,${times[i][0]},${times[i][1]})':shortest=1[c${i}]`);
 for(let i=0;i<3;i++){const t=finishes[i].t;filters.push(`[${i?'hit'+(i-1):'c4'}][${6+i}:v]overlay=enable='between(t,${t},${t+.60})':shortest=1[f${i}]`);filters.push(`[f${i}]drawbox=x=0:y=0:w=iw:h=ih:color=white@0.32:t=fill:enable='between(t,${t},${t+.033})'[hit${i}]`);}
 await run(['-ss',String(start),'-i',game,...capInputs,'-filter_complex_threads','2','-filter_complex',filters.join(';'),'-map','[hit2]','-t','16',...enc,root+'-edited-game.mp4']);
 await run(['-ss','0.8','-i',root+'-vote.webm','-loop','1','-i',root+'-cap5.png','-filter_complex_threads','2','-filter_complex',`[0:v]setpts=PTS-STARTPTS${name==='1x1'?',scale=920:920,pad=1080:1080:80:0:color=0x080c16':''}[v];[v][1:v]overlay=shortest=1[o]`,'-map','[o]','-t','3',...enc,root+'-edited-vote.mp4']);
 const list=root+'-concat.txt';await fs.writeFile(list,['intro','edited-game','edited-vote','outro'].map(x=>`file '${name}-${x}.mp4'`).join('\n'));
 await run(['-f','concat','-safe','0','-i',list,'-i',dir+'/soundtrack.wav','-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','aac','-b:a','192k','-af','loudnorm=I=-14:TP=-1.5:LRA=7','-t','24','-movflags','+faststart',out+'/ossman-'+name+'.mp4']);
 console.log(name+' final video encoded');
}
