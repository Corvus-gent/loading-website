import {analyticsAllowed} from '../analytics-consent.js';
// No new cookies, IDs, pixels, referrers or query strings. Anonymous requests
// create no records; the server accepts only an existing confirmed email session.
function visit() {
  if (document.hidden) return;
  const suppress = !analyticsAllowed();
  const body = suppress ? {suppress:true} : {path:location.pathname};
  fetch('/api/re-engage', {method:'POST', credentials:'same-origin', referrerPolicy:'no-referrer',
    headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)}).catch(()=>{});
}
visit();
document.addEventListener('visibilitychange',visit);
window.addEventListener('analytics-consent-change',visit);
window.addEventListener('pageshow',event=>{if(event.persisted)visit();});
