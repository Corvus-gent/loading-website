export const NIGHT = '#07060a';
export const GOLD = '#ffd76a';
export const PLUM = ['#1d1430', '#33264b', '#46335f', '#5b3e8c', '#7a5cb0', '#b4a0d6'];
export const RAMP = " .'`,:;-~=+*ixo#%@";
export function image(src, signal) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const timer = setTimeout(() => finish(new Error('Entrance image timed out')), 8000);
    const aborted = () => finish(new DOMException('Entrance changed', 'AbortError'));
    function finish(error) {
      clearTimeout(timer);
      signal.removeEventListener('abort', aborted);
      img.onload = img.onerror = null;
      if (error) reject(error); else resolve(img);
    }
    img.onload = () => finish();
    img.onerror = () => finish(new Error('Entrance image unavailable'));
    signal.addEventListener('abort', aborted, {once: true});
    if (signal.aborted) return aborted();
    img.src = src;
  });
}
export function offscreen(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.floor(w)); canvas.height = Math.max(1, Math.floor(h));
  const ctx = canvas.getContext('2d', {willReadFrequently: true});
  if (!ctx) throw new Error('Canvas unavailable');
  return {canvas, ctx};
}
// A single scheduled frame loop. A still gets one draw, not an idle RAF loop.
export function canvasScene(api, setup) {
  const canvas = document.createElement('canvas');
  canvas.className = 'entry-art'; canvas.setAttribute('aria-hidden', 'true');
  const ctx = canvas.getContext('2d', {alpha: false});
  if (!ctx) throw new Error('Canvas unavailable');
  let raf = 0, previous = null, lastDraw = null, elapsed = 0, stopped = false;
  let width = 0, height = 0;
  const scene = setup(ctx);
  const signal = api.signal;
  const cancel = () => { cancelAnimationFrame(raf); raf = 0; previous = lastDraw = null; };
  const draw = () => {
    try { stopped = scene.draw(api.still ? 0 : elapsed, width, height) === false; }
    catch (error) { cancel(); api.fail(error); }
  };
  function tick(now) {
    raf = 0;
    if (signal.aborted || document.hidden || api.still || stopped) return;
    elapsed += previous === null ? 0 : Math.min(50, now - previous) / 1000;
    previous = now;
    if (lastDraw === null || now - lastDraw >= 32) { lastDraw = now; draw(); }
    if (!signal.aborted && !stopped) raf = requestAnimationFrame(tick);
  }
  function wake() {
    if (!raf && !signal.aborted && !api.still && !document.hidden && !stopped) raf = requestAnimationFrame(tick);
  }
  function resize() {
    cancel();
    width = Math.max(1, Math.floor(api.stage.clientWidth));
    height = Math.max(1, Math.floor(api.stage.clientHeight));
    const mobile = width < 700 || matchMedia('(pointer: coarse)').matches;
    const dpr = Math.min(devicePixelRatio || 1, mobile ? 1 : 1.5);
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    scene.resize?.(width, height);
    draw(); wake();
  }
  const invalidate = () => { if (api.still || stopped) draw(); };
  canvas.addEventListener('contextlost', () => api.fail(new Error('Entrance context lost')), {signal});
  signal.addEventListener('abort', () => { cancel(); canvas.remove(); }, {once: true});
  addEventListener('resize', resize, {signal});
  api.stage.addEventListener('entrylight', invalidate, {signal});
  document.addEventListener('visibilitychange', () => { if (document.hidden) cancel(); else wake(); }, {signal});
  if (signal.aborted) return;
  api.stage.prepend(canvas);
  try { resize(); } catch (error) { canvas.remove(); throw error; }
  canvas.dataset.ready = 'true';
  return {canvas};
}
export function glow(ctx, x, y, radius, opacity = 0.2) {
  const g = ctx.createRadialGradient(x, y, 1, x, y, Math.max(2, radius));
  g.addColorStop(0, `rgba(255,215,106,${opacity})`); g.addColorStop(1, 'rgba(255,215,106,0)');
  ctx.fillStyle = g; ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}
