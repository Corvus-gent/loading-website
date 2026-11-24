import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const html=readFileSync('corgi/index.html','utf8');
const letter=html.split('<body>')[1].split('<script>')[0]
  .replace(/<p class="colophon">[\s\S]*?<\/p>/,'')
  .replace(/<aside class="secret-note"[\s\S]*?<\/aside>/,'')
  .replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim();
assert.equal(createHash('sha256').update(letter).digest('hex'),'1864ceac871dcd8c4b1a1c18ae3a0ff9853221d0788732b52853ce1c10c1e29e','Approved letter copy must remain unchanged');
assert.match(html,/<meta name="robots" content="noindex">/);
assert(!html.includes('/js/analytics.js'));
console.log('Corgi: approved letter copy, noindex and standalone privacy preserved.');
