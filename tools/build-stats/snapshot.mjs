import fs from 'node:fs/promises';import{execFileSync}from'node:child_process';import{sourceFile}from'./source.mjs';
const config=JSON.parse(await fs.readFile('build/config.json','utf8'));
const git=(...args)=>execFileSync('git',args,{encoding:'utf8',maxBuffer:80e6});
const ref=process.env.BUILD_GIT_REF||'HEAD';
const log=git('log',ref,'--first-parent','--reverse','--format=%x1e%H%x09%cI%x09%s','--numstat','--no-renames','--diff-merges=first-parent');
let total=0;const commits=[],history=[];
for(const block of log.split('\x1e').filter(x=>x.trim())){const[header,...lines]=block.trim().split('\n'),[sha,date,...title]=header.split('\t');let added=0,removed=0;const files=[];
 for(const line of lines){const[a,d,file]=line.split('\t');if(file&&sourceFile(file)&&/^\d+$/.test(a)&&/^\d+$/.test(d)){added+=Number(a);removed+=Number(d);files.push(file);}}
 total+=added-removed;commits.push({sha,date,added,removed,files});history.push({date,lines:total});
}
const now=new Date().toISOString(),warnings=[];
let previous={};try{previous=JSON.parse(await fs.readFile('build/seed.json','utf8'));}catch{}
async function github(path){const r=await fetch('https://api.github.com/'+path,{headers:{Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28',...(process.env.GITHUB_TOKEN?{Authorization:'Bearer '+process.env.GITHUB_TOKEN}:{})},signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('GitHub '+r.status);return r.json();}
let prs=previous.prs||[],activity=previous.activity||null,deployments=previous.deployments??null;
const refresh=await Promise.allSettled([
 (async()=>{const rows=[];for(let page=1;page<=20;page++){const batch=await github(`repos/${config.repo}/pulls?state=closed&sort=updated&direction=desc&per_page=100&page=${page}`);for(const p of batch)if(p.merged_at)rows.push({number:p.number,title:p.title,url:p.html_url,date:p.merged_at,live:Object.entries(config.livePages).find(([key])=>p.title.toLowerCase().includes(key))?.[1]||null});if(batch.length<100)break;}return rows.sort((a,b)=>b.date.localeCompare(a.date));})(),
 (async()=>{const rows=[];for(let page=1;page<=3;page++){const batch=await github(`users/${config.user}/events/public?per_page=100&page=${page}`);rows.push(...batch);if(batch.length<100)break;}return {sampled:rows.length,since:rows.at(-1)?.created_at||now,updated:now,counts:Object.fromEntries([...new Set(rows.map(x=>x.type))].map(type=>[type,rows.filter(x=>x.type===type).length]))};})(),
 (async()=>{if(!process.env.VERCEL_TOKEN)throw Error('Vercel token unavailable');const rows=[];let until;for(let page=0;page<100;page++){const q=new URLSearchParams({projectId:'prj_lMs6LG5fIdeSfIfD0XupJyfEijOb',teamId:'team_82MZuXn3ohtjMdoSZmw99vai',limit:'100',...(until?{until:String(until)}:{})});const r=await fetch('https://api.vercel.com/v6/deployments?'+q,{headers:{Authorization:'Bearer '+process.env.VERCEL_TOKEN},signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('Vercel '+r.status);const data=await r.json();rows.push(...data.deployments.filter(x=>x.state==='READY'||x.readyState==='READY').map(x=>({id:x.uid,date:new Date(x.createdAt||x.created).toISOString(),target:x.target||'preview'})));until=data.pagination?.next;if(!until)break;}return [...new Map(rows.map(x=>[x.id,x])).values()];})()
]);
for(const[i,r]of refresh.entries()){if(r.status==='fulfilled'){if(i===0)prs=r.value;if(i===1)activity=r.value;if(i===2)deployments=r.value;}else warnings.push(['pull requests','public activity','deployments'][i]+' refresh unavailable; last known data retained');}
const milestones=config.milestones.map(m=>{const idx=log.split('\x1e').filter(x=>x.trim()).findIndex(block=>block.split('\n')[0].toLowerCase().includes(m.match));return idx<0?null:{...m,date:commits[idx].date,lines:history[idx].lines};}).filter(Boolean);
const data={version:1,updated:now,config,sha:git('rev-parse',ref).trim(),total,sourceFiles:git('ls-tree','-r','--name-only',ref).trim().split('\n').filter(sourceFile).length,commits,history,prs,deployments,activity,milestones,warnings,method:'First-parent Git history; merge diffs against first parent. Physical lines, including blank lines and comments. JSON, lockfiles, libraries, public assets, client-site archives, build output and minified files excluded. Successful Vercel deployments include previews; provider-retained history only.'};
const output=process.env.BUILD_OUTPUT||'build/seed.json';await fs.writeFile(output,JSON.stringify(data));
if(process.env.BUILD_INGEST_URL&&process.env.BUILD_INGEST_TOKEN){const r=await fetch(process.env.BUILD_INGEST_URL,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+process.env.BUILD_INGEST_TOKEN},body:JSON.stringify(data),signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error('Snapshot publish failed: '+r.status);}
console.log(JSON.stringify({total,commits:commits.length,prs:prs.length,deployments:deployments?.length??null,warnings}));
