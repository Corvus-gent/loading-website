// Start the one page request independently of translations, charts and analytics.
(() => {
  const page = document.currentScript.dataset.page;
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Brussels' }).format(new Date());
  const input = ['overview','map'].includes(page) && new URLSearchParams(location.search).get('day');
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
    checkedThisVisit = new Set(),
    pending = new Map(),
    listeners = new Map();
  const limit = (name) => ({ coffee: 1800, x: 900 })[name] || 60;
  const storageKey = (name, day) => 'stats:snap:' + (name === 'map' ? 'v6:' : 'v1:') + name + ':' + day;
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
      (old.final ? checkedThisVisit.has(k) : Date.now() - Date.parse(old.checked || old.updated) < limit(name) * 1000)
    )
      return Promise.resolve(old);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const promise = fetch('/api/stats?' + new URLSearchParams({ page: name, day, ...(name === 'map' ? {geo:'6'} : {}) }), {
      credentials: name === 'private' ? 'same-origin' : 'omit',
      ...(name === 'private' ? { cache: 'no-store' } : {}),
      signal: controller.signal
    })
      .then(async (r) => {
        if (r.status === 401 && name === 'private') return { state: 'login', data: null };
        if (!r.ok) throw Error('snapshot unavailable');
        const s = await r.json();
        if (s.page !== name || !s.data) {
          if (old)
            return { ...old, stale: true, reason: s.reason || 'api', working: s.state === 'warming' };
          return s.page === name ? s : { state: 'unavailable', data: null };
        }
        if (name !== 'private') {
          cache.set(k, s);
          checkedThisVisit.add(k);
          try {
            sessionStorage.setItem(k, JSON.stringify(s));
          } catch {}
        }
        return s;
      })
      .catch(() => {
        const reason = controller.signal.aborted
          ? 'timeout'
          : navigator.onLine === false
            ? 'offline'
            : 'api';
        return old ? { ...old, stale: true, reason } : { state: 'unavailable', data: null, reason };
      })
      .then((s) => {
        const active = listeners.get(k);
        active?.forEach((fn) => fn(s));
        return s;
      })
      .finally(() => {
        clearTimeout(timeout);
        pending.delete(k);
      });
    pending.set(k, promise);
    return promise;
  }
  let shown, viewDay;
  let translatePageText = text => text;
  let formatPageText = (text, values) => text.replace(/\{(\w+)\}/g, (key, name) => values[name] ?? key);
  function refreshLanguage() {
    age();
    if (feedback?.message) feedback.text.textContent = feedback.message();
  }
  function age() {
    const label = document.querySelector('[data-snapshot-age]');
    if (!label || !shown) return;
    const s = shown;
    if (!s.updated) {
      label.textContent = '';
      return;
    }
    const mins = Math.max(0, Math.floor((Date.now() - Date.parse(s.updated)) / 60000));
    const relative = new Intl.RelativeTimeFormat(document.documentElement.lang || 'en', {
      numeric: 'auto', style: 'short'
    });
    const time = mins ? relative.format(-mins, 'minute') : translatePageText('just now');
    const state = s.state === 'partial' ? 'partial snapshot' : s.stale ? 'last saved snapshot' : '';
    label.textContent = [
      s.day && s.day !== viewDay ? s.day : '',
      state && translatePageText(state),
      formatPageText('updated {time}', { time })
    ].filter(Boolean).join(' · ');
  }
  let feedback;
  function panel() {
    if (feedback) return feedback;
    const root = document.createElement('div');
    root.className = 'stats-feedback';
    root.hidden = true;
    root.innerHTML =
      '<p role="status" aria-live="polite"></p><div class="stats-track" role="progressbar" aria-label="loading statistics"><i></i></div><div class="stats-actions"><button type="button">try again</button><a>service status →</a></div>';
    const anchor = document.querySelector('#visitors, #private-pending, [data-snapshot-age]');
    anchor.before(root);
    const link = root.querySelector('a');
    link.href = page === 'status' ? '/api/health' : 'https://stats.corvus.gent/status';
    feedback = {
      root,
      text: root.querySelector('p'),
      bar: root.querySelector('[role=progressbar]'),
      actions: root.querySelector('.stats-actions'),
      button: root.querySelector('button')
    };
    return feedback;
  }
  function notice(message, suffix) {
    return [message, suffix].filter(Boolean).map(translatePageText).join(' ');
  }
  function describe(s, busy) {
    if (s.reason === 'storage-and-source') return translatePageText('stats storage and a data source are unavailable.');
    if (s.reason === 'storage') {
      if (busy) return translatePageText('stats storage (redis) is unavailable. checking other sources…');
      return notice('stats storage (redis) is unavailable.', s.data && 'showing the available figures.');
    }
    if (s.reason === 'source')
      return notice('a stats data source failed to respond.', s.data && 'showing the available figures.');
    if (s.reason === 'timeout') return translatePageText('the stats request took too long.');
    if (s.reason === 'offline') return translatePageText('you appear to be offline.');
    if (s.reason === 'history') return translatePageText('there is no saved report for this day.');
    if (!busy && !s.reason && s.stale) return translatePageText('showing the last saved figures.');
    if (busy) return translatePageText(s.state === 'warming' ? 'preparing the figures…' : 'loading stats…');
    return notice('the stats API is unavailable.', s.data && 'showing the last saved figures.');
  }
  function watch(name, day, render) {
    const k = storageKey(name, day),
      callbacks = listeners.get(k) || new Set();
    listeners.set(k, callbacks);
    const ui = panel();
    let active = true,
      tries = 0,
      timer,
      delay,
      received;
    function paint(s, busy) {
      ui.root.hidden =
        !busy && !s.reason && s.state !== 'unavailable' && s.state !== 'partial' && !s.stale;
      ui.message = ui.root.hidden ? null : () => describe(s, busy);
      if (!ui.message) return;
      ui.text.textContent = ui.message();
      ui.bar.hidden = !busy;
      ui.actions.hidden = busy;
    }
    function accept(s) {
      if (!active) return;
      received = s;
      clearTimeout(delay);
      clearTimeout(timer);
      const waiting = s.state === 'warming' || s.working === true;
      const expired = waiting && tries >= 5;
      const view = expired
        ? {
            ...s,
            state: s.data ? 'partial' : 'unavailable',
            reason: s.reason === 'storage' ? 'storage' : 'timeout',
            working: false
          }
        : s;
      shown = view;
      viewDay = day;
      age();
      render(view);
      paint(view, waiting && !expired);
      if (waiting && !expired) {
        timer = setTimeout(
          () => {
            tries++;
            load(name, day, true);
          },
          Math.min(1000 * 2 ** tries, 6000)
        );
      }
    }
    callbacks.add(accept);
    ui.root.hidden = true;
    const old = saved(name, day);
    if (old) accept(old);
    function start() {
      // Avoid flashing the indicator on a fast cache hit.
      delay = setTimeout(() => {
        if (active) paint({ state: 'loading' }, true);
      }, 350);
    }
    ui.button.onclick = () => {
      tries = 0;
      clearTimeout(timer);
      paint({ state: 'loading' }, true);
      load(name, day, true);
    };
    const first = name === page && day === selected && initial ? initial : load(name, day);
    if (first === initial) initial = null;
    if (!old) start();
    first.then((s) => {
      if (active && received !== s) accept(s);
    });
    return () => {
      active = false;
      clearTimeout(delay);
      clearTimeout(timer);
      callbacks.delete(accept);
      if (!callbacks.size) listeners.delete(k);
      ui.root.hidden = true;
      ui.message = null;
    };
  }
  let initial = selected <= today ? load(page, selected) : null;
  window.statsPage = { page, today, selected, watch, load };
  window.addEventListener('corvus-page-copy-ready', refreshLanguage);
  import('./i18n/page-copy.js').then(copy => {
    ({ translatePageText, formatPageText } = copy);
    refreshLanguage();
  });
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
