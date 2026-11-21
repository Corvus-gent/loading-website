const comparison = document.querySelector('.comparison');
const radar = document.querySelector('.landing-radar');

if ('IntersectionObserver' in window) {
  const portraits = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) return;
    comparison.setAttribute('data-portraits', '');
    portraits.disconnect();
  }, { rootMargin: '180px 0px' });
  portraits.observe(comparison);
} else {
  comparison.setAttribute('data-portraits', '');
}

const motion = matchMedia('(prefers-reduced-motion: reduce)');
let onScreen = false;
function syncRadar() {
  radar.toggleAttribute('data-animated', onScreen && !motion.matches && !document.hidden);
}

// A double frame after load lets the static sonar paint before any motion starts.
function enableRadar() {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    if ('IntersectionObserver' in window) {
      const view = new IntersectionObserver(([entry]) => {
        onScreen = entry.isIntersecting;
        syncRadar();
      }, { threshold: .15 });
      view.observe(radar);
    } else {
      onScreen = true;
      syncRadar();
    }
    motion.addEventListener('change', syncRadar);
    document.addEventListener('visibilitychange', syncRadar);
  }));
}
if (document.readyState === 'complete') enableRadar();
else window.addEventListener('load', enableRadar, { once: true });
