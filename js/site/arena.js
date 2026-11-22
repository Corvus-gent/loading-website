import './never-stop.js?v=20261122less1';
// Home only: "get in touch" reveals the contact links in reserved space.
const toggle = document.querySelector('[data-arena-touch]');
const list = toggle && document.getElementById(toggle.getAttribute('aria-controls'));
if (toggle && list) {
  const set = open => {
    list.classList.toggle('show', open);
    toggle.setAttribute('aria-expanded', String(open));
    list.toggleAttribute('inert', !open);
  };
  set(false);
  toggle.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    set(open);
    if (open) list.querySelector('a')?.focus({preventScroll: true});
  });
  list.addEventListener('keydown', e => {
    if (e.key === 'Escape') { set(false); toggle.focus(); }
  });
}

// Curtains between rooms: close on the way out, open on the way in.
const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
if (!still) {
  const KEY = 'corvus-curtain';
  const curtain = document.createElement('div');
  curtain.className = 'curtain';
  curtain.setAttribute('aria-hidden', 'true');
  curtain.innerHTML = '<i></i><i></i>';
  let arriving = false;
  try { arriving = sessionStorage.getItem(KEY) === '1'; sessionStorage.removeItem(KEY); } catch {}
  const firstVisit = document.body.querySelector('.arena-home') && !arriving;
  if (arriving || firstVisit) curtain.classList.add('closed');
  if (firstVisit) curtain.classList.add('slow');
  document.body.append(curtain);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    curtain.classList.remove('closed');
    setTimeout(() => curtain.classList.remove('slow'), 950);
  }));
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (a.target && a.target !== '_self' || a.hasAttribute('download')) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin || (url.pathname === location.pathname && url.search === location.search)) return;
    if (url.pathname.startsWith('/api/')) return;
    e.preventDefault();
    try { sessionStorage.setItem(KEY, '1'); } catch {}
    curtain.classList.add('closed');
    setTimeout(() => location.assign(url.href), 430);
  });
  window.addEventListener('pageshow', e => { if (e.persisted) curtain.classList.remove('closed'); });
}

// The realm reveals itself slowly. Tap Wing to hurry it, Tab or scroll to see it all.
const home = document.querySelector('.arena-home');
if (home) {
  const steps = [...home.querySelectorAll('[data-reveal]:not([data-reveal="scroll"]):not([data-reveal="act"])')]
    .sort((a, b) => a.dataset.reveal - b.dataset.reveal);
  const timers = [];
  const showAll = () => { timers.forEach(clearTimeout); home.querySelectorAll('[data-reveal]').forEach(el => el.classList.add('on')); };
  if (still) showAll();
  else {
    const at = [900, 2000, 3600, 5600, 7400];
    steps.forEach((el, i) => timers.push(setTimeout(() => el.classList.add('on'), at[i] ?? 7400 + i * 900)));
    const io = new IntersectionObserver(entries => entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el = entry.target; io.unobserve(el); el.classList.add('on');
      el.querySelectorAll('[data-reveal="act"]').forEach((act, i) => setTimeout(() => act.classList.add('on'), 300 + i * 260));
    }), {threshold: .2});
    home.querySelectorAll('[data-reveal="scroll"]').forEach(el => io.observe(el));
    document.addEventListener('keydown', e => { if (e.key === 'Tab') showAll(); }, {once: true});
  }
  const wingButton = home.querySelector('[data-wing]'), bubble = home.querySelector('[data-wing-bubble]');
  const LINES = ['welcome to the realm.', 'caw. the words are shy. they come slowly.', 'five acts tonight. scroll down.', 'join the Legion waitlist. higher ranks are earned.', 'lost? press / and say where you want to go.', 'Diogenes returns at dawn with a new question.'];
  let said = 0, hide;
  wingButton?.addEventListener('click', () => {
    const next = steps.find(el => !el.classList.contains('on'));
    if (next) next.classList.add('on');
    bubble.textContent = LINES[said++ % LINES.length];
    bubble.classList.add('on'); clearTimeout(hide);
    hide = setTimeout(() => bubble.classList.remove('on'), 3200);
  });
}


