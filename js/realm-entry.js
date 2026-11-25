// The entrance: only the lantern is lit. Drag it to find Diogenes, his question
// and the way in. Wing drops by with a hint if you hesitate, then leaves.
const entryMotion = matchMedia('(prefers-reduced-motion: reduce)');
let still = entryMotion.matches;
const $ = s => document.querySelector(s);
const stage = $('#entry'), scene = $('#hero'), lantern = $('#lantern'), curtain = $('.entry-curtain');
const things = [...document.querySelectorAll('[data-dark]')];
const line = $('#dio-line'), who = $('#dio-who'), form = $('#dio-form'), input = $('#dio-input');
const swap = $('#dio-swap'), wing = $('#entry-wing'), door = $('.realm-enter');

const QUESTIONS = [
  'I’m looking for an honest builder. Are you one?',
  'What did you build that nobody asked for?',
  'Who would notice if your work disappeared tomorrow?',
  'What would you make if nobody was watching?',
  'Why do you want to come in?',
  'What are you pretending not to want?',
  'Show me your hands. What have they made lately?'
];
const opening = QUESTIONS[Math.floor(Date.now() / 86400000) % QUESTIONS.length];
line.textContent = opening;
const history = [{role: 'assistant', content: opening}];
let persona = 'diogenes';

// Light: the lantern position decides what can be seen.
const found = new WeakSet();
let x = 0, y = 0, moved = false;
const radius = () => Math.max(130, Math.min(innerWidth, innerHeight) * 0.24);
function light() {
  const stageBox=stage.getBoundingClientRect();
  lantern.style.setProperty('--x',(x-stageBox.left)+'px');
  lantern.style.setProperty('--y',(y-stageBox.top)+'px');
  lantern.style.setProperty('--glow', radius() * 2.3 + 'px');
  const box = scene.getBoundingClientRect(), r = radius();
  scene.style.setProperty('--lx', (x - box.left) + 'px');
  scene.style.setProperty('--ly', (y - box.top) + 'px');
  scene.style.setProperty('--r', r + 'px');
  for (const el of things) {
    const b = el.getBoundingClientRect();
    if (!b.width || !b.height) continue;
    const dx = Math.max(b.left - x, 0, x - b.right), dy = Math.max(b.top - y, 0, y - b.bottom);
    const lit = Math.max(0, Math.min(1, 1.25 - Math.hypot(dx, dy) / r));
    if (lit > .7) found.add(el);
    el.style.setProperty('--seen', Math.max(lit, found.has(el) ? .62 : 0).toFixed(2));
  }
  stage.dispatchEvent(new Event('entrylight'));
}
function place(nx, ny) {
  x = Math.max(16, Math.min(innerWidth - 16, nx));
  y = Math.max(16, Math.min(innerHeight - 16, ny));
  light();
}
function start() {
  // Begin where Diogenes holds his lantern in the painting.
  const box = scene.getBoundingClientRect();
  place(box.left + box.width * .306, box.top + box.height * .475);
}
function viewportSize(){stage.style.setProperty('--entry-height',`${Math.round(window.visualViewport?.height||innerHeight)}px`);light();}
viewportSize();start();
addEventListener('resize',viewportSize);
window.visualViewport?.addEventListener('resize',viewportSize);
addEventListener('scroll',light,{passive:true});

// Drag anywhere on the dark (inputs and links keep working normally).
let dragging = false;
stage.addEventListener('pointerdown', e => {
  if(e.pointerType==='touch'&&!e.target.closest('#lantern'))return;
  if (e.target.closest('input,a,button:not(#lantern),.entry-picker')) return;
  dragging = true; stage.setPointerCapture?.(e.pointerId);
  firstMove(); place(e.clientX, e.clientY);
});
stage.addEventListener('pointermove', e => { if (dragging) place(e.clientX, e.clientY); });
stage.addEventListener('pointerup', () => { dragging = false; });
stage.addEventListener('pointercancel', () => { dragging = false; });
lantern.addEventListener('keydown', e => {
  const step = e.shiftKey ? 80 : 32, keys = {ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step]};
  if (!keys[e.key]) return;
  e.preventDefault(); firstMove(); place(x + keys[e.key][0], y + keys[e.key][1]);
});
// Moving through by keyboard: the lantern follows focus, so nothing stays hidden.
for (const el of things) el.addEventListener('focusin', () => {
  const b = el.getBoundingClientRect();
  // Light the control from beside it; the draggable lantern must not cover it.
  firstMove(); place(b.left - 40, b.top + b.height / 2);
});
function firstMove() {
  if (moved) return; moved = true; lantern.classList.add('moved');
  if (wing.classList.contains('talking')) wingLeave();
}

