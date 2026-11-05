export const out = document.querySelector('#section-output');
export const el = (tag, text, cls) => {
  const e = document.createElement(tag);
  if (text != null) e.textContent = text;
  if (cls) e.className = cls;
  return e;
};
export function rows(container, items) {
  for (const [label, n] of items) {
    const row = el('div', '', 'stat-item');
    row.append(el('span', label || '?'), el('span', String(n)));
    container.append(row);
  }
}
export const percent = (a, b) => (b ? Math.round((a / b) * 100) + '%' : '—');
export function view(render) {
  const { watch, page, today } = window.statsPage;
  watch(page, today, (s) => {
    if (!s.data) {
      out.textContent =
        s.state === 'warming' ? 'preparing the first snapshot…' : 'snapshot unavailable.';
      return;
    }
    render(s.data);
  });
}
