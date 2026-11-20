import {formatPageText} from './i18n/page-copy.js';
import {el, number, out} from './stats-view.js';
import {init, t} from './army/copy.js?v=20261109ia1';

let snapshot;
function render() {
  if (!snapshot) return;
  const data = snapshot.data;
  if (!data) {
    out.textContent = snapshot.state === 'warming'
      ? 'counting the arrivals…'
      : 'the count is resting. try again shortly.';
    return;
  }
  const count = data.visitors == null ? null : data.visitors + (data.unseen?.day || 0);
  out.replaceChildren(
    el('h2', formatPageText('{count} visitors today', {count: number(count)})),
    el('p', formatPageText('soldiers who said ok: {today} today · {total} all time', {
      today: number(data.soldiers?.day ?? 0),
      total: number(data.soldiers?.all ?? 0)
    })),
    el('p', formatPageText('unseen visitors: {count}', {count: number(data.unseen?.day ?? 0)})),
    el('p', t('statsArmyNote'))
  );
}

init(render);
window.addEventListener('corvus-page-copy-ready', render);
window.statsPage.watch('army', window.statsPage.today, next => {
  snapshot = next;
  render();
});
