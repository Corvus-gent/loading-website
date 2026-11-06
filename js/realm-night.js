import {collectRealmFeather} from './eggs.js?v=20261106-feathers1';
import {openTerminal} from './terminal.js';

const scene = document.querySelector('.night-scene');
const nav = scene.querySelector('nav');
const places = [...nav.querySelectorAll('a')];
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const touch = matchMedia('(pointer: coarse)');
const light = document.createElement('div');
light.className = 'night-light';
light.ariaHidden = 'true';
const stars = document.createElement('div');
stars.className = 'night-stars';
stars.ariaHidden = 'true';
for (const [x,y,delay] of [[8,9,0],[41,7,.3],[72,23,.6],[94,14,1.2],[54,61,2]]) {
  const point = document.createElement('i');
  Object.assign(point.style,{left:x+'%',top:y+'%',animationDelay:delay+'s'});
  stars.append(point);
}
scene.prepend(light,stars);
function object(name, label, drawing, action) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = name;
  button.setAttribute('aria-label',label);
  button.innerHTML = '<svg aria-hidden="true" viewBox="0 0 32 32">' + drawing + '</svg>';
  button.addEventListener('click',action);
  scene.append(button);
  return button;
}
object('night-door','Open door','<path d="M7 29V11a9 9 0 0 1 18 0v18M9 29V12a7 7 0 0 1 14 0v17Z" fill="none" stroke="currentColor"/><circle cx="19" cy="19" r="1" fill="currentColor"/>',() => openTerminal());
const crow = object('night-crow','Greet the crow','<path fill="currentColor" d="m2 24 8-9q4-6 9-5 4-8 9-4l1 2 3 1-4 2q-1 10-10 11l-1 4h4v1h-7l2-5-4-1-8 4 2-3z"/>',collectRealmFeather);
const whispers = ['someone was here before you.','the crow knows your name.','not everything here is a link.'];
let index = Math.floor(Math.random()*whispers.length);
try {
  const last = sessionStorage.getItem('realm:whisper');
  if (String(index) === last) index = (index+1)%whispers.length;
  sessionStorage.setItem('realm:whisper',String(index));
} catch {}
const whisper = document.querySelector('.night-whisper');
whisper.textContent = whispers[index];


let boxes = [], x = 0, y = 0, frame = 0, drift, idle;
let point, focused, tour = null, tourStep = 0, touched = false;
function measure() {
  const outer = scene.getBoundingClientRect();
  boxes = places.map(place => {
    const r = place.getBoundingClientRect();
    return {x:r.left-outer.left+r.width/2,y:r.top-outer.top+r.height/2};
  });
  schedule();
}
function draw() {
  frame = 0;
  const bounds = scene.getBoundingClientRect();
  const target = boxes[places.indexOf(focused)];
  const stop = tour === null ? null : boxes[tour];
  if (target) ({x,y} = target);
  else if (stop) ({x,y} = stop);
  else if (point && !reduced.matches) { x=point.x-bounds.left; y=point.y-bounds.top; }
  else { x=bounds.width*.49; y=Math.min(150,bounds.height*.32); }
  light.style.transform = 'translate3d('+(x-160)+'px,'+(y-160)+'px,0)';
  places.forEach((place,i) => {
    const b = boxes[i];
    place.classList.toggle('lit',!!b && (place === focused || Math.hypot(b.x-x,b.y-y)<128));
  });
}
function schedule() {
  if (!frame && !document.hidden) frame = requestAnimationFrame(draw);
}
const clock = new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Brussels',hour:'2-digit',hourCycle:'h23'});
let idleReached = false;
function showCrow() { crow.hidden = !(idleReached || Number(clock.format(new Date()))<5); }
function restartIdle() {
  clearTimeout(idle);
  if (document.hidden) return;
  if (!idleReached) idle = setTimeout(() => { idleReached=true; showCrow(); },30000);
  showCrow();
}
function wander() {
  clearTimeout(drift);
  if (!touch.matches || reduced.matches || document.hidden || focused) return;
  // touch has no hover: walk the light past every place in order, so each one shows its name.
  // (it used to drift to random points and kept parking on the right column.)
  drift = setTimeout(() => {
    if (boxes.length) {
      tour = tourStep++ % boxes.length; point = null;
      scene.classList.add('drifting');
      schedule();
    }
    wander();
  },touched ? (touched = false, 4500) : tour === null ? 1200 : 2600);
}
function pointer(event) {
  focused = null; tour = null; touched = true;
  point = {x:event.clientX,y:event.clientY};
  scene.classList.remove('drifting');
  schedule();
  wander();
}
scene.addEventListener('pointermove',pointer,{passive:true});
scene.addEventListener('pointerdown',pointer,{passive:true});
scene.addEventListener('pointerleave',event => { if (event.pointerType === 'touch') return; point=null; schedule(); });
scene.addEventListener('focusin',event => {
  focused=event.target.closest('a'); scene.classList.remove('drifting'); schedule(); wander();
});
scene.addEventListener('focusout',() => { focused=null; schedule(); wander(); });
let lastActivity = -1000;
function activity() {
  // Avoid reading the timezone clock or scheduling timers on every pointer pixel.
  if (performance.now()-lastActivity < 100) return;
  lastActivity = performance.now(); restartIdle();
}
for (const event of ['pointermove','pointerdown','keydown','wheel']) document.addEventListener(event,activity,{capture:true,passive:true});
document.addEventListener('scroll',schedule,{capture:true,passive:true});
function refresh() {
  if (document.hidden) { cancelAnimationFrame(frame); frame=0; clearTimeout(idle); clearTimeout(drift); return; }
  measure(); restartIdle(); wander();
}
scene.classList.add('awake');
new ResizeObserver(measure).observe(nav);
reduced.addEventListener('change',refresh);
document.addEventListener('visibilitychange',refresh);
refresh();
