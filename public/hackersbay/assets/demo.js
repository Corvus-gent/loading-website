import { crewAvatar, element, loadRoom } from './event-data.js';
import { DEFAULT_DEMO_LENS, preset } from './persona.js';
import { lensFor, matchRoom } from './lens.js';
import { meetingFor } from './intros.js';
import { drawRadar } from './radar.js';
import { CLASSES, DEFAULT_PIRATE, OPTIONS, paintPirate, pixelCanvas, seededPirate } from './pirate.js';
import { mutualParrots, spyglassPilot } from './parrot-view.js';
import { CANNON_BEAT, makeSea } from './sea.js';
import { playBaySound, wireSound } from './sound.js';

const deck = document.querySelector('#deck');
const caption = document.querySelector('#demo-caption');
const scenes = [...deck.querySelectorAll('[data-beat]')];
const beats = [
  [0, 'naval', 'The Black Commit has Luma in its sights.'],
  [8, 'build', 'Build a pirate. Give your parrot a name and something to squawk.'],
  [18, 'class', 'Four classes. Four ways to read the same event.'],
  [23, 'lens', 'The Deckhand checks food, a bunk, and whether the prize pays.'],
  [31, 'radar', 'Your parrot flies to three pirates and tells you why to meet.'],
  [43, 'consent', 'An introduction needs a yes from both pirates.'],
  [48, 'mutual', 'Both said yes. Now you have a time and place.'],
  [54, 'end', 'Scan the code to board the ship.']
];
const card = preset(DEFAULT_DEMO_LENS);
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const limit = x => Math.min(1, Math.max(0, x));
const seaCanvas = document.querySelector('#demo-sea');
const drawSea = makeSea(seaCanvas);
seaCanvas.hidden = false;
wireSound(null, {shortcut:true});

const copper = 'Copper Byte';
const costumes = [
  { ...DEFAULT_PIRATE, hat:1, coat:3, eye:2, item:3, bird:2, birdHat:0 },
  { ...DEFAULT_PIRATE, hat:3, coat:4, eye:1, item:4, bird:1, birdHat:2 },
  DEFAULT_PIRATE
];
const builder = pixelCanvas(48, 'crew-sprite');
document.querySelector('#demo-pirate').append(builder);
const buildName = document.querySelector('#demo-pirate-name');
const kit = document.querySelector('#demo-kit');
const squawk = document.querySelector('#demo-squawk');
const classList = document.querySelector('#demo-class-list');
for (const [key, value] of Object.entries(CLASSES)) {
  const chip = element('div', undefined, 'demo-class-chip');
  chip.dataset.class = key;
  chip.append(element('strong', value.name), element('span', value.role));
  classList.append(chip);
}

const brief = {
  'kai-navarro': ['Kai Compass', 'Has a low-cost transit plan'],
  'devon-knox': ['Devon Lastplate', 'Knows community food options'],
  'tess-warden': ['Tess Goldledger', 'Can help you check payout terms']
};
const sample = Object.entries(brief).map(([id,[name]]) => ({person:{id,name,pirate:seededPirate(id)}}));
const dots = Array.from({length:30}, (_, id) => ({id}));
drawRadar(document.querySelector('#end-sonar'), [], sample);

const radar = document.querySelector('#demo-radar');
const crew = document.querySelector('#demo-crew');
const counter = document.querySelector('#demo-lock-count');
const mutual = document.querySelector('#demo-beak-bump');
let locks;
let labels;
let pilot;
let lockCount = -1;

function fact(label, value) {
  const row = element('div');
  row.append(element('dt', label), element('dd', value));
  return row;
}

function showMatches(matches, attendees) {
  drawRadar(radar, attendees, matches);
  pilot?.stop();
  pilot = spyglassPilot(radar, DEFAULT_PIRATE);
  locks = [...radar.querySelectorAll('.lock')];
  labels = matches.map(({person}) => {
    const item = element('li');
    const copy = element('div', undefined, 'demo-match-note');
    copy.append(element('strong', person.name), element('span', brief[person.id]?.[1] || 'Has a relevant offer'));
    item.append(crewAvatar(person), copy);
    return item;
  });
  crew.replaceChildren(...labels);
  mutual.replaceChildren(mutualParrots(DEFAULT_PIRATE, matches[0].person.pirate));
  document.querySelector('#demo-intro-name').textContent = 'INTRO REQUEST · ' + matches[0].person.name.toUpperCase();
  lockCount = -1;
}

showMatches(sample, dots);
loadRoom().then(({event, attendees}) => {
  const matches = matchRoom(card, attendees).slice(0, 3);
  if (matches.length !== 3) return;
  const lens = lensFor(card, event, matches);
  document.querySelector('#demo-score').textContent = lens.score;
  document.querySelector('#demo-logistics').replaceChildren(...lens.details.map(([label, value]) => fact(label, value)));
  document.querySelector('#demo-moment').textContent = meetingFor(event, attendees.indexOf(matches[0].person));
  showMatches(matches, attendees);
}).catch(() => { /* The local story still plays with the sample cast. */ });

