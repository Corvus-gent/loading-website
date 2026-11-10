import {tiktokDiscovery} from './tiktok-discovery.mjs';
import {refreshMs} from '../../compound/impact/metrics.js';
import {refreshFallbacks} from './refresh-fallback.mjs';
// Public profiles only. No login, private endpoints, captcha bypass or invented metrics.
import fs from 'node:fs';import crypto from 'node:crypto';import os from 'node:os';
const envFile=process.env.IMPACT_WORKER_ENV||os.homedir()+'/.secrets/corvus-impact-worker.env';
if(fs.existsSync(envFile))for(const line of fs.readFileSync(envFile,'utf8').split('\n')){const m=/^(?:export )?([A-Z_0-9]+)=(.*)$/.exec(line);if(m)process.env[m[1]]=m[2].replace(/^(['"])(.*)\1$/,'$2');}
process.env.VERCEL_ENV='production';
const {redis}=await import('../../api/_redis.js'),{ikey,save,snapshot,records}=await import('../../api/_compound-v2/impact/store.js'),{saveStatus}=await import('../../api/_compound-v2/impact/accounts.js'),{configuredAccounts}=await import('../../compound/impact/accounts.js'),{scrapeProfile}=await import('./public-profile.mjs'),{chromium}=await import('playwright');
const lock=crypto.randomUUID();let browser;
try{
 if(!await redis(['SET',ikey('browser-lock'),lock,'NX','EX',900]))process.exit(0);
 const due=Date.now()-Number(await redis(['GET',ikey('browser-last-run')])||0)>3600000;
 if(due||process.argv.includes('--force'))for(const a of configuredAccounts().filter(a=>['tt','ig'].includes(a.platform)))await redis(['SADD',ikey('browser-queue'),a.platform+':'+a.account]);
 const queue=await redis(['SMEMBERS',ikey('browser-queue')]);const rows=(due||queue.length||process.argv.includes('--force'))?await records():[];if(queue.length)browser=await chromium.launch({headless:true});
 for(const id of queue){const [platform,account]=id.split(':');if(!configuredAccounts().some(a=>a.platform===platform&&a.account===account))continue;
 const cache=ikey('profile-check:'+id);const owned=rows.filter(r=>r.platform===platform&&r.account===account&&r.made_with_compound),interval=owned.length&&owned.every(r=>refreshMs(r)===86400000)?86400:3600;
 if(!await redis(['SET',cache,'1','NX','EX',interval])){await redis(['SREM',ikey('browser-queue'),id]);continue;}
 const result=await scrapeProfile(browser,platform,account,owned);
 if(platform==='tt'&&!result.posts.length&&!/429/.test(result.error||'')){try{const posts=await tiktokDiscovery(account,{redis,ikey});if(posts.length)Object.assign(result,{posts,mode:'yt-dlp',error:null,note:'Public, author-matched native TikTok videos; photo and repost entries excluded.'});}catch(e){result.error=(result.error||'Public profile unavailable')+'; TikTok extractor: '+(/429/.test(e.stderr||'')?'rate limited':'no usable profile response');}}
 let saved=0;for(const post of result.posts){try{if(await save(post,{source:result.mode==='yt-dlp'?'yt-dlp':'public-browser'}))saved++}catch(e){result.error='Post save failed: '+e.message;}}
 await saveStatus(platform,account,{mode:result.mode,found:result.posts.length,updated:saved,note:result.note,error:result.error,provider_error:JSON.parse(await redis(['HGET',ikey('account-sync'),id])||'{}').provider_error||null});await redis(['SREM',ikey('browser-queue'),id]);console.log(JSON.stringify({at:new Date().toISOString(),account,platform,found:result.posts.length,saved,error:result.error}));
 await new Promise(r=>setTimeout(r,2000));
 }
 if(due||queue.length){const fallback=await refreshFallbacks({rows,save,redis,ikey});console.log('Public post metrics: '+JSON.stringify(fallback));await snapshot();await redis(['SET',ikey('browser-last-run'),Date.now()]);}await redis(['SET',ikey('browser-heartbeat'),new Date().toISOString(),'EX',600]);
}catch(e){console.error('Impact browser worker:',e.message);process.exitCode=1;}finally{await browser?.close();await redis(['EVAL',"if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) end;return 0",1,ikey('browser-lock'),lock]);process.exit(process.exitCode||0);}
