import fs from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';import {loadCompoundEnv} from './compound-env.mjs';
try{loadCompoundEnv();const password=process.env.COMPOUND_V2_ADMIN_PASSWORD||process.env.COMPOUND_ADMIN_PASSWORD;if(!password)throw Error('Owner credential missing');
 const refresh=process.argv.includes('--refresh'),url='https://corvus.gent/api/compound-v2?'+(refresh?'reportJob=1&force=1':'report=1');
 const response=await fetch(url,{headers:{authorization:'Bearer '+password},signal:AbortSignal.timeout(60000)});if(!response.ok)throw Error('Report request failed ('+response.status+')');const data=await response.json();if(!data.report?.markdown)throw Error('No completed report yet');
 const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),target=path.join(root,'report.md'),temp=target+'.tmp';await fs.writeFile(temp,data.report.markdown,{mode:0o600});await fs.rename(temp,target);console.log(data.report.generated_at+' · report.md updated · '+data.report.posts+' published posts');
}catch(e){console.error('Compound report: '+e.message.replace(/https?:\/\/\S+/g,'[URL]'));process.exitCode=1;}
