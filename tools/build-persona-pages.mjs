// Social crawlers do not run JS. Generate their HTML from the same data as the
// interactive hubs. Run after editing personas.json or its HTML template.
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const profiles = JSON.parse(await readFile('personas.json', 'utf8'));
let template = await readFile('tools/templates/links.html.tmpl', 'utf8');
for (const [, file] of template.matchAll(/(?:href|src)="(\/[^"]+\.(?:js|css))"/g)) {
  const hash = createHash('sha256').update(await readFile('.' + file)).digest('hex').slice(0,12);
  template = template.replace('"' + file + '"', '"' + file + '?v=' + hash + '"');
}
const escape = value => value.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
for (const [id, persona] of Object.entries(profiles)) {
  const dir = id === 'gabe' ? 'links' : 'links/' + id;
  const fields = {...persona.preview, name:persona.name, id};
  const page = template.replace(/{{(\w+)}}/g, (_, key) => escape(fields[key]));
  await mkdir(dir, {recursive:true});
  await writeFile(dir + '/index.html', page);
}
