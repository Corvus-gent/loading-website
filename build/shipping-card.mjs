import { shippingDays } from './shipping.mjs';

const format = new Intl.NumberFormat('en-US');
const formatMetric = (value) => value === null ? '—' : format.format(value);

export function shippingCard(snapshot) {
  const days = shippingDays(snapshot);
  const today = days[0];
  const week = days.slice(0, 7).reverse();
  const peak = Math.max(1, ...week.map(day => day.added));
  const metrics = [
    [today.added, 'LINES ADDED'],
    [today.commits, 'COMMITS ON MAIN'],
    [today.ripples?.length ?? null, 'RIPPLES']
  ].map(([value, label], index) => {
    const x = 38 + index * 248;
    return `<text x="${x}" y="126" fill="#fdf5e4" font-size="43" font-weight="700">${formatMetric(value)}</text>
      <text x="${x}" y="151" fill="#d3c9b2" font-size="15" letter-spacing="1">${label}</text>`;
  }).join('');
  const bars = week.map((day, index) => {
    const x = 38 + index * 100;
    const height = Math.max(2, Math.round(61 * day.added / peak));
    return `<rect x="${x}" y="${245 - height}" width="83" height="${height}" rx="3" fill="${day === today ? '#ffd76a' : '#8c7032'}"/>
      <text x="${x + 41.5}" y="270" fill="#d3c9b2" font-size="15" text-anchor="middle">${day.date.slice(5)}</text>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="780" height="313" viewBox="0 0 780 313">
    <rect x="1" y="1" width="778" height="311" rx="16" fill="#11100e" stroke="#40351f" stroke-width="2"/>
    <g font-family="sans-serif">
      <text x="38" y="47" fill="#ffd76a" font-size="20" font-weight="700">CORVUS · DAILY SHIP LOG</text>
      <text x="744" y="47" text-anchor="end" fill="#d3c9b2" font-size="17">${today.date} · Brussels</text>
      ${metrics}
      <text x="38" y="183" fill="#d3c9b2" font-size="14">LINES ADDED · LAST 7 DAYS</text>
      ${bars}
      <text x="38" y="294" fill="#ffd76a" font-size="15">corvus.gent/built</text>
    </g>
  </svg>`;
}
