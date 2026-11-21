import { loadRoom, crewAvatar } from './event-data.js';
import { EVENT_PATH } from './persona.js';
import { CLASSES } from './pirate.js';
import { TOKEN, introRequest, meetingFor, readIntros, saveIntro } from './intros.js';
import { mutualParrots } from './parrot-view.js';
import { playBaySound, wireSound } from './sound.js';
import { giveCoins, squawkStatus } from './game.js';

const query = new URLSearchParams(location.search);
const id = query.get('request');
const key = new URLSearchParams(location.hash.slice(1)).get('key');
const shared = query.get('demo') !== '1';
const heading = document.querySelector('#intro-title');
const status = document.querySelector('#intro-context');
const decisions = document.querySelector('#intro-decisions');
const accept = document.querySelector('#accept-intro');
const decline = document.querySelector('#decline-intro');
const mutual = document.querySelector('#intro-mutual');
const birds = document.querySelector('#intro-parrots');
wireSound(document.querySelector('#bay-sound'));

function showDecision(result, person, moment) {
  decisions.hidden = true;
  if (result.status === 'declined') {
    heading.textContent = 'Intro declined.';
    squawkStatus(status,'The other pirate won’t see a suggested meetup.','wave');
    birds.replaceChildren(crewAvatar(person));
    return;
  }
  heading.textContent = 'IT’S MUTUAL ⚓';
  status.classList.remove('squawk-status');
  status.textContent = 'Both sides accepted the introduction.';
  birds.replaceChildren(mutualParrots());
  mutual.textContent = 'Suggested meetup · ' + (result.moment || moment);
  mutual.hidden = false;
  mutual.dataset.mutualId = id;
  giveCoins('intro-' + id,5);
  setTimeout(() => playBaySound('coin'),450);
}

async function openIntro() {
  if (!TOKEN.test(id ?? '') || !TOKEN.test(key ?? '')) throw new Error('Invalid link');
  const localIntro = () => readIntros().find(row => row.id === id && row.key === key);
  const [{ event, attendees }, intro] = await Promise.all([
    loadRoom(),
    shared ? introRequest('intro-status', { id, key }) : localIntro()
  ]);
  const personIndex = attendees.findIndex(person => person.id === intro?.personId);
  if (personIndex < 0 || !Object.hasOwn(CLASSES, intro.type)) throw new Error('Unknown intro');
  const person = attendees[personIndex];
  const returnUrl = EVENT_PATH + '?lens=' + intro.type + '#match-' + person.id;
  document.querySelector('#return-to-room').href = returnUrl;
  document.querySelector('#intro-back').href = returnUrl;
  const moment = meetingFor(event, personIndex);
  if (intro.status !== 'pending') return showDecision(intro, person, moment);

  heading.textContent = 'You’re playing ' + person.name + '.';
  birds.append(crewAvatar(person));
  status.classList.remove('squawk-status');
  status.textContent = 'A ' + CLASSES[intro.type].name.toLowerCase() + ' wants to meet you. Accept to reveal a suggested meetup.';
  decisions.hidden = false;
  async function decide(decision) {
    accept.disabled = decline.disabled = true;
    try {
      let result;
      if (shared) result = await introRequest(decision === 'mutual' ? 'accept-intro' : 'decline-intro', { id, key });
      else {
        const latest = localIntro();
        if (!latest) throw new Error('Unknown intro');
        result = latest.status === 'pending' ? saveIntro({
          ...latest, status: decision, ...(decision === 'mutual' && { moment })
        }) : latest;
      }
      if (result.status === 'pending') throw new Error('Consent pending');
      showDecision(result, person, moment);
    } catch {
      status.textContent = 'The request is still pending. Try again.';
      accept.disabled = decline.disabled = false;
    }
  }
  accept.addEventListener('click', () => void decide('mutual'));
  decline.addEventListener('click', () => void decide('declined'));
}

openIntro().catch(() => { squawkStatus(status,'This link expired or the request was made in another browser’s local demo.'); });
