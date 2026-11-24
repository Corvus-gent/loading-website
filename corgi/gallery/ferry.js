(() => {
  const DEPART = "2026-11-24T06:30:00Z";
  const departure = Date.parse(DEPART);
  const block = document.querySelector('[data-ferry-countdown]');
  const fallback = block.querySelector('[data-ferry-fallback]');
  const upcoming = block.querySelector('[data-ferry-upcoming]');
  const digits = block.querySelector('[data-ferry-digits]');

  function tick() {
    const remaining = departure - Date.now();
    if (remaining <= 0) {
      fallback.textContent = '⛴ On my way back to Gent.';
      fallback.hidden = false;
      upcoming.hidden = true;
      return;
    }

    const seconds = Math.ceil(remaining / 1000);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor(seconds / 60) % 60;
    digits.textContent = [hours, minutes, seconds % 60]
      .map(value => String(value).padStart(2, '0')).join(':');

    fallback.hidden = true;
    upcoming.hidden = false;
    setTimeout(tick, remaining % 1000 || 1000);
  }

  tick();
})();
