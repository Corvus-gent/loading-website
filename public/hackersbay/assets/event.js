import { EVENT_PATH, PERSONAS, getPersona, preset } from './persona.js';
import { loadRoom, portrait, element } from './event-data.js';
import { matchRoom, describeMatch, lensFor } from './lens.js';

const room = document.querySelector('#room');
const roomState = document.querySelector('#room-state');
const choice = document.querySelector('#lens-choice');
const saved = getPersona();
const requested = new URLSearchParams(location.search).get('lens');
const firstLens = Object.hasOwn(PERSONAS, requested) ? requested : (saved?.type || 'builder');

function renderMatch(match, index) {
  const card = element('article', undefined, 'panel match-card');
  const person = match.person;
  const { yourReason, theirReason } = describeMatch(match);
  const header = element('header');
  const info = element('div');
  info.append(element('h3', person.name), element('p', person.role + ' · ' + person.project, 'fine'));
  const mark = element('span', '× ' + String(index + 1).padStart(2, '0'), 'match-mark');
  mark.setAttribute('aria-hidden', 'true');
  header.append(portrait(person), info, mark);
  const reasons = element('dl', undefined, 'match-reasons');
  reasons.append(element('dt', 'Why you’d meet'), element('dd', yourReason), element('dt', 'Why they’d meet'), element('dd', theirReason));
  card.append(header, reasons);
  return card;
}

async function showRoom() {
  const { event, attendees } = await loadRoom();
  for (const [type, persona] of Object.entries(PERSONAS)) choice.add(new Option(persona.title, type));
  choice.value = firstLens;
  document.querySelector('#room-count').textContent = attendees.length + ' FICTIONAL ATTENDEES · 3 SUGGESTIONS';

  function render(type) {
    const card = saved?.type === type ? saved : preset(type);
    const matches = matchRoom(card, attendees).slice(0, 3);
    const lens = lensFor(card, event, matches);
    document.querySelector('#active-persona').textContent = PERSONAS[type].title + ' · DEMO SCORE';
    document.querySelector('#lens-title').textContent = lens.title;
    document.querySelector('#lens-score').textContent = lens.score;
    document.querySelector('#lens-summary').textContent = lens.summary;
    const reasons = lens.details.map(([label, detail]) => {
      const row = element('div');
      row.append(element('dt', label), element('dd', detail));
      return row;
    });
    document.querySelector('#lens-reasons').replaceChildren(...reasons);
    document.querySelector('#match-list').replaceChildren(...matches.map(renderMatch));
  }

  render(firstLens);
  choice.addEventListener('change', () => {
    render(choice.value);
    history.replaceState(null, '', EVENT_PATH + '?lens=' + choice.value);
  });
  roomState.hidden = true;
  room.hidden = false;
}

showRoom().catch(() => { roomState.textContent = 'The demo roster is unavailable. Reload the page to try again.'; });
