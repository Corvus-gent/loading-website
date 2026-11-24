import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const html=readFileSync('corgi/index.html','utf8');
const letter=html.split('<body>')[1].split('<script>')[0]
  .replace(/<aside class="corgi-travel-strip"[\s\S]*?<\/aside>/,'')
  .replace('<p class="corgi-photo-link"><a href="/corgi/gallery">See the photos: three Corgi cafés, with dates →</a></p>','')
  .replace(/<p class="colophon">[\s\S]*?<\/p>/,'')
  .replace(/<aside class="secret-note"[\s\S]*?<\/aside>/,'')
  .replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim();
assert.equal(createHash('sha256').update(letter).digest('hex'),'84f5c5d5ad9a7e1708e1af06b87b715a5169718c32f05c3f44c48f227c681859','Approved letter copy must remain unchanged');
assert.match(html,/<meta name="robots" content="noindex">/);
assert(!html.includes('/js/analytics.js'));
console.log('Corgi: approved letter copy, noindex and standalone privacy preserved.');
