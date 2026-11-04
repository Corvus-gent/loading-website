// Functional preferences only. Never use these values as analytics identifiers.
const YEAR = 365 * 86400000;
export function savePreference(key, value) {
  try { localStorage.setItem(key, JSON.stringify({value, expires: Date.now() + YEAR})); } catch {}
}
export function readPreference(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    let item;
    try { item = JSON.parse(raw); } catch { item = raw; }
    if (item && typeof item === 'object' && Object.hasOwn(item, 'expires')) {
      if (!Number.isFinite(item.expires) || item.expires <= Date.now()) { localStorage.removeItem(key); return fallback; }
      return item.value;
    }
    // Existing preferences were explicitly chosen before retention was added.
    savePreference(key, item);
    return item;
  } catch { return fallback; }
}
