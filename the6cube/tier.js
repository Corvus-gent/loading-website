// Device tiers. S: WebGPU + desktop (no touch-primary) + >= 8 cores. A: anything with WebGL2. B: no WebGL2, data-saver, <= 2 GB RAM or reduced motion.
// ?tier=S|A|B overrides (for testing). The result is exposed as document.documentElement.dataset.tier.
export function detectTier(env = globalThis) {
  const nav = env.navigator || {}, doc = env.document;
  let forced = null; try { forced = new URLSearchParams(env.location?.search || '').get('tier')?.toUpperCase(); } catch { /* no URL → no override */ }
  if (forced === 'S' || forced === 'A' || forced === 'B') return forced;
  const mq = q => { try { return !!env.matchMedia?.(q).matches; } catch { return false; } };
  let webgl2 = false; try { webgl2 = !!doc?.createElement('canvas').getContext('webgl2'); } catch { /* blocked */ }
  if (!webgl2 || nav.connection?.saveData || (nav.deviceMemory && nav.deviceMemory <= 2) || mq('(prefers-reduced-motion: reduce)')) return 'B';
  const touchPrimary = mq('(pointer: coarse)') || mq('(hover: none)');
  if (nav.gpu && !touchPrimary && (nav.hardwareConcurrency || 0) >= 8) return 'S';
  return 'A';
}
export const TIER = detectTier();
if (typeof document !== 'undefined') document.documentElement.dataset.tier = TIER;
/** Scale a count by tier: S full, A half, B quarter. */
export const byTier = (n, tier = TIER) => Math.max(1, Math.round(n * (tier === 'S' ? 1 : tier === 'A' ? .5 : .25)));
