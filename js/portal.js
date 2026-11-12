import {nextRealmReset} from './realm-reset.js';

const link = document.querySelector('.realm-enter');
const hasEntryCookie = () => document.cookie.split(';').some(value => value.trim() === 'corvus_realm=1');
const gate = document.body.hasAttribute('data-realm-gate');
link?.addEventListener('click', event => {
  if (gate) {
    document.cookie = `corvus_realm=1; Expires=${nextRealmReset().toUTCString()}; Path=/; SameSite=Lax; Secure`;
  }
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey ||
      matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  event.preventDefault();
  document.body.classList.add('entering');
  setTimeout(() => location.assign(link.href), 400);
});

// A history restore can bypass middleware on browsers with a back/forward cache.
window.addEventListener('pageshow', event => {
  if (!event.persisted) return;
  document.body.classList.remove('entering');
  const entered = hasEntryCookie();
  if (gate === entered) location.reload();
});

if (!gate && hasEntryCookie()) {
  const refreshAfterReset = () => {
    if (!document.hidden && !hasEntryCookie()) location.reload();
  };
  setTimeout(refreshAfterReset, nextRealmReset() - Date.now() + 50);
  document.addEventListener('visibilitychange', refreshAfterReset);
}
