import { shippingDay, shippingDays } from './shipping.mjs';

const section = document.querySelector('#shipping');
if (location.pathname.replace(/\/$/, '') === '/built') {
  document.querySelector('main > header').before(section);
}
const dateInput = section.querySelector('input[type=date]');
const status = section.querySelector('[role=status]');
const previous = section.querySelector('#shipping-prev');
const next = section.querySelector('#shipping-next');
const today = section.querySelector('#shipping-today');
const chart = section.querySelector('#shipping-chart');
const metric = section.querySelector('#shipping-metric');
const rippleList = section.querySelector('#shipping-ripples');
const params = new URLSearchParams(location.search);
const format = new Intl.NumberFormat('en-US');
const labels = {
  added: 'lines added',
  commits: 'commits on main',
  ripples: 'ripples'
};
let days = [];
let selected = params.get('day');
let snapshotUpdated;

const readValue = (day, key) => key === 'ripples' ? day.ripples?.length ?? null : day[key];
const display = (value) => value === null ? '—' : format.format(value);

function selectDate(date, updateUrl = true) {
  const index = days.findIndex(day => day.date === date);
  if (index === -1) return;
  selected = date;
  const day = days[index];
  const freshest = days[0].date;
  const isToday = date === shippingDay(new Date());
  dateInput.value = date;
  previous.disabled = index === days.length - 1;
  next.disabled = index === 0;
  today.disabled = index === 0;
  today.textContent = freshest === shippingDay(new Date()) ? 'Today' : 'Latest';
  status.textContent = (isToday ? 'Today · ' : '') + date + ' · Brussels' +
    (date === freshest ? ' · latest snapshot ' + new Date(snapshotUpdated).toLocaleTimeString('en-GB', {
      hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Brussels'
    }) : '');
  for (const key of ['added', 'removed', 'commits', 'ripples']) {
    section.querySelector('#shipping-' + (key === 'ripples' ? 'ripples-count' : key)).textContent = display(readValue(day, key));
  }

  rippleList.replaceChildren(...(day.ripples ?? []).map(ripple => {
    const item = document.createElement('li');
    const link = document.createElement('a');
    link.href = 'https://github.com/Corvus-gent/loading-website/blob/main/build/ripples/' + encodeURIComponent(ripple.file);
    link.textContent = ripple.title;
    item.append(link);
    return item;
  }));
  const message = section.querySelector('#shipping-ripple-note');
  message.textContent = day.ripples === null
    ? 'Ripple tracking started on 19 November 2026.'
    : day.ripples.length ? '' : 'No ripples published on this day.';

  if (updateUrl) {
    const url = new URL(location.href);
    url.searchParams.delete('ago');
    if (index === 0) url.searchParams.delete('day');
    else url.searchParams.set('day', date);
    history.replaceState(null, '', url);
  }
  renderChart();
}

function renderChart() {
  const key = metric.value;
  const selectedIndex = days.findIndex(day => day.date === selected);
  const start = Math.max(0, selectedIndex - 6);
  const visible = days.slice(start, start + 14).reverse();
  const peak = Math.max(1, ...visible.map(day => readValue(day, key) ?? 0));
  chart.replaceChildren(...visible.map(day => {
    const value = readValue(day, key);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'shipping-bar';
    button.setAttribute('aria-pressed', String(day.date === selected));
    button.setAttribute('aria-label', day.date + ', ' + (value === null ? 'untracked' : display(value)) + ' ' + labels[key]);
    button.title = button.getAttribute('aria-label');
    const count = document.createElement('span');
    count.textContent = display(value);
    const bar = document.createElement('span');
    bar.className = 'shipping-bar-fill';
    bar.style.height = Math.max(2, (value ?? 0) / peak * 88) + 'px';
    const date = document.createElement('span');
    date.textContent = day.date.slice(5);
    button.append(count, bar, date);
    button.addEventListener('click', () => {
      selectDate(day.date);
      chart.querySelector('[aria-pressed=true]').focus({ preventScroll: true });
    });
    return button;
  }));
  const active = chart.querySelector('[aria-pressed=true]');
  if (active) chart.scrollLeft += active.getBoundingClientRect().left - chart.getBoundingClientRect().left -
    (chart.clientWidth - active.clientWidth) / 2;
}

previous.addEventListener('click', () => selectDate(days[days.findIndex(day => day.date === selected) + 1].date));
next.addEventListener('click', () => selectDate(days[days.findIndex(day => day.date === selected) - 1].date));
today.addEventListener('click', () => selectDate(days[0].date));
dateInput.addEventListener('change', () => selectDate(dateInput.value));
metric.addEventListener('change', renderChart);

export function renderShipping(snapshot) {
  if (snapshot.config?.ref !== 'main') {
    status.textContent = 'Waiting for the public main branch snapshot.';
    return;
  }
  const initial = !days.length;
  const followingLatest = selected === days[0]?.date;
  days = shippingDays(snapshot);
  snapshotUpdated = snapshot.updated;
  dateInput.disabled = false;
  dateInput.min = days.at(-1).date;
  dateInput.max = days[0].date;
  metric.disabled = false;
  const target = initial && !selected ? days[Number(params.get('ago'))]?.date : selected;
  selectDate(!followingLatest && days.some(day => day.date === target) ? target : days[0].date, false);
}
