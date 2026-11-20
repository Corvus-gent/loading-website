import {formatPageText} from './i18n/page-copy.js';
import {number} from './stats-view.js';
const node = (tag, text) => { const n = document.createElement(tag); n.textContent = text; return n; };
let showAll = false;
export function renderSupport(d) {
  const out = document.getElementById('support-counts'), summary = document.getElementById('support-summary');
  if (!out) return;
  out.replaceChildren();
  if (!d) { summary.textContent = 'support counts arrive with the next snapshot.'; return; }
  summary.textContent = formatPageText('{count} clicks on {day} · {total} all time · clicks, not unique people', {
    count: number(d.clicks), day: d.day, total: number(d.total)
  });
  const table = document.createElement('table');
  table.className = 'support-stats-table';
  table.id = 'support-clicks-table';
  const head = document.createElement('tr');
  ['link / action', 'this day', 'all time'].forEach(x => head.append(node('th', x)));
  table.append(head);
  const zeroRows = [];
  for (const r of [...d.rows, ...d.steps]) {
    const tr = document.createElement('tr');
    tr.append(node('td', r.label), node('td', number(r.day)), node('td', number(r.total)));
    if (Number(r.total) === 0) { tr.hidden = !showAll; zeroRows.push(tr); }
    table.append(tr);
  }
  out.append(table);
  if (zeroRows.length) {
    const toggle = node('button', '');
    toggle.type = 'button';
    toggle.className = 'support-retry';
    toggle.setAttribute('aria-controls', table.id);
    const update = () => {
      zeroRows.forEach(row => { row.hidden = !showAll; });
      toggle.textContent = showAll ? 'show less' : 'show all';
      toggle.setAttribute('aria-expanded', String(showAll));
    };
    toggle.addEventListener('click', () => { showAll = !showAll; update(); });
    update();
    out.append(toggle);
  }
}
