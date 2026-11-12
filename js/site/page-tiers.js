// Unlisted pages are public. Use canonical, slashless paths for these reading rooms.
export const tiers = ['visitor', 'email', 'soldier', 'hacker', 'call'];
export const pageTier = Object.freeze({
  '/wiki/corvus/namesakes': 'email',
  '/wiki/corvus': 'soldier',
  '/wiki/pidgy': 'soldier',
  '/legion/hacker-room': 'hacker',
  '/legion/call-room': 'call'
});
export const tasteSeconds = 4 * 60 + 2;

export function tierPath(pathname) {
  let path;
  try { path = decodeURIComponent(pathname); } catch { return null; }
  path = path.replace(/\/{2,}/g, '/').replace(/\/index(?:\.html)?\/?$/i, '').replace(/\/+$/, '');
  return Object.hasOwn(pageTier, path) ? path : null;
}
