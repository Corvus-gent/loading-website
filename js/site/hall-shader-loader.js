const hall = document.querySelector('.arena-home [data-hall]');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');

if (hall && navigator.gpu && !reduced.matches && 'IntersectionObserver' in window) {
  let visible = false;
  let pending = false;
  let failed = false;
  let renderer;
  const active = () => visible && !document.hidden && !reduced.matches;

  function update() {
    if (reduced.matches && renderer) {
      renderer.dispose();
      renderer = undefined;
    }
    renderer?.setActive(active());
    if (!active() || pending || renderer || failed) return;
    pending = true;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if ('requestIdleCallback' in window) requestIdleCallback(load, {timeout: 1800});
      else setTimeout(load, 150);
    }));
  }

  async function load() {
    try {
      if (!active()) return;
      const {mountHallShader} = await import('/public/site/hall-shader.js');
      if (!active()) return;
      renderer = await mountHallShader(hall, () => { failed = true; });
    } catch {
      failed = true;
    } finally {
      pending = false;
      update();
    }
  }

  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    update();
  });
  observer.observe(hall);
  document.addEventListener('visibilitychange', update);
  reduced.addEventListener('change', update);
}
