import {tierPath} from './page-tiers.js';
export function pagePath(value) {
  const url = new URL(value, 'https://corvus.gent');
  let path = url.pathname;
  try { path = decodeURIComponent(path); } catch { /* Preserve malformed encodings for the router. */ }
  return path.replace(/\/{2,}/g,'/').replace(/\/index(?:\.html)?\/?$/i,'').replace(/\/+$/,'') || '/';
}
export function noIndex(value) {
  const url = new URL(value, 'https://corvus.gent'), page = pagePath(url);
  const path = url.hostname === 'stats.corvus.gent' ? '/stats' + page : page;
  return /(?:^|\/)(?:admin|private|edit|join)(?:\/|$)|^\/(?:api|army|clients|letters)(?:\/|$)|^\/compound\/(?:stats|v2\/(?:stats|links))(?:\/|$)|^\/hack\/3\/add(?:\/|$)|^\/live\/overlay$/.test(path) ||
    !!tierPath(path) || [...url.searchParams.keys()].some(k => /token|password|secret|email|(?:^|_)key$/i.test(k));
}
