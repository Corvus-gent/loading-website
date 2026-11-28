// Build static aliases so GET, HEAD and byte ranges use the same Vercel file.
import {createHash} from 'node:crypto';
import {link, mkdir, readFile, readdir, rm, stat, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const assets = path.join(root, 'public/assets');
const aliases = path.join(root, '_asset-files');
const collections = ['brand', 'court', 'cube', 'council', 'readme', 'site', '_private'];
const posters = JSON.parse(await readFile(new URL('./asset-posters.json', import.meta.url)));
const index = [];
const hashes = new Map();
const types = {jpg:'image/jpeg', png:'image/png', webp:'image/webp', gif:'image/gif', svg:'image/svg+xml', ico:'image/x-icon', mp4:'video/mp4', webm:'video/webm', avif:'image/avif'};
const space = 36n ** 8n;
await rm(aliases, {force:true, recursive:true});
await mkdir(aliases);
for (const collection of collections) {
  const dir = path.join(assets, collection);
  await mkdir(dir, {recursive:true});
  for (const file of (await readdir(dir)).sort()) {
    const ext = path.extname(file).slice(1);
    if (!Object.hasOwn(types, ext)) throw new Error('Unknown asset type: ' + file);
    const local = path.join(dir, file);
    const bytes = await readFile(local);
    const hash = createHash('sha256').update(bytes).digest('hex');
    const id = (BigInt('0x' + hash) % space).toString(36).padStart(8, '0');
    if (hashes.has(id)) throw new Error('Duplicate content or short ID collision: ' + file + ' / ' + hashes.get(id));
    hashes.set(id, file);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*\.[a-z0-9]+$/.test(file) || !file.endsWith('-' + id + '.' + ext)) {
      throw new Error('Expected a content-versioned English filename ending in -' + id + '.' + ext + ': ' + file);
    }
    const key = id + '.' + ext;
    await link(local, path.join(aliases, key));
    if (collection === '_private') continue;
    const url = '/assets/' + collection + '/' + file;
    const item = {id, name:file.slice(0, -(key.length + 1)), collection, type:types[ext], bytes:bytes.length, url, short:'/a/' + key};
    const poster = posters[url.slice(1)];
    if (poster) {
      if (!poster.startsWith('assets/' + collection + '/')) throw new Error('Invalid poster for ' + file);
      await stat(path.join(root, 'public', poster));
      item.poster = '/' + poster;
    }
    index.push(item);
  }
}
const manifest = JSON.stringify(index) + '\n';
await writeFile(path.join(assets, 'manifest.json'), manifest);
// The document selects a new cache key whenever the immutable index changes.
const version = createHash('sha256').update(manifest).digest('hex').slice(0, 16);
const gallery = path.join(root, 'public/asset-library/index.html');
const html = await readFile(gallery, 'utf8');
await writeFile(gallery, html.replace(/data-manifest="[^"]*"/, 'data-manifest="/assets/manifest.json?v=' + version + '"'));

const configFile = path.join(root, 'vercel.json');
const config = JSON.parse(await readFile(configFile));
const rules = [
  {source:'/assets', destination:'/public/asset-library/index.html'},
  {source:'/assets/manifest.json', destination:'/public/assets/manifest.json'},
  {source:'/assets/:collection(brand|court|cube|council|readme|site)/:name', destination:'/public/assets/:collection/:name'},
  {source:'/a/:id([a-z0-9]{8}).:ext', destination:'/_asset-files/:id.:ext'},
];
const owned = new Set(rules.map(rule => rule.source));
config.rewrites = [...rules, ...config.rewrites.filter(rule => !owned.has(rule.source))];
await writeFile(configFile, JSON.stringify(config, null, 2) + '\n');
console.log(index.length + ' public entries, ' + hashes.size + ' static aliases');
