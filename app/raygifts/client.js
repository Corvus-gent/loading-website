import { permalink } from './catalog.js';

const { products, currency } = JSON.parse(document.querySelector('#ray-data').textContent);
const variants = new Map(products.flatMap(product => product.variants.map(variant => [variant.id, { ...variant, product: product.name }])));
const money = new Intl.NumberFormat('en-GB', { style: 'currency', currency });
const bagKey = 'raygifts-bag';
const themeKey = 'raygifts-theme';
const items = document.querySelector('#bag-items');
const checkout = document.querySelector('#checkout');
let bag = {};
let theme;
try {
  bag = JSON.parse(localStorage.getItem(bagKey)) ?? {};
  theme = localStorage.getItem(themeKey);
} catch {}
if (typeof bag !== 'object' || Array.isArray(bag)) bag = {};

function updateBag() {
  const lines = Object.entries(bag).filter(([id, qty]) => Number.isSafeInteger(qty) && qty > 0 && variants.get(Number(id))?.available)
    .map(([id, qty]) => ({ id: Number(id), qty }));
  const count = lines.reduce((total, line) => total + line.qty, 0);
  document.querySelector('#bag-count').textContent = count;
  checkout.hidden = !count;
  items.replaceChildren();
  if (count) {
    checkout.href = permalink(lines);
    const list = document.createElement('ul');
    for (const { id, qty } of lines) {
      const variant = variants.get(id);
      const row = document.createElement('li');
      const label = variant.name === 'Default Title' ? variant.product : variant.product + ' · ' + variant.name;
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = 'Remove one';
      remove.setAttribute('aria-label', 'Remove one ' + label);
      remove.addEventListener('click', () => {
        if (--bag[id] === 0) delete bag[id];
        updateBag();
        (items.querySelector('button') || document.querySelector('a[href="/raygifts#gifts"]')).focus();
      });
      row.append(`${qty} × ${label} · ${money.format(variant.price * qty)} `, remove);
      list.append(row);
    }
    items.append(list);
  } else {
    checkout.removeAttribute('href');
    items.textContent = 'Your bag is empty.';
  }
  try { localStorage.setItem(bagKey, JSON.stringify(bag)); } catch {}
}
updateBag();

for (const form of document.querySelectorAll('[data-add]')) {
  form.addEventListener('submit', event => {
    event.preventDefault();
    const id = Number(new FormData(form).get('variant'));
    if (!variants.get(id)?.available) return;
    bag[id] = (Number.isSafeInteger(bag[id]) && bag[id] > 0 ? bag[id] : 0) + 1;
    updateBag();
    document.querySelector('#cart-status').textContent = `${variants.get(id).product} added. ${bag[id]} in bag.`;
    const button = form.querySelector('button');
    button.textContent = 'Added to bag';
    clearTimeout(button.rayFeedback);
    button.rayFeedback = setTimeout(() => { button.textContent = 'Add to bag'; }, 1300);
  });
}

const lights = document.querySelector('#lights');
const dark = matchMedia('(prefers-color-scheme: dark)');
function updateTheme() {
  const night = theme === 'night' || (theme !== 'dusk' && dark.matches);
  document.documentElement.dataset.theme = night ? 'night' : 'dusk';
  lights.lastElementChild.textContent = night ? 'Lights on' : 'Lights off';
}
updateTheme();
dark.addEventListener('change', updateTheme);
lights.addEventListener('click', () => {
  theme = document.documentElement.dataset.theme === 'night' ? 'dusk' : 'night';
  updateTheme();
  try { localStorage.setItem(themeKey, theme); } catch {}
});
