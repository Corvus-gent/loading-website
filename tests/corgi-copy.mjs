import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const html=readFileSync('corgi/index.html','utf8');
const letter=html.split('<body>')[1].split('<script>')[0]
  .replace(/<p class="colophon">[\s\S]*?<\/p>/,'')
  .replace(/<aside class="secret-note"[\s\S]*?<\/aside>/,'')
  .replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim();
assert.equal(createHash('sha256').update(letter).digest('hex'),'57833c72ffdf86d55b8f373b3563f71c725ab6a26dcedb851e23341bae142ade','Original letter copy must remain unchanged');
assert.match(html,/<meta name="robots" content="noindex">/);
assert(!html.includes('/js/analytics.js'));
console.log('Corgi: original letter copy, noindex and standalone privacy preserved.');
