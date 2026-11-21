import { wireSound, playBaySound } from './sound.js';

const comparison = document.querySelector('.comparison');
async function showDeckCrew() {
  try {
    const { crewAvatar, loadCrew } = await import('./event-data.js');
    const attendees = await loadCrew();
    const byId = new Map(attendees.map(person => [person.id, person]));
    for (const slot of comparison.querySelectorAll('[data-pirate]')) {
      const person = byId.get(slot.dataset.pirate);
      if (person) slot.prepend(crewAvatar(person));
    }
  } catch { /* The names and match reasons are in the page HTML. */ }
}

if ('IntersectionObserver' in window) {
  const deck = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) return;
    void showDeckCrew();
    deck.disconnect();
  }, { rootMargin: '180px 0px' });
  deck.observe(comparison);
} else void showDeckCrew();

wireSound(document.querySelector('#bay-sound'));

const stage = document.querySelector('#naval-stage');
const canvas = document.querySelector('#naval-sea');
const motion = matchMedia('(prefers-reduced-motion: reduce)');
let visible = false;
let drawing;
let starting = false;
let frame = 0;
let last = 0;
let elapsed = .5;
let loopLength;
let cannonBeat;

function tick(now) {
  const span = now - last;
  if (span >= 15) {
    const previous = elapsed % loopLength;
    elapsed += Math.min(span, 120) / 1000;
    if (previous < cannonBeat && elapsed % loopLength >= cannonBeat) playBaySound('cannon');
    drawing(elapsed);
    last = now;
  }
  frame = requestAnimationFrame(tick);
}

async function syncSea() {
  if (!visible || motion.matches || document.hidden) {
    cancelAnimationFrame(frame);
    frame = 0;
    canvas.hidden = true;
    return;
  }
  if (!drawing && !starting) {
    starting = true;
    try {
      const { makeSea, SEA_LOOP, CANNON_BEAT } = await import('./sea.js');
      drawing = makeSea(canvas);
      loopLength = SEA_LOOP;
      cannonBeat = CANNON_BEAT;
      drawing(elapsed);
    } catch { /* The original poster is the static fallback. */ }
    finally { starting = false; }
  }
  if (!drawing || frame || !visible || motion.matches || document.hidden) return;
  canvas.hidden = false;
  last = performance.now();
  frame = requestAnimationFrame(tick);
}

function watchSea() {
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      void syncSea();
    }, {threshold:.12}).observe(stage);
  } else {
    visible = true;
    void syncSea();
  }
  motion.addEventListener('change', syncSea);
  document.addEventListener('visibilitychange', syncSea);
}

const afterPaint = () => requestAnimationFrame(() => requestAnimationFrame(watchSea));
if (document.readyState === 'complete') afterPaint();
else window.addEventListener('load', afterPaint, {once:true});
