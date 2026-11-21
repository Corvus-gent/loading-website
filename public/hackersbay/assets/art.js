const root = '/public/hackersbay/art/';
const images = new Map();

export function artPicture(name, {width, height, alt = '', lazy = true, className = ''} = {}) {
  const picture = document.createElement('picture');
  picture.className = 'pixel-art ' + className;
  const webp = document.createElement('source');
  webp.type = 'image/webp';
  webp.srcset = root + name + '.webp';
  const img = document.createElement('img');
  img.src = root + name + '.png';
  img.alt = alt;
  img.decoding = 'async';
  if (width) img.width = width;
  if (height) img.height = height;
  if (lazy) img.loading = 'lazy';
  picture.append(webp, img);
  return picture;
}

export function loadArt(name) {
  if (images.has(name)) return images.get(name);
  const load = format => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = root + name + '.' + format;
  });
  const job = load('webp').catch(() => load('png')).catch(error => {
    images.delete(name);
    throw error;
  });
  images.set(name, job);
  return job;
}

export const CLASS_ART = {
  hacker: 'deckhand',
  builder: 'navigator',
  connector: 'quartermaster',
  investor: 'merchant'
};
export const classArt = type => 'crew-' + (CLASS_ART[type] || CLASS_ART.hacker);

export const FLEET_POSES = new Set(['wave', 'typing', 'flying', 'squawk', 'thumbs-up', 'celebrate']);
export function captainArt(pose, options = {}) {
  const sprite = FLEET_POSES.has(pose) ? 'squawk-' + pose : pose === 'sitting' ? 'captain-squawk-sitting' : 'captain-squawk';
  const size = FLEET_POSES.has(pose) ? {width:150,height:150} : {width:192,height:230};
  return artPicture(sprite, {...size, ...options});
}
