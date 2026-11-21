import { DEFAULT_DEMO_LENS, EVENT_PATH, PERSONAS, getPersona, preset } from './persona.js';
import { loadRoom, crewAvatar, element } from './event-data.js';
import { matchRoom, describeMatch, lensFor } from './lens.js';
import { drawRadar } from './radar.js';
import { introRequest, meetingFor, readIntros, recipientUrl, saveIntro } from './intros.js';

const room = document.querySelector('#room');
const roomState = document.querySelector('#room-state');
const choice = document.querySelector('#lens-choice');
const saved = getPersona();
const requested = new URLSearchParams(location.search).get('lens');
const firstLens = Object.hasOwn(PERSONAS, requested) ? requested : (saved?.type || DEFAULT_DEMO_LENS);

function renderMatch(match, index, type, event, attendees) {
  const card = element('article', undefined, 'panel match-card');
  const person = match.person;
  card.id = 'match-' + person.id;
  card.tabIndex = -1;
  const { yourReason, theirReason } = describeMatch(match);
  const header = element('header');
  const info = element('div');
  info.append(element('h3', person.name), element('p', person.role + ' · ' + person.project, 'fine'));
  const mark = element('span', '× ' + String(index + 1).padStart(2, '0'), 'match-mark');
  mark.setAttribute('aria-hidden', 'true');
  header.append(crewAvatar(person), info, mark);
  const reasons = element('dl', undefined, 'match-reasons');
  reasons.append(element('dt', 'Why you’d meet'), element('dd', yourReason), element('dt', 'Why they’d meet'), element('dd', theirReason));
  const actions = element('div', undefined, 'intro-actions');
  const notice = element('div', undefined, 'intro-state');
  notice.setAttribute('aria-live', 'polite');
  const request = element('button', 'Intro me', 'button primary');
  request.type = 'button';
  actions.append(request, notice);

  function showIntro(intro) {
    request.hidden = Boolean(intro);
    if (!intro) return;
    if (intro.status === 'mutual') {
      notice.replaceChildren(
        element('strong', 'IT’S MUTUAL ⚓', 'mutual-message'),
        element('span', 'Suggested meetup · ' + intro.moment, 'fine')
      );
      return;
    }
    const link = element('a', 'Open recipient view', 'button');
    link.href = recipientUrl(intro);
    const label = element('p', 'You opted in. Waiting for the other side.', 'fine');
    notice.replaceChildren(label, link);
    if (intro.shared && navigator.clipboard) {
      const copy = element('button', 'Copy intro link', 'button');
      copy.type = 'button';
      copy.addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(link.href); copy.textContent = 'Link copied'; }
        catch { label.textContent = 'Open the recipient view to copy its link.'; }
      });
      notice.append(copy);
    }
  }

  const latest = () => readIntros().findLast(row => row.personId === person.id && row.type === type);
  showIntro(latest());
  request.addEventListener('click', async () => {
    request.disabled = true;
    notice.textContent = 'Opening an intro request…';
    const draft = {
      id: crypto.randomUUID(), key: crypto.randomUUID(), personId: person.id, type,
      status: 'pending', createdAt: Date.now()
    };
    let intro;
    try {
      const remote = await introRequest('request-intro', draft);
      intro = { ...draft, ...remote, shared: true };
    } catch {
      intro = { ...draft, shared: false };
    }
    saveIntro(intro);
    showIntro(intro);
    notice.querySelector('a')?.focus();
  });

  card.updateIntro = async () => {
    const intro = latest();
    if (!intro) return;
    if (intro.shared && intro.status === 'pending') {
      try {
        const remote = await introRequest('intro-status', { id: intro.id, key: intro.key });
        if (remote.status === 'mutual') saveIntro({ ...intro, ...remote });
      } catch { /* Keep the request pending until the service returns. */ }
    }
    const current = latest();
    if (current?.status === 'mutual') showIntro({
      ...current, moment: current.moment || meetingFor(event, attendees.indexOf(person))
    });
  };
  card.append(header, reasons, actions);
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
    const cards = matches.map((match, index) => renderMatch(match, index, type, event, attendees));
    document.querySelector('#match-list').replaceChildren(...cards);
    drawRadar(document.querySelector('#room-radar'), attendees, matches, personId => {
      document.getElementById('match-' + personId)?.focus();
    });
  }

  render(firstLens);
  choice.addEventListener('change', () => {
    render(choice.value);
    history.replaceState(null, '', EVENT_PATH + '?lens=' + choice.value);
  });
  roomState.hidden = true;
  room.hidden = false;
  if (location.hash.startsWith('#match-')) document.getElementById(location.hash.slice(1))?.scrollIntoView();
  const refresh = () => {
    if (!document.hidden) document.querySelectorAll('.match-card').forEach(card => { void card.updateIntro(); });
  };
  refresh();
  window.addEventListener('storage', refresh);
  window.addEventListener('pageshow', refresh);
  document.addEventListener('visibilitychange', refresh);
  setInterval(refresh, 12000);
}

showRoom().catch(() => { roomState.textContent = 'The demo roster is unavailable. Reload the page to try again.'; });
