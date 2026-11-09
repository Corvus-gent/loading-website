// Install the public-browser fallback on this Mac. Vercel keeps API sync on its 30-min cron.
import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import {execFileSync} from 'node:child_process';
const root=process.cwd(),home=os.homedir(),dest=path.join(home,'Library/Application Support/Corvus/impact-worker'),logs=path.join(home,'Library/Logs/Corvus'),label='gent.corvus.impact-browser';
await fs.access(path.join(home,'.secrets/corvus-impact-worker.env'));
await fs.mkdir(dest,{recursive:true});await fs.mkdir(logs,{recursive:true});
// Pin a clean committed copy so another branch checkout cannot break the scheduled worker.
const files=['api','compound/v2','compound/impact','tools/impact','package.json'];
execFileSync('sh',['-c','git archive HEAD '+files.map(v=>"'"+v+"'").join(' ')+' | tar -x -C "$1"','impact-install',dest],{cwd:root});
try{await fs.symlink(path.join(root,'node_modules'),path.join(dest,'node_modules'),'dir')}catch(e){if(e.code!=='EEXIST')throw e;}
const xml=v=>v.replaceAll('&','&amp;').replaceAll('<','&lt;');
const file=path.join(home,'Library/LaunchAgents',label+'.plist');await fs.writeFile(file,`<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>Label</key><string>${label}</string><key>ProgramArguments</key><array><string>${xml(process.execPath)}</string><string>${xml(path.join(dest,'tools/impact/browser-worker.mjs'))}</string></array><key>WorkingDirectory</key><string>${xml(dest)}</string><key>StartInterval</key><integer>60</integer><key>RunAtLoad</key><true/><key>StandardOutPath</key><string>${xml(path.join(logs,'impact-browser.log'))}</string><key>StandardErrorPath</key><string>${xml(path.join(logs,'impact-browser-error.log'))}</string></dict></plist>`);const domain='gui/'+os.userInfo().uid;
try{execFileSync('launchctl',['bootout',domain+'/'+label],{stdio:'pipe'})}catch{}
execFileSync('launchctl',['bootstrap',domain,file]);console.log('Installed '+label+': checks queue each minute; profiles every 30 minutes, while this Mac is awake.');
