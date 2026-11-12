import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import fs from 'node:fs';import path from 'node:path';
import {normalize} from '../../api/_compound-v2/impact/normalize.js';
import {refreshMs,coverage,sourceKind,count} from '../../compound/impact/metrics.js';
const run=promisify(execFile);
export async function refreshFallbacks({rows,save,redis,ikey}){
 const bundle=process.env.IMPACT_YTDLP_BUNDLE||path.resolve('bin/yt-dlp');if(!fs.existsSync(bundle))throw Error('Pinned yt-dlp bundle is missing.');
 const python=process.env.IMPACT_PYTHON||'python3';let checked=0,saved=0;
 for(const row of rows.filter(r=>r.made_with_compound&&['x','tt','ig','yt','tw'].includes(r.platform))){
 if(checked>=35)break;
 const p=row.platform,fields=coverage(row),due=refreshMs(row);
 if(!fields.partial&&fields.known.every(k=>sourceKind(row.field_sources?.[k]||row.metric_source)==='official'&&Date.now()-Date.parse(row.field_observed?.[k]||row.metrics_at)<due))continue;
 // Public Instagram post extraction has no private Insights. The Reels grid supplies plays.
 if(p==='ig'&&row.views!=null&&row.likes!=null&&row.comments!=null)continue;
 if(await redis(['EXISTS',ikey('scrape-cooldown:'+p)])||!await redis(['SET',ikey('extract:'+row.id),'1','EX',due/1000,'NX']))continue;
 checked++;try{const {stdout}=await run(python,['tools/impact/ytdlp-metrics.py',bundle,p,row.post_url],{timeout:30000,maxBuffer:80000});const raw=JSON.parse(stdout),patch=p==='x'?normalize('x',raw):{};
 if(p!=='x')for(const [src,target] of Object.entries({view_count:'views',like_count:'likes',comment_count:'comments',...(p==='tt'?{repost_count:'shares',save_count:'saves'}:{})}))if(count(raw[src])!==null)patch[target]=count(raw[src]);
 if(Object.keys(patch).length&&await save({post_url:row.post_url,...patch},{source:'yt-dlp'}))saved++;
 }catch(e){const denied=/429|rate.limit|403|captcha|sign in|login required/i.test(e.stderr||'');if(denied)await redis(['SET',ikey('scrape-cooldown:'+p),'1','EX',3600]);console.log(JSON.stringify({platform:p,post:row.id,status:denied?'public access limited; backing off':'no usable public extraction'}));}
 await new Promise(r=>setTimeout(r,1200));}
 return{checked,saved};
}
