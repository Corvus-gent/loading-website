import { initI18n, getLang } from './i18n.js?v=20261106-feathers1';
initI18n();
const page = document.body.dataset.statPage || 'overview';
for (const a of document.querySelectorAll('[data-stat]')) {
  a.href =
    'https://stats.corvus.gent/' +
    (a.dataset.stat === 'overview' ? '' : a.dataset.stat) +
    '?lang=' +
    getLang();
  if (a.dataset.stat === page) a.setAttribute('aria-current', 'page');
}
document.querySelector('.stat-copy')?.addEventListener('click', async (e) => {
  try {
    await navigator.clipboard.writeText(
      'https://stats.corvus.gent/' + (page === 'overview' ? '' : page)
    );
    e.target.textContent = 'copied';
  } catch {
    e.target.textContent = location.href;
  }
});
