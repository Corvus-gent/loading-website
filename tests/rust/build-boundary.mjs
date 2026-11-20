// Check the actual publishing build, including the non-page HTML inputs.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {buildFixture} from '../helpers/built-site.mjs';
const fragment='rust/browser/live-banner.html',before=await readFile(fragment);
const fixture=await buildFixture(async root=>{
 await mkdir(path.join(root,'target','nested'),{recursive:true});
 await writeFile(path.join(root,'target','nested','index.html'),'<html><head><title>PRIVATE BUILD INPUT</title></head><body>not a public page</body></html>');
});
try{
 assert.deepEqual(await readFile(path.join(fixture.root,fragment)),before,'publishing must never mutate Rust HTML fragments');
 for(const file of ['site-directory.json','js/site/routes.js','search-index.json'])assert(!/PRIVATE BUILD INPUT|\/rust\/|\/target\//.test(await readFile(path.join(fixture.root,file),'utf8')),file+' excludes internal compiler inputs');
 console.log('PASS: full publishing build preserves Rust source; directory, map and search contain no compiler inputs.');
}finally{await fixture.close();}
