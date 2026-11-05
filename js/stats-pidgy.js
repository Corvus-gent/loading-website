import { view, out, el, rows, percent } from './stats-view.js';
view((d) => {
  if (!d.all || !d.today) {
    out.textContent = 'crossing counts unavailable.';
    return;
  }
  out.replaceChildren();
  const trail = el('div', '', `bird-trail scene-${d.scene}`);
  const image = (src, alt, cls) => {
    const img = el('img', '', cls);
    img.src = src;
    img.alt = alt;
    img.width = 100;
    img.height = 100;
    img.loading = 'lazy';
    return img;
  };
  trail.append(image('/logo.png', 'corvus'), image('/img/diogenes.svg', 'Diogenes', 'diogenes'));
  const flight = el('div', `${d.all.clicks} clicks`, 'flight');
  flight.append(
    el(
      'div',
      d.scene === 1 ? '🪶'.repeat(Math.min(20, Math.floor(d.all.clicks / 10))) : '· · · 🪶 · · ·'
    )
  );
  trail.append(flight, image(d.variant ? '/img/fire-pidgy.webp' : '/img/sticky-pidgy.webp', 'Pidgy'));
  if (d.signups && d.scene === 2)
    trail.lastChild.style.transform = `scale(${1 + Math.min(0.4, Math.log1p(d.signups.all) / 20)})`;
  out.append(trail);
  const counts = el('div', '', 'bird-counts');
  for (const period of ['today', 'all']) {
    const s = d[period],
      block = el('section', '');
    block.append(
      el('h2', period === 'all' ? 'all time' : 'today'),
      el('p', `${s.visitors} visitors → ${s.clickers} people clicked`),
      el('p', `${s.clicks} clicks · ${percent(s.clickers, s.visitors)} visitors → clickers`)
    );
    if (d.signups)
      block.append(
        el(
          'p',
          `${d.signups[period]} signups · ${percent(d.signups[period], s.clickers)} clickers → signups`
        )
      );
    counts.append(block);
  }
  out.append(
    counts,
    el(
      'p',
      d.signups
        ? 'cookieless counts are estimates. signup attribution is first-touch; these are separate aggregate counts, not tracked individual journeys.'
        : 'cookieless visitor counts are estimates. clicks are counted from the tracking launch.',
      'sub'
    )
  );
  if (d.scene === 1)
    out.append(el('p', 'one feather = 10 clicks · display capped at 20 feathers', 'sub'));
});