// The curtains open on the dark.
if (still) things.forEach(el => { found.add(el); el.style.setProperty('--seen', '1'); });
else setTimeout(() => curtain.classList.remove('closed'), 350);

// Wing: a hint for the hesitant, then off he goes.
let wingTimer = setTimeout(wingArrive, still ? 3000 : 7000);
function wingArrive() {
  if (moved) return;
  const lx = x, ly = y;
  wing.style.setProperty('--wx', Math.min(innerWidth - 240, lx + 60) + 'px');
  wing.style.setProperty('--wy', Math.max(60, ly - 150) + 'px');
  wing.hidden = false;
  if (still) { wing.style.transform = `translate(${Math.min(innerWidth - 240, lx + 60)}px,${Math.max(60, ly - 150)}px)`; wing.classList.add('talking'); return; }
  wing.classList.add('arrive');
  wing.addEventListener('animationend', () => {
    wing.classList.remove('arrive'); wing.style.transform = 'translate(var(--wx),var(--wy))';
    wing.classList.add('talking');
    wingTimer = setTimeout(wingLeave, 4200);
  }, {once: true});
}
function wingLeave() {
  clearTimeout(wingTimer);
  if (wing.hidden) return;
  if (still) { wing.hidden = true; return; }
  wing.classList.remove('talking'); wing.classList.add('leave');
  wing.addEventListener('animationend', () => { wing.hidden = true; wing.classList.remove('leave'); }, {once: true});
}

// The door: curtains close behind you.
door.addEventListener('click', e => {
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || still) return;
  curtain.classList.add('fast', 'closed');
});
addEventListener('pageshow', e => { if (e.persisted) curtain.classList.remove('closed'); });

// The conversation: one line at a time, so the dark stays dark.
function type(text, speed = 20) {
  return new Promise(done => {
    if (still) { line.textContent = text; return done(); }
    let i = 0; line.textContent = '';
    const step = () => { line.textContent = text.slice(0, ++i); i < text.length ? setTimeout(step, speed) : done(); };
    step();
  });
}
function linkify(text) {
  line.textContent = '';
  for (const part of text.split(/(\/[a-z][a-z0-9-]*(?:\/[a-z0-9-]+)*\/?|gabriel@corvus\.gent)/g)) {
    if (!part) continue;
    if (/^\/[a-z]/.test(part) || part.includes('@')) { const a = document.createElement('a'); a.href = part.includes('@') ? 'mailto:' + part : part; a.textContent = part; line.append(a); }
    else line.append(part);
  }
}
swap.addEventListener('click', () => {
  persona = persona === 'diogenes' ? 'gabe' : 'diogenes';
  who.textContent = persona === 'gabe' ? 'Gabe’s echo · an AI' : 'Diogenes';
  swap.textContent = persona === 'gabe' ? 'back to Diogenes' : 'or ask Gabe’s echo';
  const text = persona === 'gabe' ? 'Hey, I’m Gabe’s echo: an AI that read everything Gabe made public. What are you building?' : opening;
  history.push({role: 'assistant', content: text});
  type(text); input.focus();
});
let busy = false;
form.addEventListener('submit', async e => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text || busy) return;
  busy = true; input.value = ''; input.placeholder = '…';
  history.push({role: 'user', content: text});
  line.textContent = ''; line.classList.add('thinking');
  let reply;
  try {
    const r = await fetch('/api/diogenes', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({persona, messages: history.slice(-10)}), signal: AbortSignal.timeout(20000)});
    reply = (await r.json()).reply;
  } catch {}
  reply ||= 'My lantern flickers; the oracle is quiet tonight. The way in is somewhere in the dark.';
  line.classList.remove('thinking');
  history.push({role: 'assistant', content: reply});
  await type(reply); linkify(reply);
  input.placeholder = 'answer him…'; busy = false;
});

// The original Monday entrance owns interaction and chat. Daily art is optional.
entryMotion.addEventListener('change', () => {
  still = entryMotion.matches;
  curtain.classList.remove('closed');
  if (still) things.forEach(el => { found.add(el); el.style.setProperty('--seen', '1'); });
});
import('./entry-days/picker.js').then(({mountPicker}) => mountPicker(stage, () => ({x, y, radius: radius()}))).catch(() => {
  document.body.dataset.entry = 'mon';
  document.body.dataset.entryReady = 'fallback';
  const toggle = document.getElementById('entry-picker-toggle');
  if (toggle) { toggle.textContent = 'entrance: Lantern'; toggle.disabled = true; }
});
