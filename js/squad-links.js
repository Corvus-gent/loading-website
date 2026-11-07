import {analyticsAllowed} from './analytics-consent.js';
import {arrivalSearch} from './arrival.js';

const query = new URLSearchParams(arrivalSearch || location.search);
const source = query.get('utm_source') || 'direct';
function trackMember(event) {
  if (event.type === 'auxclick' && event.button !== 1) return;
  const link = event.target.closest?.('a[data-squad-member]');
  if (!link || !analyticsAllowed()) return;
  const member = link.dataset.squadMember, hack_id = Number(link.dataset.hackId);
  // Navigation never waits for analytics, including with ad blockers enabled.
  fetch('/api/hack', {method:'POST', credentials:'omit', keepalive:true,
    referrerPolicy:'no-referrer', headers:{'Content-Type':'application/json'},
    body:JSON.stringify({action:'squad_member', member, hack_id, source})
  }).catch(() => {});
  window.posthog?.capture('squad_member_click', {member, hack_id, source, utm_campaign:'hack'});
}
document.addEventListener('click', trackMember);
document.addEventListener('auxclick', trackMember);
