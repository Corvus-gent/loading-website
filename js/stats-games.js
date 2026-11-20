import { formatPageText, translatePageText } from './i18n/page-copy.js';
import { view, out, el, number, percent } from './stats-view.js';
view((d) => {
  if (!d.today || !Array.isArray(d.types)) {
    out.textContent = 'game counts unavailable.';
    return;
  }
  out.replaceChildren(
    el('h2', formatPageText('{count} played today', { count: number(d.today.played || 0) })),
    el('p', formatPageText('{percent} solved · best streak seen: {streak}', {
      percent: percent(d.today.solved || 0, d.today.played || 0), streak: number(d.best)
    }))
  );
  const dist = Object.entries(d.today).filter(([k]) => k.startsWith('guess:'));
  const max = Math.max(1, ...dist.map(([, v]) => v));
  out.append(
    el(
      'pre',
      dist
        .sort()
        .map(([k, v]) => `${k.slice(6)} ${'█'.repeat(Math.round((v / max) * 18))} ${v}`)
        .join('\n') || translatePageText('no completed puzzles yet.')
    )
  );
  const table = el('table', '');
  const head = el('tr', '');
  ['type', 'played', 'solved'].forEach((t) => head.append(el('th', t)));
  table.append(head);
  d.types.forEach((t) => {
    const row = el('tr', '');
    [t.type, number(t.played || 0), percent(t.solved || 0, t.played || 0)].forEach((v) =>
      row.append(el('td', String(v)))
    );
    table.append(row);
  });
  out.append(
    table,
    el(
      'p',
      formatPageText('most played: {type}', {
        type: [...d.types].sort((a, b) => (b.played || 0) - (a.played || 0))[0]?.type || '—'
      })
    )
  );
});
