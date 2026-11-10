import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
function walk(dir='.') { return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=> { if(['node_modules','.git','.vercel','.venv','test-results','playwright-report'].includes(e.name))return []; const f=path.join(dir,e.name); return e.isDirectory()?walk(f):[f]; }); }
const files=walk();
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'corvus-syntax-'));
let count=0;
try {
 for(const file of files){
  if(file.includes('/vendor/')||file.startsWith('node_modules/'))continue;
  if(/\.(m?js)$/.test(file)){execFileSync(process.execPath,['--check',file],{stdio:'pipe'});count++;}
  if(file.endsWith('.html')){
   const html=fs.readFileSync(file,'utf8');
   for(const [i,match] of [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].entries()){
    if(/\bsrc=/.test(match[1])||/type=["'](?:application\/ld\+json|application\/json|importmap)/.test(match[1])||!match[2].trim())continue;
    const dest=path.join(temporary,`inline-${count}-${i}.mjs`);fs.writeFileSync(dest,match[2]);
    try{execFileSync(process.execPath,['--check',dest],{stdio:'pipe'});}catch(error){throw new Error(`Invalid inline JavaScript in ${file}: ${error.stderr}`);}
    count++;
   }
  }
 }
 console.log(`JavaScript syntax: ${count} modules / inline scripts checked.`);
} finally { fs.rmSync(temporary,{recursive:true,force:true}); }
