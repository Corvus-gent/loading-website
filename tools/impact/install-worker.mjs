import{createHash}from'node:crypto';
// Install the public-browser fallback on this Mac. Vercel keeps API sync on its 30-min cron.
import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import {execFileSync} from 'node:child_process';
const root=process.cwd(),home=os.homedir(),dest=path.join(home,'Library/Application Support/Corvus/impact-worker'),logs=path.join(home,'Library/Logs/Corvus'),label='gent.corvus.impact-browser';
await fs.access(path.join(home,'.secrets/corvus-impact-worker.env'));
await fs.mkdir(dest,{recursive:true});await fs.mkdir(logs,{recursive:true});
// Pin a clean committed copy so another branch checkout cannot break the scheduled worker.
const files=['api','compound/v2','compound/impact','tools/impact','package.json'];
execFileSync('sh',['-c','git archive HEAD '+files.map(v=>"'"+v+"'").join(' ')+' | tar -x -C "$1"','impact-install',dest],{cwd:root});
try{await fs.symlink(path.join(root,'node_modules'),path.join(dest,'node_modules'),'dir')}catch(e){if(e.code!=='EEXIST')throw e;}
// Pinned, checksum-verified metadata extractor. No arbitrary auto-update in the scheduled worker.
const release='2026.10.26',digest='e51e69e89489f199530f13d32a4342da3ddb2cf34842f364603a066db05afbf3';
const bin=path.join(dest,'bin/yt-dlp');let bytes;
for(const candidate of [bin,path.join(root,'test-results/metric-coverage/bin/yt-dlp')])try{const b=await fs.readFile(candidate);if(createHash('sha256').update(b).digest('hex')===digest){bytes=b;break;}}catch{}
if(!bytes){const r=await fetch('https://github.com/yt-dlp/yt-dlp/releases/download/'+release+'/yt-dlp');if(!r.ok)throw Error('Cannot fetch pinned yt-dlp');bytes=Buffer.from(await r.arrayBuffer());}
if(createHash('sha256').update(bytes).digest('hex')!==digest)throw Error('yt-dlp checksum mismatch');await fs.mkdir(path.dirname(bin),{recursive:true});await fs.writeFile(bin,bytes);
const python=execFileSync('python3',['-c','import sys; assert sys.version_info >= (3,10); print(sys.executable)'],{encoding:'utf8'}).trim();
const xml=v=>v.replaceAll('&','&amp;').replaceAll('<','&lt;');
const file=path.join(home,'Library/LaunchAgents',label+'.plist');await fs.writeFile(file,`<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>Label</key><string>${label}</string><key>EnvironmentVariables</key><dict><key>IMPACT_PYTHON</key><string>${xml(python)}</string></dict><key>ProgramArguments</key><array><string>${xml(process.execPath)}</string><string>${xml(path.join(dest,'tools/impact/browser-worker.mjs'))}</string></array><key>WorkingDirectory</key><string>${xml(dest)}</string><key>StartInterval</key><integer>60</integer><key>RunAtLoad</key><true/><key>StandardOutPath</key><string>${xml(path.join(logs,'impact-browser.log'))}</string><key>StandardErrorPath</key><string>${xml(path.join(logs,'impact-browser-error.log'))}</string></dict></plist>`);const domain='gui/'+os.userInfo().uid;
try{execFileSync('launchctl',['bootout',domain+'/'+label],{stdio:'pipe'})}catch{}
execFileSync('launchctl',['bootstrap',domain,file]);console.log('Installed '+label+': checks queue each minute; new posts hourly, older posts daily, while this Mac is awake.');
