import { view, out, el, rows } from './stats-view.js';
view((s) => {
  out.replaceChildren(
    el('p', `${s.feathers ?? '—'} feathers found · ${s.hunters ?? '—'} explorers`),
    el('p', `${s.cli ? Object.values(s.cli.day).reduce((a, b) => a + b, 0) : '—'} command-line visits today`),
    el('p', `cv: ${s.cv?.open ?? '—'} opens · ${s.cv?.download ?? '—'} downloads today`),
    el('h2', 'terminal activity')
  );
  rows(
    out,
    (s.terminal || []).map((t) => [t.c, t.n])
  );
});
