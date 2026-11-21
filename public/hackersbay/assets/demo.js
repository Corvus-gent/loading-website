import { element, loadRoom } from './event-data.js';
import { DEFAULT_DEMO_LENS, preset } from './persona.js';
import { lensFor, matchRoom } from './lens.js';
import { meetingFor } from './intros.js';
import { drawRadar } from './radar.js';

const deck = document.querySelector('#deck');
const caption = document.querySelector('#demo-caption');
const scenes = [...deck.querySelectorAll('[data-beat]')];
const beats = [
  [0, 'A wall of faces tells you who’s going.'],
  [7, 'Paste one link and get a crew card.'],
  [17, 'A broke hacker needs to know what the trip costs.'],
  [28, 'Find three people who can actually help.'],
  [40, 'An introduction needs a yes from both people.'],
  [47, 'Both opted in. Now you have a time and place.'],
  [53, 'Scan the code to board the ship.']
];
const card = preset(DEFAULT_DEMO_LENS);
const profile = 'github.com/example/dockside';
const wall = document.querySelector('#wall');
const board = wall.parentElement;
const positions = [
  { person: { id: 'kai-navarro', name: 'Kai Navarro' } },
  { person: { id: 'devon-knox', name: 'Devon Knox' } },
  { person: { id: 'tess-warden', name: 'Tess Warden' } }
];

function fact(label, value) {
  const row = element('div');
  row.append(element('dt', label), element('dd', value));
  return row;
}

for (let i = 0; i < 16; i++) {
  const face = element('span', undefined, 'guest-dot');
  face.style.setProperty('--dx', ((i % 4) - 1.5) * 11 + 'cqw');
  face.style.setProperty('--dy', (Math.floor(i / 4) - 1.5) * 11 + 'cqw');
  face.style.setProperty('--dr', (i % 2 ? 1 : -1) * 43 + 'deg');
  wall.append(face);
}

document.querySelector('#demo-card-fields').append(
  fact('Builds', card.builds), fact('Wants', card.wants), fact('Offers', card.offers)
);

const reasons = {
  'kai-navarro': 'Has a low-cost transit plan',
  'devon-knox': 'Knows community food options',
  'tess-warden': 'Can help you check payout terms'
};
const dots = Array.from({length: 30}, (_, index) => ({ id: index }));
drawRadar(document.querySelector('#impact-sonar'), dots, []);
drawRadar(document.querySelector('#end-sonar'), [], positions);

const matchContainer = document.querySelector('#demo-radar');
const crew = document.querySelector('#demo-crew');
const counter = document.querySelector('#demo-lock-count');
let locks = [];
let labels = [];
let lockCount = -1;

function showMatches(matches, attendees) {
  drawRadar(matchContainer, attendees, matches);
  locks = [...matchContainer.querySelectorAll('.lock')];
  labels = matches.map(({ person }) => {
    const item = element('li');
    item.append(element('strong', person.name), element('span', reasons[person.id] || 'Has a relevant offer'));
    return item;
  });
  crew.replaceChildren(...labels);
  document.querySelector('#demo-intro-name').textContent = 'INTRO REQUEST · ' + matches[0].person.name.toUpperCase();
  lockCount = -1;
}

showMatches(positions, dots);
loadRoom().then(({ event, attendees }) => {
  const matches = matchRoom(card, attendees).slice(0, 3);
  if (matches.length !== 3) return;
  const lens = lensFor(card, event, matches);
  document.querySelector('#demo-score').textContent = lens.score;
  document.querySelector('#demo-logistics').replaceChildren(...lens.details.map(([label, value]) => fact(label, value)));
  document.querySelector('#demo-moment').textContent = meetingFor(event, attendees.indexOf(matches[0].person));
  showMatches(matches, attendees);
}).catch(() => { /* The preloaded show still plays if the live seed is unavailable. */ });

const input = document.querySelector('#demo-input');
const reveal = document.querySelector('#crew-reveal');
const consentHeading = document.querySelector('#demo-consent');
const consentStatus = document.querySelector('#demo-consent-status');
const consentNote = document.querySelector('#demo-consent-note');
const limit = (x) => Math.min(1, Math.max(0, x));
let active = -1;
let consent = -1;
let started = performance.now();
let pauseTime;
let frame;
let lastTime = 0;

function play(now) {
  const seconds = Math.min(60, Math.max(0, (now - started) / 1000));
  lastTime = seconds;
  const index = beats.findLastIndex(([start]) => seconds >= start);
  const elapsed = seconds - beats[index][0];
  if (active !== index) {
    active = index;
    scenes.forEach((scene, sceneIndex) => { scene.hidden = sceneIndex !== index; });
    caption.textContent = beats[index][1];
  }
  if (index === 0) {
    const burst = limit((elapsed - 1.18) / 1.1);
    board.style.setProperty('--burst', burst);
    board.style.setProperty('--shot-live', elapsed > .28 && elapsed < 1.18 ? 1 : 0);
    board.style.setProperty('--shot-x', (-58 + 58 * limit((elapsed - .28) / .9)) + 'cqw');
    board.style.setProperty('--impact', elapsed < 1.18 ? 0 : 1 - limit((elapsed - 1.18) / .68));
  }
  if (index === 1) {
    const typed = profile.slice(0, Math.floor(limit((elapsed - .65) / 2.15) * profile.length));
    if (typed !== input.textContent) input.textContent = typed;
    reveal.toggleAttribute('data-ready', elapsed >= 3.1);
  }
  if (index === 3) {
    const count = [1.2, 4.3, 7.4].filter(second => elapsed >= second).length;
    if (count !== lockCount) {
      lockCount = count;
      locks.forEach((lock, i) => { lock.hidden = i >= count; });
      labels.forEach((label, i) => { label.dataset.revealed = String(i < count); });
      counter.textContent = count ? count + ' OF 3 LOCKS ACQUIRED' : 'SCANNING THE ROOM';
    }
  }
  if (index === 4) {
    const step = elapsed < 2 ? 0 : elapsed < 4.5 ? 1 : 2;
    if (step !== consent) {
      consent = step;
      consentHeading.replaceChildren(step < 2 ? 'Make ' : 'Their ', element('em', step < 2 ? 'the ask.' : 'turn.'));
      consentStatus.textContent = ['Intro me', '✓ You opted in', 'Accept intro'][step];
      consentNote.textContent = ['A one-to-one intro starts with you.', 'Waiting for the other person.', 'The recipient chooses to accept.'][step];
    }
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
