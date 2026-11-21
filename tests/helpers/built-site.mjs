// Build the publishing artifact without changing any files in the worktree.
import {execFileSync} from 'node:child_process';
import {mkdtemp,mkdir,copyFile,symlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
export async function buildFixture(beforeBuild=async()=>{}){
 const source=process.cwd(),root=await mkdtemp(path.join(tmpdir(),'corvus-built-site-'));
 try{
  const files=execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
  for(const file of files){await mkdir(path.dirname(path.join(root,file)),{recursive:true});await copyFile(path.join(source,file),path.join(root,file));}
  await symlink(path.join(source,'node_modules'),path.join(root,'node_modules'),'dir');
  await beforeBuild(root);
  execFileSync('node',['tools/site/build-all.mjs'],{cwd:root,stdio:'pipe',timeout:120000});
  return{root,files,close:()=>rm(root,{recursive:true,force:true})};
 }catch(error){await rm(root,{recursive:true,force:true});throw error;}
}
