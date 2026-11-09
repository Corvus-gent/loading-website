import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {loadCompoundEnv} from './compound-env.mjs';
// Input is a private JSON array; never commit export paths or signed download URLs.
const args=process.argv.slice(2),file=args.find(x=>!x.startsWith('--')),apply=args.includes('--apply');
try{
 if(!file)throw Error('Usage: node tools/import-compound-exports.mjs /absolute/manifest.json [--apply] [--expected-count=27]');
 const count=Number(args.find(x=>x.startsWith('--expected-count='))?.split('=')[1]||27),rows=JSON.parse(await fs.readFile(file,'utf8'));
 if(!Array.isArray(rows)||rows.length!==count)throw Error('Export count does not match the expected count. No data changed.');
 loadCompoundEnv();process.env.VERCEL_ENV='production';
 const {validateExport,importExport}=await import('../api/_compound-v2/uploads.js');
 const {redis}=await import('../api/_redis.js');const {key}=await import('../api/_compound-v2/store.js');
 const checked=rows.map((r,i)=>validateExport({...r,account:r.account??r.account_code,lang:r.lang??r.language,hook:r.hook??r.hook_family,export_order:r.export_order??i}));
 if(new Set(checked.map(r=>r.slug)).size!==rows.length)throw Error('Duplicate export slugs. No data changed.');
 if(rows.some(r=>r.status&&r.status!=='ready'&&r.status!=='posted'))throw Error('The manifest contains exports that are not ready. No data changed.');
 for(const row of checked){const stat=await fs.stat(row.local_path);if(!stat.isFile()||stat.size<1024)throw Error('Missing or empty export file. No data changed.');}
 const prior=await redis(['HGETALL',key('videos')]),assets=await redis(['HGETALL',key('export-assets')]);
 console.log(JSON.stringify({validated:checked.length,apply}));
 if(apply){
  const dir=path.join(os.homedir(),'.secrets','corvus-backups');await fs.mkdir(dir,{recursive:true,mode:0o700});
  await fs.writeFile(path.join(dir,'compound-v2-'+Date.now()+'.json'),JSON.stringify({videos:prior,assets}),{mode:0o600,flag:'wx'});
  let imported=0;for(const row of checked){await importExport(row);imported++;}
  console.log(JSON.stringify({imported,backup_created:true}));
 }
 process.exit(0);
}catch(error){console.error(error.code==='ENOENT'?'Missing input or export file. No import completed.':String(error.message).replace(/https?:\/\/\S+/g,'[URL hidden]').replace(/rediss?:\/\/\S+/g,'[Redis URL hidden]'));process.exit(1);}
