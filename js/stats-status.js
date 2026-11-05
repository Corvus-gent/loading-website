import { el, out, view } from './stats-view.js';
const titles = {
  ok: 'the lantern is burning.',
  degraded: 'the lantern flickers.',
  down: 'the lantern is out.',
  unknown: 'waiting for the first light.'
};
view((s) => {
  document.querySelector('#health-title').textContent = titles[s.status] || titles.unknown;
  out.replaceChildren();
  for (const c of s.checks) {
    const card = el('section', null, 'health-check');
    const title = el('h2', c.name);
    card.append(title);
    const strip = el('div', null, 'health-strip');
    strip.setAttribute('role', 'img');
    const day = new Date(s.checked_at || Date.now());
    day.setUTCHours(0, 0, 0, 0);
    const descriptions = c.days.map((state, i) => {
      const block = el('i', null, 'health-' + state);
      const label =
        new Date(day.getTime() - (29 - i) * 86400000).toISOString().slice(0, 10) + ' · ' + state;
      block.title = label;
      strip.append(block);
      return label;
    });
    strip.setAttribute('aria-label', descriptions.join(', '));
    card.append(strip);
    const periods = ['24h', '7d', '30d'];
    card.append(
      el(
        'p',
        c.skipped
          ? 'not configured'
          : c.uptime.map((n, i) => periods[i] + ' ' + (n == null ? '—' : n.toFixed(1) + '%')).join(' · ')
      )
    );
    card.append(
      el(
        'small',
        (c.average == null ? '—' : c.average + ' ms') +
          ' avg · ' +
          (c.lastIncident
            ? 'last incident ' + new Date(c.lastIncident).toLocaleString()
            : 'no recorded incident')
      )
    );
    out.append(card);
  }
  if (!s.checks.length) out.textContent = 'no checks recorded yet.';
});
