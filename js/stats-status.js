import {summarizeTelemetry} from './uptime-summary.js';
import { formatPageText, translatePageText } from './i18n/page-copy.js';
import { showStorageWarning } from './storage-warning.js';
import {
  labels,
  states,
  pct,
  duration,
  when,
  svg,
  drawGraph,
  drawStrip,
  drawSpark
} from './status-graph.js';

const $ = (s) => document.querySelector(s);
const titles = {
  ok: 'the lantern is burning.',
  degraded: 'the lantern flickers.',
  down: 'the lantern is out.',
  unknown: 'waiting for the first light.'
};
const media = matchMedia('(max-width:650px)'),
  rows = new Map(),
  cache = new Map();
let range = '24h',
  data,
  controller,
  timer,
  sequence = 0;
const days = () => {
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Brussels' }).format(Date.now());
  const noon = Date.parse(today + 'T12:00Z');
  return Array.from({ length: 90 }, (_, i) =>
    new Date(noon - (89 - i) * 86400000).toISOString().slice(0, 10)
  );
};
const blank = () => ({
  range,
  built_at: Date.now(),
  times: [],
  days: days(),
  checks: [],
  incidents: [],
  series: {},
  uptime: [],
  step: 300000
});
function text(tag, copy, cls) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (copy) n.textContent = copy;
  return n;
}
function makeRows() {
  const fragment = document.createDocumentFragment();
  for (const [name, label] of Object.entries(labels)) {
    const service = text('article', null, 'service'),
      row = text('div', null, 'row');
    const toggle = text('button', null, 'row-toggle'),
      dot = text('i', null, 'dot');
    toggle.type = 'button';
    toggle.dataset.state = '0';
    toggle.setAttribute('aria-expanded', 'false');
    const nameText = document.createTextNode(label);
    toggle.append(dot, nameText);
    const strip = svg('svg', { class: 'day-strip' });
    const percent = text('span', '—', 'percent');
    percent.title = '30-day uptime';
    const spark = svg('svg', {
      class: 'spark',
      viewBox: '0 0 70 24',
      role: 'img'
    });
    const tip = text('span', null, 'day-detail');
    tip.hidden = true;
    const chart = text('div', null, 'chart');
    chart.id = 'timeline-' + name;
    chart.hidden = true;
    toggle.setAttribute('aria-controls', chart.id);
    function toggleChart() {
      chart.hidden = !chart.hidden;
      toggle.setAttribute('aria-expanded', String(!chart.hidden));
      if (!chart.hidden) drawGraph(chart, data || blank(), name);
    }
    toggle.onclick = toggleChart;
    row.onclick = (e) => {
      if (e.target === row || e.target.closest('.percent,.spark')) toggleChart();
    };
    row.append(toggle, strip, percent, spark, tip);
    service.append(row, chart);
    fragment.append(service);
    rows.set(name, { toggle, strip, percent, spark, tip, chart, nameText });
  }
  $('#checks').append(fragment);
}
function feedback(message = '', retry = false, loading = false) {
  $('#load-message').textContent = message;

  $('.track').hidden = !loading;
}
function checked() {
  const at = Date.parse(data?.checked_at);
  if (!Number.isFinite(at)) return data ? 'no checks recorded yet.' : 'waiting for the latest check…';
  const mins = Math.max(0, Math.floor((Date.now() - at) / 60000));
  const relative = new Intl.RelativeTimeFormat(document.documentElement.lang, { numeric: 'auto' });
  const now = mins === 0 ? translatePageText('just now') : relative.format(-mins, 'minute');
  return formatPageText('last checked {time}', { time: now }) +
    (mins > 15 ? ' · ' + translatePageText('monitoring overdue') : '');
}
function renderTelemetry(body) {
  const t = summarizeTelemetry(body);
  $('#services-healthy').textContent = t.services ? t.healthy + ' / ' + t.services : '—';
  $('#check-latency').textContent = t.average === null ? '—' : t.average.toLocaleString() + ' ms';
  $('#check-peak').textContent = t.peak === null ? '—' : t.peak.toLocaleString() + ' ms';
  $('#check-coverage').textContent = t.coverage === null ? '—' : t.coverage + '%';
  $('#coverage-note').textContent = `${t.observed} / ${t.total} expected timeline slots measured · ${body.range || '24h'}. Gaps are unknown, never healthy. Synthetic checks, not user requests.`;
}
function paint(body) {
  const start = performance.now();
  data = body;
  showStorageWarning(body.storage_plaintext_until);
  const status = body.status || 'unknown';
  $('#health-title').textContent = translatePageText(titles[status] || titles.unknown);
  $('.beacon').dataset.state = String(['unknown', 'ok', 'degraded', 'down'].indexOf(status));
  $('#checked').textContent = checked();
  document.querySelectorAll('.metrics dd').forEach((v, i) => (v.textContent = pct(body.uptime?.[i])));
  renderTelemetry(body);
  drawGraph($('#overall-chart'), body, 'overall');
  const checks = new Map(body.checks.map((c) => [c.name, c]));
  for (const [name, row] of rows) {
    const c = checks.get(name),
      level = c?.state || 0;
    row.toggle.dataset.state = level;
    const service = translatePageText(labels[name]);
    row.nameText.data = service;
    row.toggle.setAttribute('aria-label', formatPageText('{service}, {state}, response time', {
      service, state: translatePageText(states[level])
    }));
    row.strip.setAttribute('aria-label', formatPageText('{service} daily history', { service }));
    row.spark.setAttribute('aria-label', formatPageText('{service} response time, last 24 hours', { service }));
    row.percent.textContent = pct(c?.uptime?.[2]);
    drawStrip(row.strip, body.days, c?.days, row.tip, media.matches);
    drawSpark(row.spark, c?.spark || []);
    if (!row.chart.hidden) drawGraph(row.chart, body, name);
  }
  $('#checks').setAttribute('aria-busy', 'false');
  const items = body.incidents.map((i) => {
    const end = i.finish || i.last || i.start;
    const state = i.interrupted ? 'last observed' : i.finish ? 'resolved' : 'ongoing at last check';
    const line = text('li'),
      dot = text('i', null, 'dot');
    line.dataset.state = i.worst;
    dot.setAttribute('aria-hidden', 'true');
    line.append(
      dot,
      document.createTextNode(
        formatPageText(
          i.worst === 3 ? '{service} went down on {time} · {duration} · {state}.'
            : '{service} was slow on {time} · {duration} · {state}.',
          { service: translatePageText(labels[i.name] || i.name), time: when(i.start),
            duration: duration(Math.max(0, end - i.start)), state: translatePageText(state) }
        )
      )
    );
    return line;
  });
  $('#incidents').replaceChildren(
    ...(items.length
      ? items
      : [
          text(
            'li',
            body.checked_at && !body.historyUnavailable
              ? 'no recorded incidents.'
              : 'no incident data yet.'
          )
        ])
  );
  performance.measure('status render', { start, end: performance.now() });
}
function schedule() {
  clearTimeout(timer);
  if (!document.hidden) timer = setTimeout(load, 60000);
}
async function load() {
  clearTimeout(timer);
  controller?.abort();
  const id = ++sequence,
    request = new AbortController();
  controller = request;
  const timeout = setTimeout(() => request.abort(), 9500);
  const slow = setTimeout(() => {
    if (id === sequence) feedback('loading service history…', false, true);
  }, 350);
  try {
    const r = await fetch('/api/health/history?range=' + range, {
      credentials: 'omit',
      signal: request.signal
    });
    if (!r.ok) throw Error('history unavailable');
    const body = await r.json();
    if (id !== sequence) return;
    if (body.range !== range || !Array.isArray(body.checks) || !Array.isArray(body.days))
      throw Error('invalid history');
    if (
      data?.built_at !== body.built_at ||
      data.range !== range ||
      data.checked_at !== body.checked_at ||
      body.historyUnavailable !== data.historyUnavailable ||
      body.storage_plaintext_until !== data.storage_plaintext_until
    )
      paint(body);
    else $('#checked').textContent = checked();
    cache.set(range, body);
    feedback(
      body.historyUnavailable ? 'history storage (redis) is unavailable.' : '',
      !!body.historyUnavailable
    );
  } catch {
    if (id !== sequence) return;
    if (!cache.has(range)) paint(blank());
    feedback(
      cache.has(range)
        ? 'history api unavailable · showing the last reading.'
        : 'history api unavailable · could not load measurements.',
      true
    );
  } finally {
    clearTimeout(timeout);
    clearTimeout(slow);
    if (id === sequence) schedule();
  }
}
for (const button of document.querySelectorAll('[data-range]'))
  button.onclick = () => {
    if (range === button.dataset.range) return;
    range = button.dataset.range;
    for (const b of document.querySelectorAll('[data-range]'))
      b.setAttribute('aria-pressed', String(b === button));
    paint(cache.get(range) || { ...data, range, times: [], series: {} });
    load();
  };

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    sequence++;
    controller?.abort();
    clearTimeout(timer);
  } else load();
});
let lastWidth;
new ResizeObserver((entries) => {
  const width = entries[0].contentRect.width;
  if (lastWidth !== undefined && Math.abs(lastWidth - width) > 1 && data) paint(data);
  lastWidth = width;
}).observe($('#overall-chart'));
makeRows();
window.addEventListener('corvus-page-copy-ready', () => { if (data) paint(data); });
paint(blank());
$('#health-title').textContent = 'reading the lantern.';
$('#checked').textContent = 'waiting for the latest check…';
if (!document.hidden) load();
