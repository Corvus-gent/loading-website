import {initI18n,t} from './i18n.js?v=20261106-feathers1';
import {clearTrackingURL} from './arrival.js';
initI18n();
const clean = document.querySelector('link[rel=canonical]').href;
const result = document.querySelector('#share-result');
let timer;
// An extension can block the analytics bundle without disabling share or navigation.
setTimeout(clearTrackingURL,8000);
function track(event, props, leavingForHome = false) {
  window.dispatchEvent(new CustomEvent('quest-action',{detail:{event,props,leavingForHome}}));
}
document.addEventListener('click', event => {
  const a = event.target.closest('a');
  if (a?.dataset.cta) {
    const sameTab = !event.defaultPrevented && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
    track('sidequests_cta_click',{button:a.dataset.cta},a.dataset.cta==='home' && sameTab);
  }
  if (a?.dataset.share) track('sidequests_share',{method:a.dataset.share});
});
document.querySelector('#quest-share').addEventListener('click',async () => {
  clearTimeout(timer);
  result.textContent = '';
  if (navigator.share) {
    try {
      await navigator.share({title:'Sidequests — Gabriel',text:t('quests.intro'),url:clean});
      track('sidequests_share',{method:'native'});
      return;
    } catch (error) { if (error.name === 'AbortError') return; }
  }
  try {
    await navigator.clipboard.writeText(clean);
    result.textContent = t('quests.copied');
    track('sidequests_share',{method:'copy'});
    timer = setTimeout(() => { result.textContent = ''; },3000);
  } catch { result.textContent = clean; }
});
