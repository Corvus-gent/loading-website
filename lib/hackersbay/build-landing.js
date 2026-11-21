import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../../public/hackersbay/', import.meta.url);
const [html, css] = await Promise.all([
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('assets/bay.css', root), 'utf8')
]);
const link = '<link rel="stylesheet" href="/public/hackersbay/assets/bay.css">';
if (!html.includes(link)) throw new Error('Hackers Bay stylesheet link missing from the landing template');

// Combine the static landing and its stylesheet so the first paint needs only the document.
const inline = css.replace(/url\("([^"]+)"\)/g, (match, url) =>
  /^(?:[a-z][a-z\d+.-]*:|[/#])/i.test(url) ? match : 'url("/public/hackersbay/assets/' + url + '")'
);
await writeFile(new URL('landing.generated.html', root), html.replace(link, () => '<style>\n' + inline.trim() + '\n</style>'));
