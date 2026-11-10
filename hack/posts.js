// TODO: replace null with the actual published post URL. Never use profile URLs here.
export const POST_X_URL = null;
export const POST_LINKEDIN_URL = null;

export function validPostURL(value, network) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    const host = url.hostname.replace(/^www\./, '');
    if (network === 'x' && ['x.com', 'twitter.com'].includes(host) && /\/status\/\d+/.test(url.pathname)) return url.href;
    if (network === 'linkedin' && host === 'linkedin.com' && /^\/(posts|feed\/update)\//.test(url.pathname)) return url.href;
  } catch { /* Keep the honest placeholder if a URL is malformed. */ }
  return null;
}
if (typeof document !== 'undefined') {
  for (const [network, value] of [['x', POST_X_URL], ['linkedin', POST_LINKEDIN_URL]]) {
    const slot = document.querySelector(`[data-post="${network}"]`);
    const url = validPostURL(value, network);
    if (!slot || !url) continue;
    const a = document.createElement('a');
    a.className = 'hack-button'; a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer';
    a.textContent = network === 'x' ? 'Read the post on X ↗' : 'Read the post on LinkedIn ↗';
    slot.replaceChildren(a);
  }
}
