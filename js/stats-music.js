import { view, out, el, rows } from './stats-view.js';
view((data) => {
  out.replaceChildren();
  for (const [title, list] of [
    ['most loved', data.loved],
    ['new suggestions', data.suggestions],
    ['plays per genre', data.genres]
  ]) {
    out.append(el('h2', title));
    if (list) rows(out, list);
    else out.append(el('p', 'counts unavailable.'));
  }
});
