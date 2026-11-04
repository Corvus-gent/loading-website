const numbers = new Intl.NumberFormat('en');
const regions = new Intl.DisplayNames(['en'], {type: 'region'});
export const brusselsDay = () => new Intl.DateTimeFormat('en-CA', {timeZone: 'Europe/Brussels'}).format(new Date());
export const countryStatsURL = day => `/api/stats?day=${encodeURIComponent(day)}&v=5`;

export function countryPeriod(day) {
  const date = new Date(`${day}T12:00:00Z`).toLocaleDateString('en-GB', {day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Brussels'}).toLowerCase();
  return `${day === brusselsDay() ? 'today · ' : ''}${date} · brussels time`;
}

export function renderCountries(container, countries) {
  if (!Array.isArray(countries)) throw new Error('country counts unavailable');
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
    count.setAttribute('aria-label', `${numbers.format(row.count)} ${row.count === 1 ? 'visitor' : 'visitors'}`);
    const bar = document.createElement('span');
    bar.className = 'country-bar';
    bar.setAttribute('aria-hidden', 'true');
    bar.style.width = `${row.count / max * 100}%`;
    item.append(name, count, bar);
    list.append(item);
  }
  container.replaceChildren(list);
}

// The map's daily list loads separately from Leaflet and the all-time geo API.
const daily = document.querySelector('[data-countries-today]');
if (daily) {
  const day = brusselsDay();
  document.getElementById('countries-period').textContent = countryPeriod(day);
  fetch(countryStatsURL(day), {signal: AbortSignal.timeout(20000)})
    .then(async response => {
      if (!response.ok) throw new Error('country counts unavailable');
      const data = await response.json();
      renderCountries(daily, data.countries);
    })
    .catch(() => { daily.textContent = 'country counts are unavailable. try again shortly.'; });
}