const consentHeading = document.querySelector('#demo-consent');
const consentStatus = document.querySelector('#demo-consent-status');
const consentNote = document.querySelector('#demo-consent-note');
const landings = [1.55, 4.6, 7.65];
let active = '';
let consent = -1;
let outfit = -1;
let seaFrame = -1;
let fired = false;
let clinked = false;
let started = performance.now();
let pauseTime;
let frame;
let lastTime = 0;

function naval(elapsed) {
  const time = reduced.matches ? (elapsed < 1.8 ? .5 : 6.6) : Math.min(8.6, 1.2 + elapsed * 2.05);
  const tick = Math.floor(time * 30);
  if (tick !== seaFrame) { drawSea(tick / 30); seaFrame = tick; }
  if (!fired && time >= CANNON_BEAT) {
    fired = true;
    caption.textContent = 'One cannonball. Luma’s rowboat goes under.';
    playBaySound('cannon');
  }
}

function build(elapsed) {
  const step = elapsed < 1.4 ? 0 : elapsed < 2.75 ? 1 : 2;
  if (step !== outfit) {
    outfit = step;
    const costume = costumes[step];
    paintPirate(builder.getContext('2d'), costume);
    kit.textContent = OPTIONS.hat[costume.hat] + ' · ' + OPTIONS.coat[costume.coat] + ' · ' + OPTIONS.bird[costume.bird];
    if (step === 2) playBaySound('squawk');
  }
  buildName.textContent = copper.slice(0, Math.floor(limit(elapsed / 1.55) * copper.length));
  squawk.toggleAttribute('data-ready', elapsed >= 3.35);
}

function scout(elapsed) {
  const count = landings.filter(second => elapsed >= second).length;
  const next = landings[count];
  if (next !== undefined && elapsed >= next - .8 && !reduced.matches) {
    locks[count].hidden = false;
    pilot.glide(count, limit(1 - (next - elapsed) / .8));
  }
  if (count === lockCount) return;
  lockCount = count;
  locks.forEach((lock, index) => { lock.hidden = index >= count; });
  labels.forEach((label, index) => { label.dataset.revealed = String(index < count); });
  if (count) {
    pilot.glide(count - 1, 1);
    playBaySound('squawk');
  } else pilot.reset();
  counter.textContent = count ? count + ' OF 3 CREWMATES FOUND' : 'SPYGLASS · SCANNING';
}

function requestIntro(elapsed) {
  const step = elapsed < 1.6 ? 0 : elapsed < 3.2 ? 1 : 2;
  if (step === consent) return;
  consent = step;
  consentHeading.replaceChildren(step < 2 ? 'Make ' : 'Their ', element('em', step < 2 ? 'the ask.' : 'turn.'));
  consentStatus.textContent = ['Intro me', '✓ You opted in', 'Accept intro'][step];
  consentNote.textContent = ['You invite one pirate.', 'Waiting for their parrot.', 'The recipient chooses to accept.'][step];
}

function play(now) {
  const seconds = Math.min(60, Math.max(0, (now - started) / 1000));
  lastTime = seconds;
  const [start, beat, description] = beats.findLast(([cue]) => seconds >= cue);
  const elapsed = seconds - start;
  if (active !== beat) {
    active = beat;
    scenes.forEach(scene => { scene.hidden = scene.dataset.beat !== beat; });
    caption.textContent = description;
  }
  if (beat === 'naval') naval(elapsed);
  if (beat === 'build') build(elapsed);
  if (beat === 'class') classList.toggleAttribute('data-picked', elapsed >= 1.15);
  if (beat === 'radar') scout(elapsed);
  if (beat === 'consent') requestIntro(elapsed);
  if (beat === 'mutual' && elapsed >= .67 && !clinked) {
    clinked = true;
    playBaySound('coin');
  }
  if (seconds < 60) frame = requestAnimationFrame(play);
  else frame = undefined;
}

frame = requestAnimationFrame(play);
window.addEventListener('keydown', event => {
  if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
  if (event.key.toLowerCase() === 'r') {
    cancelAnimationFrame(frame);
    started = performance.now();
    pauseTime = undefined;
    active = '';
    fired = clinked = false;
    consent = outfit = seaFrame = lockCount = -1;
    deck.removeAttribute('data-paused');
    frame = requestAnimationFrame(play);
  }
  if (event.code !== 'Space' || lastTime >= 60) return;
  event.preventDefault();
  if (pauseTime === undefined) {
    pauseTime = performance.now();
    deck.setAttribute('data-paused', '');
    cancelAnimationFrame(frame);
  } else {
    started += performance.now() - pauseTime;
    pauseTime = undefined;
    deck.removeAttribute('data-paused');
    frame = requestAnimationFrame(play);
  }
});
