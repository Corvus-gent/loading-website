// Only published campaign labels can leave the browser. Keep one landing per tab.
import {analyticsAllowed} from './analytics-consent.js';
import {sidequestTags} from './analytics-policy.js';
import {arrivalSearch, sidequestsPage} from './arrival.js';

const key = 'sidequests:arrival';
let original;
export function questTags() {
  if (!analyticsAllowed()) {
    original = undefined;
    try { sessionStorage.removeItem(key); sessionStorage.removeItem(homeKey); } catch {}
    return {};
  }
  if (original) return original;
  try {
    const stored = sessionStorage.getItem(key);
    if (stored) original = sidequestTags(JSON.parse(stored));
  } catch {}
  if (!original?.utm_source && sidequestsPage) {
    original = sidequestTags(Object.fromEntries(new URLSearchParams(arrivalSearch)));
    if (original.utm_source) {
      try { sessionStorage.setItem(key,JSON.stringify(original)); } catch {}
    }
  }
  return original || {};
}

// A same-tab navigation can tear down an in-flight SDK request. Hand this single
// action to the destination, and remove the receipt before sending it there.
const homeKey = 'sidequests:home';
export function deferHomeClick() {
  if (!analyticsAllowed()) return false;
  try { sessionStorage.setItem(homeKey,String(Date.now())); return true; } catch { return false; }
}
export function takeHomeClick() {
  try {
    const at = Number(sessionStorage.getItem(homeKey));
    sessionStorage.removeItem(homeKey);
    return analyticsAllowed() && at > 0 && at <= Date.now() && Date.now()-at < 30000;
  } catch { return false; }
}
