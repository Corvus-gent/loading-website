const byId = id => document.getElementById(id);
const grid = byId('grid');
const more = byId('more');
const search = byId('search');
const collection = byId('collection');
let assets = [];
let matches = [];
let shown = 0;
let timer;
const make = (tag, css, text) => {
  const el = document.createElement(tag);
  if (css) el.className = css;
  if (text) el.textContent = text;
  return el;
};
async function copy(path, trigger) {
  const url = new URL(path, location.origin).href;
  try {
    await navigator.clipboard.writeText(url);
  } catch {
    const input = make('textarea');
    input.value = url;
    document.body.append(input);
    input.select();
    const copied = document.execCommand('copy');
    input.remove();
    trigger.focus();
    if (!copied) { window.prompt('Copy this URL', url); return; }
  }
  byId('notice').textContent = 'Copied ' + path;
  clearTimeout(timer);
  timer = setTimeout(() => { byId('notice').textContent = ''; }, 2500);
}
function card(asset) {
  const li = make('li', 'card');
  const frame = make('a', 'image');
  frame.href = asset.url;
  frame.setAttribute('aria-label','Open ' + asset.name);
  const image = make('img');
  image.loading = 'lazy';
  image.decoding = 'async';
  image.alt = '';
  image.src = asset.poster || asset.url;
  frame.append(image);
  const details = make('div','details');
  const info = make('div','info');
  info.append(make('span','',asset.collection), make('span','',asset.type.split('/')[1].split('+')[0] + ' · ' + Math.max(1,Math.round(asset.bytes/1000)) + ' kB'));
  const actions = make('div','actions');
  for (const [label, path] of [['Copy URL',asset.url], ['Copy short URL',asset.short]]) {
    const button = make('button','',label);
    button.type = 'button';
    button.addEventListener('click', () => copy(path,button));
    actions.append(button);
  }
  details.append(info,make('h2','name',asset.name),actions);
  li.append(frame,details);
  return li;
}
function showMore() {
  const batch = matches.slice(shown, shown + 36);
  grid.append(...batch.map(card));
  shown += batch.length;
  more.hidden = shown >= matches.length;
}
function filter() {
  const query = search.value.trim().toLowerCase();
  matches = assets.filter(asset => (!collection.value || asset.collection === collection.value) && (asset.name + ' ' + asset.id + ' ' + asset.type).includes(query));
  byId('count').textContent = matches.length.toLocaleString('en') + (matches.length === 1 ? ' file' : ' files');
  grid.replaceChildren();
  shown = 0;
  showMore();
}
try {
  const response = await fetch(document.documentElement.dataset.manifest);
  if (!response.ok) throw new Error();
  assets = await response.json();
  // Start with recognizable artwork from several collections.
  const preferred = ['captain-squawk','wing-flight','diogenes','arcade-mark','corvus-os-boot','whitney-logo','hero-sea','london-7658'];
  const featured = preferred.map(name => {
    const variants = assets.filter(asset => asset.name === name);
    return (variants.find(asset => asset.type === 'image/webp') || variants[0])?.id;
  });
  const rank = asset => { const i = featured.indexOf(asset.id); return i < 0 ? featured.length : i; };
  assets.sort((a,b) => rank(a)-rank(b) || a.name.localeCompare(b.name));
  for (const name of [...new Set(assets.map(asset => asset.collection))].sort()) collection.add(new Option(name,name));
  search.addEventListener('input',filter);
  collection.addEventListener('change',filter);
  more.addEventListener('click',showMore);
  filter();
} catch {
  byId('count').textContent = '';
  byId('error').hidden = false;
  byId('error').textContent = 'The asset index could not load. Reload to try again.';
}
