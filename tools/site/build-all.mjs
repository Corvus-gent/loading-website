import {execFileSync} from 'node:child_process';
// Resolve drop-in artwork at build time so missing logos never cause browser requests.
import {existsSync, readFileSync, writeFileSync} from 'node:fs';

const stackPage = new URL('../../the6cube/stack/index.html', import.meta.url);
const html = readFileSync(stackPage, 'utf8');
const optional = /<template data-stack-logo="([a-z]+)"><\/template>/g;
const output = html.replace(optional, (placeholder, name) => {
  const src = 'logos/' + name + '.svg';
  return existsSync(new URL(src, stackPage)) ? `<img src="${src}" alt="">` : placeholder;
});
if (output !== html) writeFileSync(stackPage, output);

execFileSync("node", ["tools/site/build-hall-shader.mjs"], {stdio:"inherit"});
execFileSync("node", ["tools/plethora/verify-routes.mjs"], {stdio:'inherit'});
execFileSync("node", ["tools/build-gabinho-rolls.mjs"], {stdio:'inherit'});
execFileSync("node", ["tools/build-battle.mjs"], {stdio:'inherit'});
execFileSync("node", ["tools/build-hackathons.mjs"], {stdio:'inherit'});
execFileSync("node", ["tools/build-plethora.mjs"], {stdio:'inherit'});
execFileSync('node', ['tools/cv/build-bougie.mjs'], {stdio:'inherit'});
execFileSync('node', ['tools/cv/build-hospitality.mjs'], {stdio:'inherit'});
// Compile CV profiles before discovery scans the static routes.
execFileSync("node", ["tools/cv/build.mjs"], {stdio:'inherit'});
execFileSync("node", ["tools/site/build.mjs"], {stdio:'inherit'});
execFileSync("python3", ["tools/build-search.py"], {stdio:'inherit'});

// Render feedback forms after site chrome so the Sonar design stays isolated.
execFileSync("node", ["tools/forms/build.mjs"], {stdio:'inherit'});

// Localized CV output is compiled last, outside the general site chrome.
execFileSync("node", ["tools/philosophy/build.mjs"], {stdio:'inherit'});

// Inline Hackers Bay landing styles into its static deployment output.
execFileSync("node", ["lib/hackersbay/build-landing.js"], {stdio:'inherit'});

// Bundle the isolated Ray storefront interactions without changing site chrome.
execFileSync("node", ["app/raygifts/build.mjs"], {stdio:'inherit'});
