// Server-side PostHog queries (HogQL). The personal API key never reaches the browser.
const HOST = process.env.POSTHOG_HOST || "https://eu.posthog.com";
const PROJECT = process.env.POSTHOG_PROJECT_ID || "331552";
const KEY = process.env.POSTHOG_PERSONAL_API_KEY;

const EU_HOST = (() => {
  try {
    const url = new URL(HOST);
    return url.protocol === 'https:' && url.hostname === 'eu.posthog.com' && !url.port && !url.username && !url.password && !url.search && !url.hash && url.pathname === '/';
  } catch { return false; }
})();
export const posthogReady = () => Boolean(KEY) && EU_HOST;

export async function hogql(sql) {
  if (!posthogReady()) throw new Error('PostHog EU configuration required');
  const r = await fetch(`${HOST}/api/projects/${PROJECT}/query/`, {
    method: "POST",
    signal: AbortSignal.timeout(10000),
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: { kind: "HogQLQuery", query: sql } }),
  });
  if (!r.ok) throw new Error(`posthog ${r.status}`);
  return (await r.json()).results || [];
}

// only real traffic on corvus.gent, no local testing
export const REAL = `properties.$host IN ('corvus.gent', 'www.corvus.gent', 'stats.corvus.gent') AND timestamp >= toDateTime('2026-11-02 00:00:00')`;
