import { wireSound, playBaySound } from './sound.js';
import './game.js';

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
let impact;

function tick(now) {
  const span = now - last;
  if (span >= 15) {
    const previous = elapsed % loopLength;
    elapsed += Math.min(span, 120) / 1000;
    if (previous < cannonBeat && elapsed % loopLength >= cannonBeat) playBaySound('cannon');
    const departure = drawing(elapsed);
    stage.style.setProperty('--ship-shift', (departure * 100).toFixed(2) + '%');
    const age = elapsed % loopLength - impact;
    stage.toggleAttribute('data-impact', age >= 0 && age < .32);
    last = now;
  }
  frame = requestAnimationFrame(tick);
}

async function syncSea() {
  if (!visible || motion.matches || document.hidden) {
    cancelAnimationFrame(frame);
    frame = 0;
    canvas.hidden = true;
    stage.removeAttribute('data-impact');
    stage.style.removeProperty('--ship-shift');
    return;
  }
  if (!drawing && !starting) {
    starting = true;
    try {
      const {makeArtworkSea, SHIP_LOOP, FIRE, IMPACT} = await import('./art-sea.js');
      drawing = await makeArtworkSea(canvas);
      loopLength = SHIP_LOOP;
      cannonBeat = FIRE;
      impact = IMPACT;
      drawing(elapsed);
    } catch { /* Keep the Recraft poster when motion assets are unavailable. */ }
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

const copyCaption = document.querySelector('#copy-boat-caption');
if (copyCaption && navigator.clipboard) {
  copyCaption.hidden = false;
  copyCaption.addEventListener('click', async () => {
    const caption = document.querySelector('#boat-caption');
    const status = document.querySelector('#copy-boat-status');
    try {
      await navigator.clipboard.writeText(caption.value);
      status.textContent = 'Caption copied.';
    } catch {
      caption.focus();
      caption.select();
      status.textContent = 'Caption selected for copying.';
    }
  });
}
