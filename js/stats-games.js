import { view, out, el, rows, percent } from './stats-view.js';
view((d) => {
  if (!d.today || !Array.isArray(d.types)) {
    out.textContent = 'game counts unavailable.';
    return;
  }
  out.replaceChildren(
    el('h2', `${d.today.played || 0} played today`),
    el('p', `${percent(d.today.solved || 0, d.today.played || 0)} solved · best streak seen: ${d.best}`)
  );
  const dist = Object.entries(d.today).filter(([k]) => k.startsWith('guess:'));
  const max = Math.max(1, ...dist.map(([, v]) => v));
  out.append(
    el(
      'pre',
      dist
        .sort()
        .map(([k, v]) => `${k.slice(6)} ${'█'.repeat(Math.round((v / max) * 18))} ${v}`)
        .join('\n') || 'no completed puzzles yet.'
    )
  );
  const table = el('table', '');
  const head = el('tr', '');
  ['type', 'played', 'solved'].forEach((t) => head.append(el('th', t)));
  table.append(head);
  d.types.forEach((t) => {
    const row = el('tr', '');
    [t.type, t.played || 0, percent(t.solved || 0, t.played || 0)].forEach((v) =>
      row.append(el('td', String(v)))
    );
    table.append(row);
  });
  out.append(
    table,
    el(
      'p',
      'most played: ' + ([...d.types].sort((a, b) => (b.played || 0) - (a.played || 0))[0]?.type || '—')
    )
  );
});
