import hostedImages from './hosted-images.json' with {type: 'json'};

function hostedImage(image) {
  const url = new URL(image.src);
  const full = hostedImages[url.href];
  if (!full) return image;
  url.searchParams.set('width', '480');
  const card = hostedImages[url.href] || full;
  url.searchParams.set('width', '800');
  return {...image, hosted: { full, card, detail: hostedImages[url.href] || full }};
}

export const store = 'https://raygifts-2.myshopify.com';
export const title = 'Ray — Gifts for the quiet hour';
export const description = 'Put the day down. Discover small gifts for the hour before bed.';

function cleanTitle(value) {
  return value.normalize('NFKC').replace(/agnes\s*(?:\+|&)\s*cat/gi, 'Agnes & Cat').replace(/\s+/g, ' ').trim();
}

export async function catalog() {
  const options = { signal: AbortSignal.timeout(6000) };
  const pageSize = 250;
  const feedUrl = store + '/products.json?limit=' + pageSize;
  const [feed, cart] = await Promise.all([
    fetch(feedUrl, options),
    fetch(store + '/cart.js', options),
  ]);
  if (!feed.ok || !cart.ok) throw new Error('Shopify catalogue unavailable');
  const [{ products }, { currency }] = await Promise.all([feed.json(), cart.json()]);
  if (!Array.isArray(products) || !/^[A-Z]{3}$/.test(currency)) throw new Error('Invalid Shopify catalogue');
  for (let page = 2; products.length === (page - 1) * pageSize; page++) {
    const response = await fetch(feedUrl + '&page=' + page, options);
    if (!response.ok) throw new Error('Shopify catalogue page unavailable');
    const next = (await response.json()).products;
    if (!Array.isArray(next)) throw new Error('Invalid Shopify catalogue page');
    if (!next.length || next[0].id === products[0].id) break;
    products.push(...next);
  }
  const byTitle = new Map();
  const byHandle = new Map();
  for (const product of products) {
    const name = cleanTitle(product.title);
    const item = {
      name,
      handle: product.handle,
      type: product.product_type,
      images: product.images.filter(image => /^https:\/\/cdn\.shopify\.com\//.test(image.src)).map(hostedImage),
      variants: product.variants.map(({id, title, price, available}) => ({ id, name: title, price: Number(price), available })),
    };
    byHandle.set(item.handle, item);
    const key = name.toLowerCase();
    const existing = byTitle.get(key);
    if (!existing || (!existing.variants.some(variant => variant.available) && item.variants.some(variant => variant.available))) byTitle.set(key, item);
  }
  for (const [handle, product] of byHandle) {
    byHandle.set(handle, byTitle.get(product.name.toLowerCase()));
  }
  return { currency, products: [...byTitle.values()], byHandle };
}

export function permalink(lines, { note, discount } = {}) {
  const url = new URL(store + '/cart/' + lines.map(({id, qty}) => id + ':' + qty).join(','));
  if (note?.trim()) url.searchParams.set('attributes[note]', note.trim());
  if (discount?.trim()) url.searchParams.set('discount', discount.trim());
  return url.href;
}
