// Run the actual publishing build in a disposable copy, never in the worktree.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtemp,readFile,writeFile,mkdir,copyFile,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
const root=process.cwd(),temp=await mkdtemp(path.join(tmpdir(),'corvus-rust-build-'));
try{
 const files=execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
 for(const file of files){await mkdir(path.dirname(path.join(temp,file)),{recursive:true});await copyFile(path.join(root,file),path.join(temp,file));}
 await symlink(path.join(root,'node_modules'),path.join(temp,'node_modules'),'dir');
 const fragment='rust/browser/live-banner.html',before=await readFile(path.join(root,fragment));
 await mkdir(path.join(temp,'target','nested'),{recursive:true});
 await writeFile(path.join(temp,'target','nested','index.html'),'<html><head><title>PRIVATE BUILD INPUT</title></head><body>not a public page</body></html>');
 execFileSync('node',['tools/site/build-all.mjs'],{cwd:temp,stdio:'pipe',timeout:120000});
 assert.deepEqual(await readFile(path.join(temp,fragment)),before,'publishing must never mutate Rust HTML fragments');
 for(const file of ['site-directory.json','js/site/routes.js','search-index.json'])assert(!/PRIVATE BUILD INPUT|\/rust\/|\/target\//.test(await readFile(path.join(temp,file),'utf8')),file+' excludes internal compiler inputs');
 console.log('PASS: full publishing build preserves Rust source; directory, map and search contain no compiler inputs.');
}finally{await rm(temp,{recursive:true,force:true});}
