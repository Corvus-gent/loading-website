import {formatPageText} from './i18n/page-copy.js';
const language = () => globalThis.document?.documentElement.lang || 'en-GB';
export const brusselsDay = () => new Intl.DateTimeFormat('en-CA', {timeZone: 'Europe/Brussels'}).format(new Date());
export const countryStatsURL = day => `/api/stats?day=${encodeURIComponent(day)}&v=5`;

export function countryPeriod(day) {
  const date = new Date(`${day}T12:00:00Z`).toLocaleDateString(language() === 'en' ? 'en-GB' : language(), {day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Brussels'});
  return day === brusselsDay() ? formatPageText('today · {date} · Brussels time', {date})
    : formatPageText('{date} · Brussels time', {date});
}

export function renderCountries(container, countries) {
  if (!Array.isArray(countries)) throw new Error('country counts unavailable');
  const numbers = new Intl.NumberFormat(language());
  const regions = new Intl.DisplayNames(language(), {type: 'region'});
  const entries = countries.map(({c, n}) => ({name: !c || c === '?' ? 'unknown location' : /^[A-Z]{2}$/.test(c) ? regions.of(c) : c, count: Number(n)}))
    .filter(row => Number.isSafeInteger(row.count) && row.count > 0)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  if (!entries.length) {
    container.textContent = 'no visitors recorded for this day yet.';
    return;
  }
  const list = document.createElement('ol');
  list.className = 'country-list';
  const max = entries[0].count;
  for (const row of entries) {
    const item = document.createElement('li');
    item.className = 'country-row';
    const name = document.createElement('span');
    name.className = 'country-name';
    name.textContent = row.name;
    const count = document.createElement('span');
    count.className = 'country-count';
    count.textContent = numbers.format(row.count);
    count.setAttribute('aria-label', formatPageText(row.count === 1 ? '{count} visitor' : '{count} visitors', {count: numbers.format(row.count)}));
    const bar = document.createElement('span');
    bar.className = 'country-bar';
    bar.setAttribute('aria-hidden', 'true');
    bar.style.width = `${row.count / max * 100}%`;
    item.append(name, count, bar);
    list.append(item);
  }
  container.replaceChildren(list);
}