// "What is Corvus?" — the story crawls into the stars.
const crawlBox = document.getElementById('crawl'), crawlOpen = document.querySelector('[data-crawl-open]');
if (crawlBox && crawlOpen && crawlBox.showModal) {
  const timers = [];
  const at = (fn, ms) => timers.push(setTimeout(fn, ms));
  const clear = () => { timers.forEach(clearTimeout); timers.length = 0; };
  const stars = crawlBox.querySelector('.crawl-stars');
  if (stars && !stars.childElementCount) {
    const count = innerWidth < 700 ? 90 : 220;
    for (let i = 0; i < count; i++) {
      const s = document.createElement('i');
      if (Math.random() < .15) s.className = 'lilac';
      s.style.cssText = `left:${Math.random() * 100}%;top:${Math.random() * 100}%;--s:${(Math.random() < .9 ? 1 : 2)}px;--t:${(2 + Math.random() * 5).toFixed(1)}s;--d:${(-Math.random() * 6).toFixed(1)}s`;
      stars.append(s);
    }
  }
  const art = [...crawlBox.querySelectorAll('.crawl-art img')];
  const placeArt = () => art.forEach((img, i) => {
    const left = i % 2 === 0, w = innerWidth < 700 ? 84 : 120 + Math.random() * 70;
    img.classList.remove('on');
    img.style.cssText = `${left ? 'left' : 'right'}:${(2 + Math.random() * 9).toFixed(1)}vw;top:${(8 + (i >> 1) * 28 + Math.random() * 10).toFixed(1)}%;--w:${w.toFixed(0)}px;--ry:${(left ? 1 : -1) * (14 + Math.random() * 18)}deg;--rz:${(-10 + Math.random() * 20).toFixed(1)}deg;--o:${(.35 + Math.random() * .3).toFixed(2)}`;
  });
  const finish = () => { clear(); crawlBox.classList.add('panned', 'ended'); art.forEach(img => img.classList.remove('on')); };
  crawlOpen.addEventListener('click', () => {
    const word = document.querySelector('[data-hall-today]')?.textContent.match(/never stop ([^.]+)\./)?.[1];
    if (word) crawlBox.querySelector('[data-crawl-word]').textContent = word;
    crawlBox.classList.remove('ended', 'rolling', 'panned', 'flyby', 'static');
    placeArt(); crawlBox.showModal();
    if (still) {
      crawlBox.classList.add('ended', 'static');
      crawlBox.querySelector('.end-wait-row input')?.focus();
      return;
    }
    void crawlBox.offsetWidth; crawlBox.classList.add('rolling');
    // One or two pieces at a time, never a wall of references.
    art.forEach((img, i) => { at(() => img.classList.add('on'), 12000 + i * 6000); at(() => img.classList.remove('on'), 12000 + i * 6000 + 9000); });
    at(() => crawlBox.classList.add('flyby'), 47000);
    at(() => crawlBox.classList.add('panned'), 50000);
    at(() => finish(), 52500);
  });
  const skip = e => {
    if (crawlBox.classList.contains('ended')) return;
    e.preventDefault(); finish(); crawlBox.querySelector('.end-wait-row input')?.focus();
  };
  crawlBox.querySelector('.crawl-close button').addEventListener('click', skip);
  crawlBox.addEventListener('cancel', skip);
  crawlBox.addEventListener('close', () => { clear(); crawlBox.classList.remove('rolling', 'ended', 'panned', 'flyby'); crawlOpen.focus(); });
}


// Concept: "the ring tells it". Try it with ?story=ring.
if (crawlOpen && new URLSearchParams(location.search).get('story') === 'ring') {
  const after = document.querySelector('[data-ring-after]'), live = document.querySelector('[data-ring-live]');
  crawlOpen.addEventListener('click', e => {
    e.stopImmediatePropagation();
    if (document.body.classList.contains('ring-story')) { dispatchEvent(new Event('corvus-ring-story-skip')); return; }
    document.body.classList.add('ring-story'); after.hidden = true;
    crawlOpen.textContent = 'skip';
    dispatchEvent(new Event('corvus-ring-story'));
  }, true);
  addEventListener('corvus-ring-story-line', e => { if (live) live.textContent = e.detail.line; });
  addEventListener('corvus-ring-story-end', () => {
    document.body.classList.remove('ring-story'); after.hidden = false; crawlOpen.textContent = 'tell me again';
    after.querySelector('a')?.focus({preventScroll: true});
  });
  addEventListener('keydown', e => { if (e.key === 'Escape' && document.body.classList.contains('ring-story')) dispatchEvent(new Event('corvus-ring-story-skip')); });
}
