import fs from 'node:fs';
import {ROLE_ADDRESSES} from '../lib/email/addresses.js';
// Static HTML/JSON are generated outputs. Normalize contacts after every site build.
function files(directory = '.') {
  return fs.readdirSync(directory, {withFileTypes:true}).flatMap(entry => {
    if (entry.name.startsWith('.') || ['node_modules','docs','tests'].includes(entry.name)) return [];
    const path = directory === '.' ? entry.name : directory + '/' + entry.name;
    return entry.isDirectory() ? files(path) : entry.isFile() ? [path] : [];
  });
}
// Vercel source archives need not contain Git metadata.
for (const file of files()) {
  if (!/\.(html|json)$/.test(file) || /^(docs|tests)\//.test(file)) continue;
  const source = fs.readFileSync(file, 'utf8');
  const output = source.replace(/\{\{email:(\w+)\}\}/g, (_, role) => {
    if (!ROLE_ADDRESSES[role]) throw Error('Unknown email role: ' + role);
    return ROLE_ADDRESSES[role];
  }).replace(/(?:gabriel|hello|billing|legion|hack|press|security)@corvus\.gent/g, address => ROLE_ADDRESSES[address.split('@')[0] === 'gabriel' ? 'hello' : address.split('@')[0]]);
  const normalized = output.replace(/(<(?:meta|link)\b[^>]*(?:property=["']og:url["']|rel=["']canonical["'])[^>]*(?:content|href)=["'])https:\/\/stats\.corvus\.gent\/?/gi, '$1https://corvus.gent/stats/');
  if (normalized !== source) fs.writeFileSync(file, normalized);
}
