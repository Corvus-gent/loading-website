import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {put,del} from '@vercel/blob';
import {loadCompoundEnv} from './compound-env.mjs';
const args=process.argv.slice(2),modern=args[0]==='--slot';
const slot=modern?Number(args[1]):1,input=args[modern?2:0],cutfile=modern?args[3]:null,label=args[modern?4:1];
if(!input||!label||![1,2,3].includes(slot)||(modern&&!cutfile)){console.error('Usage: npm run ship-video -- --slot N ./file.mp4 ./cutlist.json "changelog"');process.exit(1);}
let temp,uploaded,registered=false;
try{
 loadCompoundEnv();if(!process.env.BLOB_READ_WRITE_TOKEN||!process.env.REDIS_URL)throw Error('Blob and Redis must be configured in the secrets file.');
 const source=path.resolve(input);await fs.access(source);
 const probe=spawnSync('ffprobe',['-v','error','-show_entries','format=duration:stream=codec_type,width,height','-of','json',source],{encoding:'utf8'});if(probe.status!==0)throw Error('ffprobe could not read the video');const info=JSON.parse(probe.stdout),duration=Number(info.format.duration),stream=info.streams.find(s=>s.codec_type==='video');if(!stream||!Number.isFinite(duration)||duration<=0||duration>600)throw Error('Use a video between 0 and 600 seconds.');
 const {redis}=await import('../api/_redis.js');const next='v'+(Number(await redis(['GET',(process.env.COMPOUND_KEY_PREFIX||'compound')+':sequence'])||0)+1);
 let cues=[];try{const file=JSON.parse(await fs.readFile(new URL('../compound/cues.json',import.meta.url),'utf8'));cues=file.versions?.[next]||[];}catch(error){if(error.code!=='ENOENT')throw Error('Could not read compound/cues.json');}
 const {validateCues,validateCutlist}=await import('../api/_compound/model.js');let cutlist=[];if(cutfile){const parsed=JSON.parse(await fs.readFile(path.resolve(cutfile),'utf8'));cutlist=validateCutlist(parsed,duration);cues=validateCues(parsed.cues||[],duration);}else validateCues(cues,duration);
 temp=await fs.mkdtemp(path.join(os.tmpdir(),'corvus-video-'));const output=path.join(temp,'cut.mp4');
 console.log('Optimising for mobile playback…');const result=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-i',source,'-map','0:v:0','-map','0:a?','-vf','scale=720:1280:force_original_aspect_ratio=decrease:force_divisible_by=2','-c:v','libx264','-preset','fast','-crf','25','-maxrate','1100k','-bufsize','2200k','-pix_fmt','yuv420p','-c:a','aac','-b:a','96k','-movflags','+faststart','-map_metadata','-1','-y',output],{encoding:'utf8'});if(result.status!==0)throw Error('Video optimisation failed. Source file was not changed.');
 const bytes=await fs.readFile(output);if(bytes.length>150*1024*1024)throw Error('Optimised file exceeds 150 MB. Shorten the cut.');
 const dims=JSON.parse(spawnSync('ffprobe',['-v','error','-select_streams','v:0','-show_entries','stream=width,height','-of','json',output],{encoding:'utf8'}).stdout).streams[0];
 const filename=`compound/${Date.now()}-${crypto.createHash('sha256').update(bytes).digest('hex').slice(0,12)}.mp4`;
 uploaded=await put(filename,bytes,{access:'public',contentType:'video/mp4',addRandomSuffix:false,cacheControlMaxAge:31536000});
 const {publish}=await import('../api/_compound/store.js');const v=await publish({slot,cutlist,url:uploaded.url,label:modern?`V${slot}`:label,changelog:label,duration,width:dims.width,height:dims.height,cues});registered=true;
 console.log(`V${v.slot} / r${v.iteration} (${v.id}) live · ${(bytes.length/1024/1024).toFixed(1)} MB · ${duration.toFixed(1)}s`);console.log(process.env.COMPOUND_PUBLIC_URL||(process.env.COMPOUND_KEY_PREFIX==='compound-preview'?'https://loading-website-compound-preview-corvus11.vercel.app/compound/':'https://corvus.gent/compound'));
}catch(error){if(uploaded&&!registered)try{await del(uploaded.url);}catch{}console.error('Upload stopped. '+(error.message.includes('://')?'Connection failed; no credentials printed.':error.message));process.exitCode=1;}finally{if(temp)await fs.rm(temp,{recursive:true,force:true});setTimeout(()=>process.exit(process.exitCode||0),20);}
