// Match the repository's existing CI syntax and locale checks without new dependencies.
import {execFileSync} from 'node:child_process';
const tracked=execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0');
const extra=['lib/philosophy/page.mjs','tools/philosophy/build.mjs','tools/lint.mjs','js/philosophy-page.js','tests/philosophy-cv.mjs'];
import fs from 'node:fs';
const files=[...new Set([...tracked,...extra])].filter(p=>/\.(?:js|mjs)$/.test(p)&&fs.existsSync(p));
for(const file of files)execFileSync(process.execPath,['--check',file],{stdio:'inherit'});
execFileSync(process.execPath,['tools/check-locales.mjs'],{stdio:'inherit'});
console.log(`Lint: ${files.length} JavaScript modules and locale contracts passed.`);
