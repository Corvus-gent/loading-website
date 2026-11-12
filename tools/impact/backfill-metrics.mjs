// Read the saved observations from the metadata-only probes, matched to existing eligible post URLs/IDs.
// Usage: node tools/impact/backfill-metrics.mjs path/to/evidence [--production --apply]
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';
const dir=process.argv[2],prod=process.argv.includes('--production'),write=process.argv.includes('--apply');
if(!dir)throw Error('Evidence directory required.');
if(prod){const f=process.env.IMPACT_WORKER_ENV||path.join(os.homedir(),'.secrets/corvus-impact-worker.env');for(const line of fs.readFileSync(f,'utf8').split('\n')){const m=/^(?:export )?([A-Z_0-9]+)=(.*)$/.exec(line);if(m)process.env[m[1]]=m[2].replace(/^(['"])(.*)\1$/,'$2');}process.env.VERCEL_ENV='production';}
const {records,save,snapshot}=await import('../../api/_compound-v2/impact/store.js'),{rebuildHistory}=await import('../../api/_compound-v2/impact/samples.js'),{normalize}=await import('../../api/_compound-v2/impact/normalize.js');
const json=f=>JSON.parse(fs.readFileSync(path.join(dir,f))),x=json('own-x.json'),ig=new Map();
for(const h of ['gabe.maxxing','gabinho_bjj'])ig.set(h,new Map(json(h+'-reels.json')));
const rows=await records(),result={checked:0,patched:{},historicalHours:0,firstDayPosts:0};
for(const row of rows){if(!row.made_with_compound)continue;result.checked++;const p=row.platform,raw=p==='x'?x[row.post_url]:p==='ig'?ig.get(row.account)?.get(new URL(row.post_url).pathname.split('/')[2]):null;
 if(write){const history=await rebuildHistory(row);result.historicalHours+=history.hours;result.firstDayPosts+=Number(history.first);}
 if(!raw)continue;const patch=normalize(p,raw);if(!Object.keys(patch).length)continue;
 if(write){const source=p==='x'?'yt-dlp':'public-reels';const file=p==='x'?'own-x.json':row.account+'-reels.json',observedAt=fs.statSync(path.join(dir,file)).mtime.toISOString();
 if(Object.keys(patch).some(k=>k!=='view_metric'&&(row[k]!==patch[k]||row.field_sources?.[k]!==source)&&(!row.field_observed?.[k]||Date.parse(row.field_observed[k])<=Date.parse(observedAt))))await save({post_url:row.post_url,...patch},{source,observedAt});}
 result.patched[p]=(result.patched[p]||0)+1;}
if(write)await snapshot();console.log(JSON.stringify({...result,mode:write?'applied':'dry-run'}));process.exit(0);
