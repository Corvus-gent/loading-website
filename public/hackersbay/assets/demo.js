import { crewAvatar, element, loadRoom } from './event-data.js';
import { DEFAULT_DEMO_LENS, preset } from './persona.js';
import { lensFor, matchRoom } from './lens.js';
import { meetingFor } from './intros.js';
import { drawRadar } from './radar.js';
import { CLASSES, pixelCanvas, seededPirate } from './pirate.js';
import { artPicture, captainArt, classArt } from './art.js';
import { prepareDressed } from './wardrobe.js';
import { mutualParrots, spyglassPilot } from './parrot-view.js';
import { battlePhase, FIRE, IMPACT, IMPACT_CAPTION, makeArtworkSea, SINK_CAPTION } from './art-sea.js';
import { playBaySound, wireSound } from './sound.js';

const deck = document.querySelector('#deck');
const caption = document.querySelector('#demo-caption-text');
const host = document.querySelector('#demo-host');
const scenes = [...deck.querySelectorAll('[data-beat]')];
const beats = [
  [0, 'naval', 'wave', 'Ahoy! The Black Commit has Luma in its sights.'],
  [8, 'build', 'typing', 'Let’s rig you out. Pick your kit, then tell me what you’re after.'],
  [18, 'class', 'thumbs-up', 'Four classes, four ways to read the same room.'],
  [23, 'lens', 'sitting', 'Deckhands check food, bunks, and whether the prize pays.'],
  [31, 'radar', 'flying', 'I’m flying ahead. Here are three pirates worth meeting.'],
  [43, 'consent', 'squawk', 'Two yeses before I give you a place to meet.'],
  [48, 'mutual', 'celebrate', 'It’s mutual! I found you a time and place.'],
  [54, 'end', 'thumbs-up', 'Scan the code and board my ship.']
];
const card = preset(DEFAULT_DEMO_LENS);
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const limit = x => Math.min(1, Math.max(0, x));
const seaCanvas = document.querySelector('#demo-sea');
const sea = seaCanvas.parentElement;
const opening = sea.closest('[data-beat]');
const closing = document.querySelector('[data-beat="end"]');
const endCanvas = document.querySelector('#demo-end-sea');
let drawEnd;
void makeArtworkSea(endCanvas).then(draw => {
  drawEnd = draw;
  draw(5);
  endCanvas.hidden = false;
}).catch(() => { /* The still keeps the end card readable. */ });
let drawSea;
void makeArtworkSea(seaCanvas).then(draw => {
  drawSea = draw;
  draw(.5);
  seaCanvas.hidden = false;
}).catch(() => { /* The supplied poster still sets the scene. */ });
wireSound(null, {shortcut:true});

const copper = 'Copper Byte';
const costumes = [
  [{hat:3, eyes:0, coat:0, item:3}, 'Beanie · Amber shades · Coffee flask'],
  [{hat:0, eyes:3, coat:4, item:4}, 'Tricorn · Teal shades · Treasure map'],
  [null, 'Deckhand kit · Bandana · Laptop']
];
const builder = pixelCanvas(132, 'crew-sprite dressed-crew');
builder.height = 144;
const builderCtx = builder.getContext('2d');
document.querySelector('#demo-pirate').append(builder);
const buildName = document.querySelector('#demo-pirate-name');
const kit = document.querySelector('#demo-kit');
const squawk = document.querySelector('#demo-squawk');
const classList = document.querySelector('#demo-class-list');
for (const [key, value] of Object.entries(CLASSES)) {
  const chip = element('div', undefined, 'demo-class-chip');
  chip.dataset.class = key;
  const words = element('div');
  words.append(element('strong',value.name),element('span',value.role));
  chip.append(artPicture(classArt(key),{width:132,height:144,lazy:false}),words);
  classList.append(chip);
}

const brief = {
  'kai-navarro': ['Kai Compass', 'Has a low-cost transit plan'],
  'devon-knox': ['Devon Lastplate', 'Knows community food options'],
  'tess-warden': ['Tess Goldledger', 'Can help you check payout terms']
};
const sample = Object.entries(brief).map(([id,[name]]) => ({person:{id,name,pirate:seededPirate(id)}}));
const dots = Array.from({length:30}, (_, id) => ({id}));

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
  pilot = spyglassPilot(radar);
  locks = [...radar.querySelectorAll('.lock')];
  labels = matches.map(({person}) => {
    const item = element('li');
    const copy = element('div', undefined, 'demo-match-note');
    copy.append(element('strong', person.name), element('span', brief[person.id]?.[1] || 'Has a relevant offer'));
    item.append(crewAvatar(person), copy);
    return item;
  });
  crew.replaceChildren(...labels);
  mutual.replaceChildren(mutualParrots());
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
  const time = reduced.matches
    ? (elapsed < 1.25 ? .5 : elapsed < 2.45 ? IMPACT + .35 : 6.25)
    : Math.min(9.1, .9 + elapsed * 1.55);
  const tick = Math.floor(time * 30);
  if (drawSea && tick !== seaFrame) { drawSea(tick / 30); seaFrame = tick; }
  const phase = battlePhase(time);
  if (phase !== opening.dataset.battlePhase) {
    opening.dataset.battlePhase = phase;
    if (phase !== 'aim') caption.textContent = phase === 'impact' ? IMPACT_CAPTION : SINK_CAPTION;
  }
  sea.toggleAttribute('data-impact', !reduced.matches && time >= IMPACT && time < IMPACT+.26);
  if (!fired && time >= FIRE) {
    fired = true;
    playBaySound('cannon');
  }
}

function build(elapsed) {
  const step = elapsed < 1.4 ? 0 : elapsed < 2.75 ? 1 : 2;
  if (step !== outfit) {
    outfit = step;
    const [look,style] = costumes[step];
    kit.textContent = style;
    void prepareDressed('hacker',look).then(paint => {
      if (outfit === step) paint(builderCtx);
    });
    if (step === 2) playBaySound('squawk');
  }
  const typed = copper.slice(0,Math.floor(limit(elapsed/1.55)*copper.length));
  if (buildName.textContent !== typed) buildName.textContent = typed;
  squawk.toggleAttribute('data-ready',elapsed >= 3.35);
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
  const [start,beat,pose,description] = beats.findLast(([cue]) => seconds >= cue);
  const elapsed = seconds - start;
  if (active !== beat) {
    active = beat;
    scenes.forEach(scene => { scene.hidden = scene.dataset.beat !== beat; });
    caption.textContent = description;
    host.replaceChildren(captainArt(pose,{lazy:false}));
  }
  if (beat === 'naval') naval(elapsed);
  if (beat === 'end' && drawEnd) {
    const time = reduced.matches
      ? (elapsed < 1 ? .5 : elapsed < 2.45 ? IMPACT + .35 : 6.25)
      : Math.min(9.1, 1.7 + elapsed * 1.25);
    const phase = battlePhase(time);
    if (phase !== closing.dataset.battlePhase) closing.dataset.battlePhase = phase;
    const tick = Math.floor(time * 30);
    if (tick !== seaFrame) { drawEnd(tick / 30); seaFrame = tick; }
  }
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
