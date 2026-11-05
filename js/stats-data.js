// Start the one page request independently of translations, charts and analytics.
(() => {
  const page = document.currentScript.dataset.page;
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Brussels' }).format(new Date());
  const input = page === 'overview' && new URLSearchParams(location.search).get('day');
  const valid =
    typeof input === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(input) &&
    new Date(input + 'T12:00Z').toJSON()?.slice(0, 10) === input;
  const tomorrow = new Date(Date.parse(today) + 86400000).toISOString().slice(0, 10);
  const selected = valid
    ? input < '2026-11-02'
      ? '2026-11-02'
      : input > tomorrow
        ? tomorrow
        : input
    : today;
  const cache = new Map(),
    pending = new Map(),
    listeners = new Map(),
    retry = new Map();
  const limit = (name) => ({ coffee: 1800, x: 900 })[name] || 60;
  const storageKey = (name, day) => 'stats:snap:v1:' + name + ':' + day;
  function saved(name, day) {
    const key = storageKey(name, day);
    if (name === 'private') return null;
    let s = cache.get(key);
    try {
      if (!s) s = JSON.parse(sessionStorage.getItem(key));
    } catch {}
    if (
      s?.data &&
      s.page === name &&
      (s.final || Date.now() - Date.parse(s.checked || s.updated) < (name === 'x' ? 1 : 7) * 86400000)
    )
      return s;
    return null;
  }
  function load(name, day, force = false) {
    const k = storageKey(name, day);
    if (pending.has(k)) return pending.get(k);
    const old = saved(name, day);
    if (
      !force &&
      old &&
      !old.stale &&
      old.state === 'ready' &&
      (old.final || Date.now() - Date.parse(old.checked || old.updated) < limit(name) * 1000)
    )
      return Promise.resolve(old);
    const promise = fetch('/api/stats?' + new URLSearchParams({ page: name, day }), {
      credentials: name === 'private' ? 'same-origin' : 'omit',
      ...(name === 'private' ? { cache: 'no-store' } : {}),
      signal: AbortSignal.timeout(8000)
    })
      .then(async (r) => {
        if (r.status === 401 && name === 'private') return { state: 'login', data: null };
        if (!r.ok) throw Error('snapshot unavailable');
        const s = await r.json();
        if (s.page !== name || !s.data) {
          if (old) return { ...old, stale: true };
          return s.page === name ? s : { state: 'unavailable', data: null };
        }
        if (name !== 'private') {
          cache.set(k, s);
          try {
            sessionStorage.setItem(k, JSON.stringify(s));
          } catch {}
        }
        return s;
      })
      .catch(() => (old ? { ...old, stale: true } : { state: 'unavailable', data: null }))
      .then((s) => {
        const active = listeners.get(k);
        active?.forEach((fn) => fn(s));
        return s;
      })
      .finally(() => pending.delete(k));
    pending.set(k, promise);
    return promise;
  }
  let shown, viewDay;
  function age() {
    const label = document.querySelector('[data-snapshot-age]');
    if (!label || !shown) return;
    const s = shown;
    if (!s.updated) {
      label.textContent =
        s.state === 'login'
          ? ''
          : s.state === 'warming'
            ? 'preparing the first snapshot…'
            : 'snapshot unavailable.';
      return;
    }
    const mins = Math.max(0, Math.floor((Date.now() - Date.parse(s.updated)) / 60000));
    label.textContent =
      (s.day && s.day !== viewDay ? s.day + ' · ' : '') +
      (s.state === 'partial' ? 'partial snapshot · ' : s.stale ? 'last saved snapshot · ' : '') +
      'updated ' +
      (mins ? mins + ' min ago' : 'just now');
  }
  function watch(name, day, render) {
    const k = storageKey(name, day),
      callbacks = listeners.get(k) || new Set();
    listeners.set(k, callbacks);
    const fn = (s) => {
      shown = s;
      viewDay = day;
      age();
      render(s);
      const tries = retry.get(k) || 0;
      if (['warming','partial'].includes(s.state) && tries < 4) {
        retry.set(k, tries + 1);
        setTimeout(
          () => {
            if (callbacks.has(fn)) load(name, day, true);
          },
          1000 * 2 ** tries
        );
      }
    };
    callbacks.add(fn);
    const old = saved(name, day);
    if (old) fn(old);
    // A completed early request, including login/empty, is consumed once by the view.
    if (name === page && day === selected && initial) {
      const p = initial;
      initial = null;
      p.then((s) => {
        if (callbacks.has(fn) && shown !== s) fn(s);
      });
    } else
      load(name, day).then((s) => {
        if (callbacks.has(fn) && shown !== s) fn(s);
      });
    return () => callbacks.delete(fn);
  }
  let initial = selected <= today ? load(page, selected) : null;
  window.statsPage = { page, today, selected, watch, load };
  const prefetch = (e) => {
    if (navigator.connection?.saveData) return;
    const a = e.target.closest?.('[data-stat],#prev');
    if (!a) return;
    if (a.id === 'prev' && !a.disabled) {
      const d = new URLSearchParams(location.search).get('day') || today;
      load('overview', new Date(Date.parse(d) - 86400000).toISOString().slice(0, 10));
    } else if (a.dataset.stat && a.dataset.stat !== 'private') load(a.dataset.stat, today);
  };
  for (const type of ['pointerover', 'touchstart', 'focusin'])
    document.addEventListener(type, prefetch, { passive: true });
  setInterval(() => {
    if (!document.hidden) age();
  }, 60000);
})();
