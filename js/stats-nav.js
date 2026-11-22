import { initI18n, getLang } from './i18n.js?v=20261108live1';
initI18n();
const page = document.body.dataset.statPage || 'overview';
const pathFor = value => value === 'overview' ? '' : value === 'status' ? 'uptime' : value;
for (const a of document.querySelectorAll('[data-stat]')) {
  a.href =
    'https://stats.corvus.gent/' +
    pathFor(a.dataset.stat) +
    '?lang=' +
    getLang();
  if (a.dataset.stat === 'status') a.textContent = 'uptime';
  if (a.dataset.stat === page) a.setAttribute('aria-current', 'page');
}
document.querySelector('.stat-copy')?.addEventListener('click', async (e) => {
  try {
    await navigator.clipboard.writeText(
      'https://stats.corvus.gent/' + pathFor(page)
    );
    e.target.textContent = 'copied';
  } catch {
    e.target.textContent = location.href;
  }
});
