import { loadRoom } from './event-data.js';
import { EVENT_PATH, PERSONAS } from './persona.js';
import { TOKEN, introRequest, meetingFor, readIntros, saveIntro } from './intros.js';

const query = new URLSearchParams(location.search);
const id = query.get('request');
const key = new URLSearchParams(location.hash.slice(1)).get('key');
const shared = query.get('demo') !== '1';
const heading = document.querySelector('#intro-title');
const status = document.querySelector('#intro-context');
const accept = document.querySelector('#accept-intro');
const mutual = document.querySelector('#intro-mutual');

function showMutual(moment) {
  accept.hidden = true;
  heading.textContent = 'IT’S MUTUAL ⚓';
  status.textContent = 'Both sides accepted the introduction.';
  mutual.textContent = 'Suggested meetup · ' + moment;
  mutual.hidden = false;
}

async function openIntro() {
  if (!TOKEN.test(id ?? '') || !TOKEN.test(key ?? '')) throw new Error('Invalid link');
  const [{ event, attendees }, intro] = await Promise.all([
    loadRoom(),
    shared ? introRequest('intro-status', { id, key }) : readIntros().find(row => row.id === id && row.key === key)
  ]);
  const personIndex = attendees.findIndex(person => person.id === intro?.personId);
  if (personIndex < 0 || !Object.hasOwn(PERSONAS, intro.type)) throw new Error('Unknown intro');
  const person = attendees[personIndex];
  const returnUrl = EVENT_PATH + '?lens=' + intro.type + '#match-' + person.id;
  document.querySelector('#return-to-room').href = returnUrl;
  document.querySelector('#intro-back').href = returnUrl;
  const moment = meetingFor(event, personIndex);
  const name = PERSONAS[intro.type].title;
  if (intro.status === 'mutual') return showMutual(intro.moment || moment);

  heading.textContent = 'You’re playing ' + person.name + '.';
  status.textContent = `A ${name.toLowerCase()} opted in to meet you. Accept to reveal a suggested moment for both sides.`;
  accept.hidden = false;
  accept.addEventListener('click', async () => {
    accept.disabled = true;
    try {
      const accepted = shared
        ? await introRequest('accept-intro', { id, key })
        : saveIntro({ ...intro, status: 'mutual', moment });
      if (accepted.status !== 'mutual') throw new Error('Consent pending');
      showMutual(accepted.moment || moment);
    } catch {
      status.textContent = 'The request is still pending. Try accepting again.';
      accept.disabled = false;
    }
  });
}

openIntro().catch(() => { status.textContent = 'This link expired or the request was made in another browser’s local demo.'; });
