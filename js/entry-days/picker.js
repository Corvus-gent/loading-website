import {ENTRANCES, PREFERENCE_KEY, resolveEntrance, isChoice} from './calendar.js';
const LOADERS = {
  tue: () => import('./glyphs.js'), wed: () => import('./ink.js'), thu: () => import('./water.js'),
  fri: () => import('./room.js'), sat: () => import('./mirror.js'), sun: () => import('./night.js'),
};
const LINES = {
  tue: 'A little ink. A little light. Find the way in.', wed: 'Out of ink, a guide.',
  thu: 'Stable ink. Living light.', fri: 'Three doors. One empty seat.',
  sat: 'The circus remembers its reflection.', sun: 'Some doors only open in the dark.',
};
export function mountPicker(stage, light) {
  const toggle = document.getElementById('entry-picker-toggle');
  const list = document.getElementById('entry-options');
  if (!toggle || !list) return; // Older cached Monday markup still works.
  const options = [...list.querySelectorAll('[role="option"]')];
  const caption = document.getElementById('entry-caption');
  const room = document.getElementById('entry-room-doors');
  const status = document.getElementById('entry-day-status');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let stored;
  try { stored = localStorage.getItem(PREFERENCE_KEY); } catch {}
  let selection = resolveEntrance(new URL(location.href).searchParams.get('entry'), stored);
  let abort, revision = 0;
  function close(focus = false) {
    list.hidden = true; toggle.setAttribute('aria-expanded', 'false');
    if (focus) toggle.focus();
  }
  function open(index) {
    list.hidden = false; toggle.setAttribute('aria-expanded', 'true');
    const target = options[index ?? options.findIndex(o => o.dataset.choice === selection.choice)] || options[0];
    target.focus();
  }
  toggle.addEventListener('click', () => { if (list.hidden) open(); else close(); });
  toggle.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); open(e.key === 'ArrowDown' ? 0 : options.length - 1); }
  });
  list.addEventListener('keydown', e => {
    const index = options.indexOf(document.activeElement);
    let next;
    if (e.key === 'ArrowDown') next = (index + 1) % options.length;
    if (e.key === 'ArrowUp') next = (index - 1 + options.length) % options.length;
    if (e.key === 'Home') next = 0;
    if (e.key === 'End') next = options.length - 1;
    if (next !== undefined) { e.preventDefault(); options[next].focus(); }
    if (e.key === 'Escape') { e.preventDefault(); close(true); }
    if (e.key === 'Tab') close(true);
  });
  for (const option of options) option.addEventListener('click', () => choose(option.dataset.choice));
  document.addEventListener('pointerdown', e => { if (!e.target.closest('.entry-picker')) close(); });
  document.addEventListener('focusin', e => { if (!e.target.closest('.entry-picker')) close(); });
  function present(day, failed = false) {
    document.body.dataset.entry = day;
    document.body.dataset.entryMotion = motion.matches ? 'still' : 'animated';
    stage.dispatchEvent(new Event('entrydaychange', {bubbles: true}));
    room.hidden = day !== 'fri';
    caption.hidden = day === 'mon'; caption.textContent = LINES[day] || '';
    toggle.textContent = `entrance: ${selection.choice === 'today' ? 'today' : ENTRANCES.find(d => d.id === selection.choice).label.split(' · ')[1]} ▾`;
    for (const option of options) {
      option.setAttribute('aria-selected', String(option.dataset.choice === selection.choice));
      option.tabIndex = -1;
    }
    status.textContent = failed ? 'This entrance is unavailable. The Lantern entrance is ready.' : `${ENTRANCES.find(d => d.id === day).label}${motion.matches ? ' · still' : ''}`;
  }
  async function render() {
    const run = ++revision;
    abort?.abort(); abort = new AbortController();
    const signal = abort.signal;
    const day = selection.day;
    present(day);
    document.body.dataset.entryReady = day === 'mon' ? 'true' : 'loading';
    if (day === 'mon') return;
    const fail = () => {
      if (signal.aborted || run !== revision) return;
      abort.abort(); present('mon', true); document.body.dataset.entryReady = 'fallback';
    };
    try {
      const module = await LOADERS[day]();
      if (signal.aborted) return;
      await module.mount({stage, light, signal, still: motion.matches, fail});
      if (!signal.aborted) document.body.dataset.entryReady = 'true';
    } catch (error) { if (error.name !== 'AbortError') fail(); }
  }
  function choose(choice) {
    if (!isChoice(choice)) return;
    selection = resolveEntrance(choice, null);
    try { localStorage.setItem(PREFERENCE_KEY, choice); } catch {}
    const url = new URL(location.href); url.searchParams.set('entry', choice);
    history.replaceState(null, '', url);
    close(true); void render();
  }
  motion.addEventListener('change', () => { void render(); });
  // Re-evaluate calendar selection after local midnight or a sleeping tab resumes.
  const refresh = () => {
    if (document.hidden || selection.choice !== 'today') return;
    const next = resolveEntrance('today', null);
    if (next.day !== selection.day) { selection = next; void render(); }
  };
  let midnightCheck = setInterval(refresh, 60_000);
  document.addEventListener('visibilitychange', refresh);
  addEventListener('pageshow', refresh);
  addEventListener('pagehide', () => { close(); clearInterval(midnightCheck); abort?.abort(); });
  addEventListener('pageshow', e => {
    if (e.persisted) { midnightCheck = setInterval(refresh, 60_000); void render(); }
  });
  void render();
}
