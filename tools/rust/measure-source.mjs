// Reproducible Git evidence, never inferred from working-tree size or commit messages.
import {execFileSync} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {sourceFile} from '../build-stats/source.mjs';
export const START='0a34babbba561abcffc1aa7e4356de4d8855adf7';
const git=(cwd,...args)=>execFileSync('git',args,{cwd,maxBuffer:256*1024*1024});
const sha=(cwd,ref)=>git(cwd,'rev-parse','--verify','--end-of-options',ref+'^{commit}').toString().trim();
export function category(file){
 if(!sourceFile(file))return null;
 // These are copied/generated compatibility data, not authored Rust implementation.
 if(file.startsWith('rust/migration/')||/^rust\/browser\/(?:pkg\/|[^/]+\.html$)/.test(file))return 'generatedCompatibility';
 if(/^(?:tests\/|tools\/|\.github\/)/.test(file))return 'verificationAndTooling';
 return 'application';
}
const lines=body=>body.includes(0)?null:body.reduce((n,c)=>n+(c===10),0)+(body.length&&body.at(-1)!==10?1:0);
function tree(cwd,ref){
 const entries=git(cwd,'ls-tree','-rz','--full-tree',ref).toString().split('\0').filter(Boolean).map(row=>{
  const tab=row.indexOf('\t'),meta=row.slice(0,tab).split(' ');return{path:row.slice(tab+1),hash:meta[2],type:meta[1]};
 }).filter(e=>e.type==='blob'&&category(e.path));
 const bytes=execFileSync('git',['cat-file','--batch'],{cwd,input:entries.map(e=>e.hash).join('\n')+'\n',maxBuffer:256*1024*1024});let offset=0;
 for(const e of entries){const end=bytes.indexOf(10,offset),size=Number(bytes.subarray(offset,end).toString().split(' ').at(-1));if(!Number.isSafeInteger(size))throw Error('Invalid Git object length');offset=end+1;e.lines=lines(bytes.subarray(offset,offset+size));e.category=category(e.path);offset+=size+1;}
 const counts={application:0,verificationAndTooling:0,generatedCompatibility:0};
 for(const e of entries)if(e.lines!==null)counts[e.category]+=e.lines;
 return{sha:ref,sourceFiles:entries.filter(e=>e.lines!==null).length,sourceLines:Object.values(counts).reduce((a,b)=>a+b,0),...counts};
}
function delta(cwd,base,head){
 const files=git(cwd,'diff','--numstat','-z','--no-renames',base,head,'--').toString().split('\0').filter(Boolean).map(row=>{
  const first=row.indexOf('\t'),second=row.indexOf('\t',first+1),file=row.slice(second+1),added=row.slice(0,first),removed=row.slice(first+1,second);
  return{path:file,added:/^\d+$/.test(added)?Number(added):null,removed:/^\d+$/.test(removed)?Number(removed):null,category:category(file)};
 }).filter(f=>f.category&&f.added!==null&&f.removed!==null);
 const groups={};for(const name of ['application','verificationAndTooling','generatedCompatibility']){
  const rows=files.filter(f=>f.category===name);groups[name]={files:rows.length,added:rows.reduce((n,f)=>n+f.added,0),removed:rows.reduce((n,f)=>n+f.removed,0)};groups[name].net=groups[name].added-groups[name].removed;
 }
 return{base,head,files,groups,added:files.reduce((n,f)=>n+f.added,0),removed:files.reduce((n,f)=>n+f.removed,0)};
}
export function sourceEvidence({cwd=process.cwd(),start=START,head='HEAD',upstream='origin/main'}={}){
 const h=sha(cwd,head),s=sha(cwd,start),u=sha(cwd,upstream),integrationBase=git(cwd,'merge-base',h,u).toString().trim();
 git(cwd,'merge-base','--is-ancestor',s,h);
 const sinceStart=delta(cwd,s,h),migration=delta(cwd,integrationBase,h),base=tree(cwd,integrationBase),current=tree(cwd,h);
 if(current.sourceLines-base.sourceLines!==migration.added-migration.removed)throw Error('Physical source counts do not reconcile with Git numstat');
 return{version:1,measuredAt:new Date().toISOString(),start:s,head:h,upstream:u,integrationBase,
  method:'Physical source lines, including comments and blank lines, with the existing /build source filter. JSON, lockfiles, binaries, vendored/minified code, public assets and client archives are excluded by that policy. Generated compatibility templates/SQL and verification/tooling are separated. Renames count as deletion plus addition. This is change volume, not completed migration percentage or performance.',
  caveat:'Original JavaScript remains until final cutover. Added Rust is staged implementation, not evidence that equivalent legacy lines have already been removed. Since-start totals also contain upstream feature work; the integration-base diff isolates the current branch contribution.',
  base,current,migration,sinceStart,workingTreeDirty:Boolean(git(cwd,'status','--porcelain','--untracked-files=no').toString().trim())};
}
export function sourceMarkdown(report){
 const table=Object.entries(report.migration.groups).map(([k,v])=>`| ${k} | ${v.files} | ${v.added} | ${v.removed} | ${v.net>=0?'+':''}${v.net} |`).join('\n');
 return `# Rust migration code ledger\n\nMeasured ${report.measuredAt}. Code head: \`${report.head}\`. Aligned upstream base: \`${report.integrationBase}\`. Frozen start: \`${report.start}\`.\n\n| Scope | Files changed | Added | Removed | Net |\n|---|---:|---:|---:|---:|\n${table}\n\nThe aligned Git diff is +${report.migration.added} / −${report.migration.removed} source lines. The source tree totals ${report.base.sourceLines} → ${report.current.sourceLines} physical lines.\n\n${report.method}\n\n${report.caveat}\n\nThe JSON contains every counted path and both comparisons. Working-tree edits are excluded; dirty at measurement: ${report.workingTreeDirty}.\n`;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const opts=Object.fromEntries(process.argv.slice(2).map(v=>v.split(/=(.*)/s).slice(0,2))),out=opts['--out']||'test-results/rust/measurements';
 const report=sourceEvidence({start:opts['--start']||START,head:opts['--head']||'HEAD',upstream:opts['--upstream']||'origin/main'});await mkdir(out,{recursive:true});
 const file=path.join(out,`source-${report.head.slice(0,12)}`);await writeFile(file+'.json',JSON.stringify(report,null,2)+'\n');await writeFile(file+'.md',sourceMarkdown(report));
 console.log(JSON.stringify({head:report.head,integrationBase:report.integrationBase,groups:report.migration.groups,sourceLines:report.current.sourceLines,json:file+'.json',markdown:file+'.md'}));
}
