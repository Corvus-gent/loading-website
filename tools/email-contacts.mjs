import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {ROLE_ADDRESSES} from '../lib/email/addresses.js';
// Static HTML/JSON are generated outputs. Normalize contacts after every site build.
for (const file of execFileSync('git', ['ls-files'], {encoding:'utf8'}).trim().split('\n')) {
  if (!/\.(html|json)$/.test(file) || /^(docs|tests)\//.test(file)) continue;
  const source = fs.readFileSync(file, 'utf8');
  const output = source.replace(/\{\{email:(\w+)\}\}/g, (_, role) => {
    if (!ROLE_ADDRESSES[role]) throw Error('Unknown email role: ' + role);
    return ROLE_ADDRESSES[role];
  }).replace(/(?:gabriel|hello|billing|legion|hack|press|security)@corvus\.gent/g, address => ROLE_ADDRESSES[address.split('@')[0] === 'gabriel' ? 'hello' : address.split('@')[0]]);
  const normalized = output.replace(/(<(?:meta|link)\b[^>]*(?:property=["']og:url["']|rel=["']canonical["'])[^>]*(?:content|href)=["'])https:\/\/stats\.corvus\.gent\/?/gi, '$1https://corvus.gent/stats/');
  if (normalized !== source) fs.writeFileSync(file, normalized);
}
