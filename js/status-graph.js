export const labels = {
  site: 'site pages',
  redirects: 'vanity slugs',
  stats: 'stats pages',
  redis: 'redis',
  posthog: 'posthog',
  resend: 'resend',
  notion: 'notion',
  coffee: 'buy me a coffee',
  tiles: 'map tiles',
  spotify: 'spotify',
  snapshots: 'stats snapshots',
  cron: 'snapshot job'
};
export const states = ['no data', 'healthy', 'degraded / slow', 'down'];
const colours = ['var(--unknown)', 'var(--healthy)', 'var(--slow)', 'var(--down)'];
const hour = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Brussels',
  hour: '2-digit',
  minute: '2-digit'
});
const date = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Brussels',
  day: 'numeric',
  month: 'short'
});
const stamp = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Brussels',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  timeZoneName: 'shortOffset'
});
export const when = (t) => stamp.format(t).toLowerCase();
export const pct = (n) => (Number.isFinite(n) ? (n === 100 ? '100' : n.toFixed(2)) + '%' : '—');
export const duration = (ms) =>
  ms < 60000
    ? '<1 min'
    : ms < 3600000
      ? Math.floor(ms / 60000) + ' min'
      : ms < 86400000
        ? Math.floor(ms / 3600000) + 'h ' + Math.floor((ms % 3600000) / 60000) + 'm'
        : Math.floor(ms / 86400000) + 'd ' + Math.floor((ms % 86400000) / 3600000) + 'h';
