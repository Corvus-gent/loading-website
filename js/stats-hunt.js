import { formatPageText } from './i18n/page-copy.js';
import { view, out, el, rows, number } from './stats-view.js';
view((s) => {
  out.replaceChildren(
    el('p', formatPageText('{feathers} feathers found · {hunters} explorers', {
      feathers: number(s.feathers), hunters: number(s.hunters)
    })),
    el('p', formatPageText('{count} command-line visits today', {
      count: s.cli ? number(Object.values(s.cli.day).reduce((a, b) => a + b, 0)) : '—'
    })),
    el('p', formatPageText('cv: {opens} opens · {downloads} downloads today', {
      opens: number(s.cv?.open), downloads: number(s.cv?.download)
    })),
    el('h2', 'terminal activity')
  );
  rows(
    out,
    (s.terminal || []).map((t) => [t.c, t.n])
  );
});
