import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
const files = [...new Set([...execFileSync('git', ['ls-files'], {encoding:'utf8'}).trim().split('\n'), ...execFileSync('git', ['ls-files', '--others', '--exclude-standard'], {encoding:'utf8'}).trim().split('\n')])];
let checked = 0;
for (const file of files) {
  if (!/\.(js|mjs)$/.test(file) || /vendor\//.test(file)) continue;
  execFileSync(process.execPath, ['--check', file], {stdio:'pipe'}); checked++;
}
JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
execFileSync('git', ['diff', '--check'], {stdio:'inherit'});
console.log(`Syntax lint passed: ${checked} JavaScript modules and Vercel config`);
