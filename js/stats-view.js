import { translatePageText } from './i18n/page-copy.js';

export const out = document.querySelector('#section-output');
export const el = (tag, text, cls) => {
  const e = document.createElement(tag);
  if (text != null) e.textContent = text;
  if (cls) e.className = cls;
  return e;
};
export function rows(container, items) {
  for (const [label, n] of items) {
    const row = el('div', '', 'stat-item');
    row.append(el('span', label || '?'), el('span', typeof n === 'number' ? number(n) : String(n)));
    container.append(row);
  }
}
let locale, numbers, percentages;
function updateFormats() {
  const next = document.documentElement.lang || 'en';
  if (next !== locale) {
    locale = next;
    numbers = new Intl.NumberFormat(locale);
    percentages = new Intl.NumberFormat(locale, { style: 'percent' });
  }
}
export function number(value) {
  updateFormats();
  return Number.isFinite(value) ? numbers.format(value) : '—';
}
export function percent(a, b) {
  updateFormats();
  return b ? percentages.format(a / b) : '—';
}
export function view(render) {
  const { watch, page, today } = window.statsPage;
  let snapshot;
  const paint = () => {
    const s = snapshot;
    if (!s) return;
    if (!s.data) {
      out.textContent =
        translatePageText(s.state === 'warming' ? 'preparing the first snapshot…' : 'snapshot unavailable.');
      return;
    }
    render(s.data);
  };
  watch(page, today, s => { snapshot = s; paint(); });
  window.addEventListener('corvus-page-copy-ready', paint);
}
