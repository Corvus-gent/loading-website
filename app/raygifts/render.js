import { readFileSync } from 'node:fs';
import { store, title, description } from './catalog.js';
import { resultTitle } from './ritual.js';

export const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]);

const css = readFileSync(new URL('./ray.css', import.meta.url), 'utf8');
const fonts = 'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght,SOFT@9..144,400..600,100&family=Instrument+Sans:wght@400..600&family=JetBrains+Mono&display=swap';

const pencil = '<svg class="pencil" viewBox="0 0 140 14" fill="none" aria-hidden="true"><path d="M2 10Q59 -3 137 6M9 12Q53 4 89 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
const stories = [
  [/clarity/i, 'For signing off after one tab too many.'],
  [/yoga/i, 'For the little silence after the last stretch.'],
  [/slumber/i, 'For when the book slips out of your hands.'],
  [/eye pillow/i, 'For the moment you let the room go dark.'],
  [/bath|soap/i, 'For the hour you run the water and put the phone away.'],
  [/candle|scent|incense/i, 'For when you turn off the big light.'],
];

export function card(product, currency, detail = false) {
  const { name, variants, images, handle, type } = product;
  const image = images[0];
  const source = image && new URL(image.src);
  if (source) source.searchParams.set('width', detail ? '800' : '480');
  const heading = detail ? `<h1>${escape(name)}</h1>` : `<h3><a href="/raygifts/${escape(handle)}">${escape(name)}</a></h3>`;
  const moment = stories.find(([pattern]) => pattern.test(name + ' ' + type))?.[1] ?? 'For a quiet moment at the end of the day.';
  const prices = new Intl.NumberFormat('en-GB', { style: 'currency', currency });
  const picks = variants.filter(variant => variant.available);
  const options = picks.map(({id, name, price}) => `<option value="${id}">${escape(name)} · ${prices.format(price)}</option>`).join('');
  return `<article class="flyer${detail ? ' detail' : ''}">
    ${source ? `<img src="${escape(source.href)}" width="${image.width}" height="${image.height}" ${detail ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async" alt="${escape(image.alt || name)}">` : ''}
    <div class="flyer-copy">${heading}${pencil}<p>${escape(moment)}</p>
    ${picks.length ? `<form class="pick" data-add><label class="${picks.length === 1 ? 'single' : ''}"><span>Option</span><select name="variant">${options}</select></label>
      ${picks.length === 1 ? `<span class="price">${prices.format(picks[0].price)}</span>` : ''}
      <button type="submit">Add to bag</button></form>` : '<p>Sold out</p>'}</div>
  </article>`;
}

export function render({ products, currency, product, missing, unavailable, path = '', mode = 'home', result = '' }) {
  const box = mode === 'box';
  const quiz = mode === 'quiz';
  const landing = !product && !missing && !box && !quiz;
  const pageTitle = product ? `${product.name} · Ray` : missing ? 'Gift not found · Ray'
    : quiz ? resultTitle(result) + ' · Ray' : box ? 'Build a gift box · Ray' : title;
  const productImage = product?.images[0]?.src;
  const canonical = 'https://corvus.gent/raygifts' + path + (result ? '?r=' + result : '');
  const shareImage = result ? 'https://corvus.gent/raygifts/share.png?r=' + result : 'https://corvus.gent/raygifts/share.png';
  const data = JSON.stringify({
    currency, mode, initialResult: result,
    products: product && !products.some(item => item.handle === product.handle) ? [...products, product] : products,
  }).replace(/</g, '\\u003c');
  return `<!doctype html><html lang="en"><head>
    <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="theme-color" content="#3B2A5C"><meta name="description" content="${escape(description)}">
    <title>${escape(pageTitle)}</title><meta property="og:title" content="${escape(pageTitle)}">
    <meta property="og:description" content="${escape(description)}"><meta property="og:type" content="website">
    <meta property="og:url" content="${escape(canonical)}">
    <meta property="og:image" content="${escape(productImage || shareImage)}">
    <meta property="og:image:alt" content="${escape(product?.name || pageTitle)}">
    <meta name="twitter:card" content="summary_large_image"><link rel="canonical" href="${escape(canonical)}">
    <link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="stylesheet" href="${escape(fonts)}" media="print" onload="this.media='all'">
    <noscript><link rel="stylesheet" href="${escape(fonts)}"></noscript>
    <style>${css}</style><script type="module" src="/app/raygifts/client.js"></script>
    <script>try{const rayTheme=localStorage.getItem('raygifts-theme');document.documentElement.dataset.theme=rayTheme==='night'||(rayTheme!=='dusk'&&matchMedia('(prefers-color-scheme: dark)').matches)?'night':'dusk'}catch{}</script>
    </head><body class="${landing ? 'landing' : 'inner'}">
    <a class="skip" href="#main">Skip to content</a>
    <header class="shell"><a class="mark" href="/raygifts" aria-label="Ray home">Ray<span aria-hidden="true"></span></a><nav aria-label="Ray"><a href="/raygifts#gifts">Gifts</a><a href="/raygifts/quiz">Quiz</a><a href="/raygifts/box">Box</a><a href="#bag">Bag <span id="bag-count">0</span></a></nav><button id="lights" type="button" role="switch" aria-label="Night mode" aria-checked="false"><span class="cord" aria-hidden="true"></span><span>Lights off</span></button></header>
    <main id="main">${product ? `<section class="room">${card(product, currency, true)}</section>`
    : missing ? '<section class="room"><h1>This gift has gone quiet.</h1><a href="/raygifts#gifts">See all gifts</a></section>'
    : quiz || box ? `<section class="room quiet-room"><p class="eyebrow">Gifts for the quiet hour</p><h1>${quiz ? 'Find your ritual.' : 'Give someone a good night.'}</h1>
      ${box ? '<p>Choose three things for their quiet hour. Tap a gift or drag it into the box.</p>' : ''}
      <div id="ray-feature"></div><noscript><p>Enable JavaScript to use this tool.</p></noscript></section>`
    : `<section class="hero room"><p class="eyebrow reveal">Gifts for the quiet hour</p><h1><span class="reveal">Put the day</span><span class="reveal">down.</span></h1><p class="reveal">Small gifts for the hour when the world can wait.</p><a class="action reveal" href="#gifts">Come in</a>
      <div class="horizon" aria-hidden="true"><div class="sun"></div></div></section>
    <section class="room" id="gifts"><p class="eyebrow">The gift shelf</p><h2>Give someone a good night.</h2>
      ${unavailable ? `<p>The shelf is taking a moment. <a href="${store}">Visit the Shopify store</a>.</p>` :
      `<div class="shelf">${products.map(item => card(item, currency)).join('') || '<p>The shelf is empty tonight.</p>'}</div>`}
      <div class="inline room-links"><a class="action" href="/raygifts/quiz">Find your ritual</a><a class="action" href="/raygifts/box">Build a gift box</a></div></section>
    <section class="room quiet-room" id="bedtime"><p class="eyebrow">Your wind-down</p><h2>When are you calling it a night?</h2><div id="ray-feature"></div>
      <noscript><p>Enable JavaScript to plan your wind-down.</p></noscript></section>
    <section class="room quiet-room" id="pause"><p class="eyebrow">A breath between things</p><h2>Take thirty seconds.</h2><div id="ray-pause"></div><div id="ray-sound"></div></section>
    <section class="room trust"><h2>About Ray</h2><p>Ray makes space for the hour between the day and bed. <small>TODO for owner: replace with Ray’s story.</small></p>
      <h3>Shipping &amp; returns</h3><p>TODO for owner: add shipping and returns policies.</p><a href="${store}/pages/contact">Contact Ray</a></section>`}
    <section class="night" id="bag"><div class="stars" aria-hidden="true"></div><div class="room"><p class="eyebrow">The quiet hour</p><h2 tabindex="-1">Your bag</h2><div id="ray-app"><p>Your bag is empty.</p></div>
      <noscript><p><a href="${store}">Shop on Shopify</a></p></noscript><p><a href="/raygifts#gifts">Back to the shelf</a></p></div></section></main>
    <script id="ray-data" type="application/json">${data}</script></body></html>`;
}