export function svg(name, attrs = {}) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', name);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}
function label(x, y, text, anchor = 'middle', cl = '') {
  const el = svg('text', { x, y, 'text-anchor': anchor, class: cl });
  el.textContent = text;
  return el;
}
function line(x1, y1, x2, y2, stroke) {
  return svg('line', { x1, y1, x2, y2, stroke });
}
function selectable(el, count, indexAt, show, hide) {
  let current = count - 1;
  el.setAttribute('role', 'slider');
  el.setAttribute('tabindex', '0');
  el.setAttribute('aria-valuemin', '0');
  el.setAttribute('aria-valuemax', String(count - 1));
  el.setAttribute('aria-valuenow', String(current));
  function pick(i) {
    current = Math.max(0, Math.min(count - 1, i));
    el.setAttribute('aria-valuenow', String(current));
    el.setAttribute('aria-valuetext', show(current));
  }
  const fromPointer = (e) => pick(indexAt(e.clientX - el.getBoundingClientRect().left));
  el.onpointermove = fromPointer;
  el.onpointerdown = fromPointer;
  el.onpointerleave = (e) => {
    if (e.pointerType === 'mouse' && document.activeElement !== el) hide();
  };
  el.onfocus = () => pick(current);
  el.onblur = hide;
  el.onkeydown = (e) => {
    const next = {
      ArrowRight: current + 1,
      ArrowUp: current + 1,
      ArrowLeft: current - 1,
      ArrowDown: current - 1,
      Home: 0,
      End: count - 1
    };
    if (Object.hasOwn(next, e.key)) {
      e.preventDefault();
      pick(next[e.key]);
    }
    if (e.key === 'Escape') hide();
  };
}
function axisMax(peak) {
  const span = Math.max(100, peak) / 4,
    unit = 10 ** Math.floor(Math.log10(span));
  return 4 * ([1, 2, 2.5, 5, 10].find((n) => n * unit >= span) || 10) * unit;
}
export function drawGraph(host, data, name) {
  const previousFocus = host.contains(document.activeElement);
  const width = Math.max(210, host.clientWidth),
    height = matchMedia('(max-width:650px)').matches ? 160 : 180;
  const left = 50,
    right = width - 6,
    top = 10,
    bottom = height - 26;
  const plot = svg('svg', {
    class: 'plot',
    viewBox: `0 0 ${width} ${height}`,
    'aria-label': (labels[name] || 'overall') + ' response time in milliseconds'
  });
  const detail = document.createElement('p');
  detail.className = 'chart-detail';
  const values = data.series?.[name] || [],
    times = data.times || [];
  const populated = values.flatMap((v, i) => (v ? [i] : []));
  const end = data.built_at,
    start = end - { '24h': 1, '7d': 7, '30d': 30 }[data.range] * 86400000;
  const x = (t) =>
    Math.max(left, Math.min(right, left + ((t - start) / (end - start)) * (right - left)));
  const maximum = axisMax(populated.reduce((m, i) => Math.max(m, values[i][1]), 0));
  const y = (v) => bottom - (v / maximum) * (bottom - top);
  for (let i = 0; i <= 4; i++) {
    const val = (maximum * i) / 4,
      yy = y(val);
    plot.append(line(left, yy, right, yy, '#2a2925'), label(left - 6, yy + 3, val + ' ms', 'end'));
  }
  const ticks = width < 440 ? 3 : 5;
  for (let i = 0; i < ticks; i++) {
    const t = start + ((end - start) * i) / (ticks - 1);
    plot.append(
      label(
        x(t),
        height - 5,
        (data.range === '24h' ? hour : date).format(t).toLowerCase(),
        !i ? 'start' : i === ticks - 1 ? 'end' : 'middle'
      )
    );
  }
  const paths = ['', '', '', ''],
    areas = ['', '', '', ''],
    peaks = ['', '', '', ''],
    dots = ['', '', '', ''];
  let previous = -2,
    previousPoint;
  for (const i of populated) {
    const [avg, peak, level] = values[i],
      xx = Number(x(times[i]).toFixed(1)),
      yy = Number(y(avg).toFixed(1));
    const connected = i === previous + 1 && times[i] - times[previous] <= data.step * 1.8;
    if (connected) {
      const [px, py] = previousPoint;
      paths[level] += `M${px},${py}L${xx},${yy}`;
      areas[level] += `M${px},${bottom}V${py}L${xx},${yy}V${bottom}Z`;
    }
    if (!connected || level > 1) {
      if (level === 3) dots[level] += `M${xx - 2.7},${yy - 2.7}h5.4v5.4h-5.4z`;
      else if (level === 2) dots[level] += `M${xx},${yy - 3.5}l3.5,3.5 -3.5,3.5 -3.5,-3.5z`;
      else dots[level] += `M${xx - 1.5},${yy}a1.5,1.5 0 1,0 3,0a1.5,1.5 0 1,0 -3,0`;
    }
    if (peak > avg) peaks[level] += `M${xx},${yy}V${y(peak).toFixed(1)}`;
    previousPoint = [xx, yy];
    previous = i;
  }
  for (const level of [1, 2, 3]) {
    if (areas[level])
      plot.append(svg('path', { d: areas[level], fill: colours[level], opacity: '.09' }));
  }
  for (const level of [1, 2, 3]) {
    if (peaks[level])
      plot.append(svg('path', { d: peaks[level], stroke: colours[level], opacity: '.6' }));
    if (paths[level])
      plot.append(
        svg('path', { d: paths[level], fill: 'none', stroke: colours[level], 'stroke-width': 1.75 })
      );
    if (dots[level])
      plot.append(svg('path', { d: dots[level], fill: colours[level], 'data-markers': level }));
  }
  if (!populated.length) {
    plot.setAttribute('role', 'img');
    plot.append(
      label((left + right) / 2, (bottom + top) / 2 - 5, 'no data yet', 'middle', 'empty-label')
    );
    detail.textContent = 'no recorded samples in this range.';
  } else {
    const guide = line(0, top, 0, bottom, '#aaa69c');
    guide.setAttribute('stroke-dasharray', '2 4');
    const cursor = svg('circle', { r: 3, stroke: '#fff', 'stroke-width': 1 });
    const pointer = svg('g', { visibility: 'hidden' });
    pointer.append(guide, cursor);
    plot.append(pointer);
    const rest = () => {
      pointer.setAttribute('visibility', 'hidden');
      detail.textContent = 'inspect a point for latency and check details.';
    };
    const show = (k) => {
      const i = populated[k],
        [avg, peak, level] = values[i],
        xx = x(times[i]);
      pointer.setAttribute('visibility', 'visible');
      guide.setAttribute('x1', xx);
      guide.setAttribute('x2', xx);
      cursor.setAttribute('cx', xx);
      cursor.setAttribute('cy', y(avg));
      cursor.setAttribute('fill', colours[level]);
      const issues = (name === 'overall' ? Object.keys(labels) : [name])
        .filter((n) => data.series[n]?.[i]?.[2] > 1)
        .map((n) => labels[n] + ' ' + (data.series[n][i][2] === 3 ? 'down' : 'slow'));
      const message = [
        when(times[i]),
        avg + ' ms avg',
        ...(peak > avg ? [peak + ' ms peak'] : []),
        issues.join(', ') || states[level]
      ].join(' · ');
      detail.textContent = message;
      return message;
    };
    const nearest = (px) => {
      const target = start + ((px - left) / (right - left)) * (end - start);
      let lo = 0,
        hi = populated.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (times[populated[mid]] < target) lo = mid + 1;
        else hi = mid;
      }
      return lo && target - times[populated[lo - 1]] < times[populated[lo]] - target ? lo - 1 : lo;
    };
    rest();
    selectable(plot, populated.length, nearest, show, rest);
  }
  host.replaceChildren(plot, detail);
  if (previousFocus && populated.length) plot.focus({ preventScroll: true });
}
export function drawStrip(el, dates, values, tip, mobile) {
  const count = mobile ? 30 : 90,
    start = 90 - count;
  // A single focusable 44px control scrubs consecutive days with pointer or arrows.
  el.setAttribute('viewBox', `0 0 ${count * 7} 44`);
  el.setAttribute('preserveAspectRatio', 'none');
  const paths = ['', '', '', ''];
  for (let i = 0; i < count; i++) paths[values?.[start + i]?.[0] || 0] += `M${i * 7},10h5.4v24h-5.4z`;
  el.replaceChildren(
    ...paths.flatMap((d, level) =>
      d ? [svg('path', { d, fill: colours[level], 'data-days-state': level })] : []
    )
  );
  const marker = svg('rect', {
    x: 0,
    y: 8,
    width: 5.4,
    height: 28,
    fill: 'none',
    stroke: '#e8e5dc',
    'stroke-width': 1,
    visibility: 'hidden'
  });
  el.append(marker);
  const select = (i) => {
    marker.setAttribute('x', String(i * 7));
    marker.setAttribute('visibility', 'visible');
    const value = values?.[start + i],
      date = dates?.[start + i] || '';
    tip.textContent = value
      ? `${date} · ${states[value[0]]} · ${pct(value[1])} uptime · ${value[2]} ms avg · ${value[3]} incident${value[3] === 1 ? '' : 's'}`
      : date + ' · no data yet';
    tip.hidden = false;
    return tip.textContent;
  };
  selectable(
    el,
    count,
    (px) => Math.floor((px / el.getBoundingClientRect().width) * count),
    select,
    () => {
      tip.hidden = true;
      marker.setAttribute('visibility', 'hidden');
    }
  );
}
export function drawSpark(el, data) {
  const peak = Math.max(1, ...data.map((v) => v?.[0] || 0)),
    paths = ['', '', '', ''];
  let previous;
  data.forEach((v, i) => {
    if (!v) {
      previous = null;
      return;
    }
    const point = i * 3 + ',' + (21 - (v[0] / peak) * 18).toFixed(1);
    paths[v[1]] += previous ? 'M' + previous + 'L' + point : 'M' + point + 'h.6';
    previous = point;
  });
  if (!paths.some(Boolean)) paths[0] = 'M0 12h69';
  el.replaceChildren(
    ...paths.flatMap((d, i) =>
      d ? [svg('path', { d, stroke: colours[i], fill: 'none', 'stroke-width': '1.6' })] : []
    )
  );
}
