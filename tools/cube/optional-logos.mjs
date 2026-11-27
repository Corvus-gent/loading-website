// Resolve drop-in artwork at build time so missing logos never cause browser requests.
import {existsSync, readFileSync, writeFileSync} from 'node:fs';

const page = new URL('../../the6cube/stack/index.html', import.meta.url);
const html = readFileSync(page, 'utf8');
const optional = /<template data-stack-logo>(<img src="(logos\/[\w-]+\.svg)"[^>]*>)<\/template>/g;
const output = html.replace(optional, (template, image, file) =>
  existsSync(new URL(file, page)) ? image : template);
if (output !== html) writeFileSync(page, output);
