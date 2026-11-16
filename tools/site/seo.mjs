import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import sharp from 'sharp';
import {inventory} from './link-inventory.mjs';
import {ALIASES} from './generate-directory.mjs';
import {pagePath, noIndex} from '../../js/site/indexing.js';
const ROOT = 'https://corvus.gent';
export const pages = [
  ['/', 'Corvus · one man. an army of builders.', 'Corvus is a community for driven people, in any field. We build in public, share what we know and help each other win.'],
  ['/realm/', 'The realm · pick a door | Corvus', 'Games, field notes, music and a few secrets. Pick a light. See where it leads.'],
  ['/legion/', 'The Legion · build something worth joining | Corvus', '$1 once gets you in as Tiro. Higher ranks are earned. Meet the people building, opening doors and backing each other.'],
  ['/gabe/', 'Gabe · builder, fighter, sidequest collector | Corvus', 'Belgian builder in San Francisco. BJJ, startups and too many sidequests. Here’s what I’m making and how to reach me.', '/public/gabe.jpg', 'Gabe.'],
  ['/daily/', 'Daily · come back curious | Corvus', 'Play a puzzle. Pick a track. Find something you missed. A small reason to come back.'],
  ['/call/', 'Book a call with Gabe | Corvus', 'Got a project, a question or a good reason to talk? Book a call with Gabe. Bring the thing you want to make happen.'],
  ['/support/', 'Support · people I’d vouch for | Corvus', 'People, companies, books and ideas I’d vouch for. No grand theory. Just good work worth passing on.'],
  ['/sf/larp/', 'SF LARPing · Gabe in the field | Corvus', 'Hackathons, giant ducks and the occasional Golden Gate pitch. Gabe out in San Francisco, with photographic evidence.', '/sf/larp/photos/golden-gate.webp', 'Gabe holds a box beside the bay, with the Golden Gate Bridge behind him.'],
  ['/wiki/', 'Corvuspedia · birds, builds and rabbit holes | Corvus', 'The crow, the pigeon and the stories behind Corvus. Follow a reference. Fall down a rabbit hole.'],
  ['/quests/', 'Quests · things built, lessons earned | Corvus', 'A running record of things built, tried and learned. Hackathons, experiments and receipts from the work.'],
  ['/map/', 'The whole map · every Corvus door | Corvus', 'Every public corner of Corvus, grouped by what you’re looking for. Find a page, meet a person or take the long way round.']
];
export const escape = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const attribute = (tag, name) => new RegExp('\\s' + name + '\\s*=\\s*(["\'])(.*?)\\1','i').exec(tag)?.[2];
const metaKeys = new Set(['description','twitter:card','twitter:title','twitter:description','twitter:image','twitter:image:alt']);
function editHead(html, transform) {
  let found = false;
  const result = html.replace(/(<head\b[^>]*>)([\s\S]*?)(<\/head>)/i,(_,open,head,close)=>{found=true;return open+transform(head)+close;});
  if (!found) throw Error('Missing HTML head');
  return result;
}
export function metadata(html, row, dimensions) {
  return editHead(html, html => {
    const [path,title,description,image='/og.png',alt='Corvus share card.'] = row;
    const url = ROOT + path;
    html = html.replace(/<title\b[^>]*>[\s\S]*?<\/title>/gi,'').replace(/<link\b[^>]*>/gi,tag => attribute(tag,'rel')?.toLowerCase() === 'canonical' ? '' : tag);
    html = html.replace(/<meta\b[^>]*>/gi,tag => {
      const key = (attribute(tag,'property') || attribute(tag,'name') || '').toLowerCase();
      return key.startsWith('og:') || metaKeys.has(key) ? '' : tag;
    });
    const tags = {description,'og:type':'website','og:site_name':'Corvus','og:title':title,'og:description':description,'og:url':url,
      'og:image':ROOT+image,'og:image:secure_url':ROOT+image,'og:image:type':'image/'+(dimensions.format==='jpeg'?'jpeg':dimensions.format),
      'og:image:width':dimensions.width,'og:image:height':dimensions.height,'og:image:alt':alt,
      'twitter:card':'summary_large_image','twitter:title':title,'twitter:description':description,'twitter:image':ROOT+image,'twitter:image:alt':alt};
    const head = '<title>'+escape(title)+'</title><link rel="canonical" href="'+escape(url)+'">' +
      Object.entries(tags).map(([key,value])=>'<meta '+(key.startsWith('og:')?'property':'name')+'="'+key+'" content="'+escape(value)+'">').join('');
    return html + head;
  });
}
function preventIndexing(html) {
  return editHead(html,head => head.replace(/<meta\b[^>]*>/gi,tag => attribute(tag,'name')?.toLowerCase() === 'robots' ? '' : tag) + '<meta name="robots" content="noindex, nofollow">');
}
export const sitemap = urls => '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  [...new Set(urls)].sort().map(url=>'  <url><loc>'+escape(url)+'</loc></url>').join('\n')+'\n</urlset>\n';
export async function buildSEO() {
  for (const row of pages) {
    const file = row[0] === '/' ? 'index.html' : row[0].slice(1)+'index.html';
    const dimensions = await sharp('.'+(row[3] || '/og.png')).metadata();
    await fs.writeFile(file,metadata(await fs.readFile(file,'utf8'),row,dimensions));
    if (row[0] === '/') await fs.writeFile('public/realm-entry.html',metadata(await fs.readFile('public/realm-entry.html','utf8'),row,dimensions));
  }
  const data = await inventory(), config = JSON.parse(await fs.readFile('vercel.json','utf8'));
  const aliases = new Set([...Object.keys(ALIASES), '/hack/the-feed','/soldier','/enlist','/squads', ...config.redirects.map(r=>pagePath(r.source))]);
  const all = [...data.routes,...data.excluded], documents = new Map();
  for (const item of all) if (item.file?.endsWith('.html') && !documents.has(item.file)) documents.set(item.file,await fs.readFile(item.file,'utf8'));
  for (const [file,html] of documents) {
    const path = '/'+file.replace(/index\.html$/,'');
    if (noIndex(path) || file === '404.html') { const updated=preventIndexing(html); await fs.writeFile(file,updated); documents.set(file,updated); }
  }
  const videos = (JSON.parse(await fs.readFile('data/site-public-content.json','utf8')).videos || []).filter(v=>!v.is_example);
  const urls = {main:new Set(pages.map(p=>ROOT+p[0])), stats:new Set()};
  for (const item of data.routes) {
    const url = new URL(item.path,ROOT); url.search=''; url.hash='';
    if (noIndex(url) || aliases.has(pagePath(url))) continue;
    if (['language','hook'].includes(item.kind)) {
      const [, , , lang, hook] = url.pathname.split('/');
      if (!videos.some(v=>v.lang===lang && (!hook || v.hook===hook))) continue;
    }
    const html = documents.get(item.file) || '';
    if (/<meta\b[^>]*http-equiv\s*=\s*["']refresh["']/i.test(html) || /<meta\b[^>]*name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(html)) continue;
    const main = url.hostname === 'corvus.gent';
    const configured = main && pages.find(p=>pagePath(p[0]) === pagePath(url));
    if (configured) { urls.main.add(ROOT+configured[0]); continue; }
    const canonical = [...html.matchAll(/<link\b[^>]*>/gi)].map(m=>m[0]).find(tag=>attribute(tag,'rel')?.toLowerCase()==='canonical');
    const declared = canonical && attribute(canonical,'href');
    if (declared && !item.kind) {
      const preferred = new URL(declared.replaceAll('&amp;','&'),url);
      if (preferred.hostname !== url.hostname || pagePath(preferred)!==pagePath(url)) continue;
      url.pathname=preferred.pathname;
    } else if (!item.kind && item.file?.endsWith('index.html')) {
      const filePath = '/'+item.file.replace(/^stats\//,'').replace(/index\.html$/,'');
      if (pagePath(filePath)===pagePath(url) && url.pathname!=='/') url.pathname=pagePath(url)+'/';
    }
    if (['corvus.gent','stats.corvus.gent'].includes(url.hostname)) urls[main?'main':'stats'].add(url.href);
  }
  for (const [host,folder,list] of [['corvus.gent','',urls.main],['stats.corvus.gent','stats/',urls.stats]]) {
    await fs.writeFile(folder+'sitemap.xml',sitemap(list));
    // Let crawlers read noindex directives. Authentication still protects content.
    await fs.writeFile(folder+'robots.txt','User-agent: *\nAllow: /\nSitemap: https://'+host+'/sitemap.xml\n');
  }
  console.log('SEO:',pages.length,'main pages;',urls.main.size,'main and',urls.stats.size,'stats sitemap URLs; private pages excluded.');
  return urls;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await buildSEO();
