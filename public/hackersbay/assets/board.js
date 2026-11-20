import { EVENT_PATH, PERSONAS, preset, getPersona, savePersona, normalizeCard, normalizeProfileUrl, guessPersona } from './persona.js';

const picker = document.querySelector('#persona-choices');
const profileForm = document.querySelector('#profile-form');
const profileStatus = document.querySelector('#profile-status');
const crewCard = document.querySelector('#crew-card');
const cardForm = document.querySelector('#card-form');
const cardStatus = document.querySelector('#card-status');
const cardTitle = document.querySelector('#card-title');
const cardType = document.querySelector('#card-type');
const cardSource = document.querySelector('#card-source');
const sources = {
  preset: 'Persona picked', heuristic: 'Heuristic draft', 'private-demo': 'Private mode (demo)',
  llm: 'AI draft', private: 'NYTEX private mode'
};
let current = getPersona();

function renderCard(card, focus = true) {
  current = card;
  cardTitle.textContent = card.name;
  cardSource.textContent = sources[card.source] + (card.reader === 'context' ? ' · Context.dev' : '');
  for (const field of ['type', 'builds', 'wants', 'offers']) cardForm.elements.namedItem(field).value = card[field];
  for (const button of picker.children) button.setAttribute('aria-pressed', button.dataset.type === card.type ? 'true' : 'false');
  crewCard.hidden = false;
  cardStatus.textContent = '';
  if (focus) cardTitle.focus();
}

for (const [type, persona] of Object.entries(PERSONAS)) {
  const button = document.createElement('button');
  button.className = 'persona-choice';
  button.type = 'button';
  button.dataset.type = type;
  button.setAttribute('aria-pressed', 'false');
  const icon = document.createElement('span');
  icon.className = 'choice-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = persona.icon;
  const text = document.createElement('span');
  const title = document.createElement('strong');
  const description = document.createElement('small');
  title.textContent = persona.title;
  description.textContent = persona.description;
  text.append(title, description);
  button.append(icon, text);
  button.addEventListener('click', () => renderCard(preset(type)));
  picker.append(button);
  cardType.add(new Option(persona.title, type));
}

let requestId = 0;
profileForm.addEventListener('submit', async event => {
  event.preventDefault();
  const button = profileForm.querySelector('button[type="submit"]');
  let url;
  try { url = normalizeProfileUrl(profileForm.elements.profile.value); }
  catch (error) { profileStatus.textContent = error.message; return; }

  const id = ++requestId;
  button.disabled = true;
  profileStatus.textContent = 'Reading your public profile…';
  let card;
  try {
    const response = await fetch('/api/hackersbay?action=persona', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: url.href }), signal: AbortSignal.timeout(7000)
    });
    if (response.ok) card = normalizeCard(await response.json());
  } catch { /* The same heuristic works entirely in the browser. */ }
  button.disabled = false;
  if (id !== requestId) return;
  profileStatus.textContent = card ? 'Crew card ready.' : 'Crew card ready from the link.';
  renderCard(card || guessPersona(url));
});
picker.addEventListener('click', () => {
  requestId++;
  profileStatus.textContent = '';
});

cardType.addEventListener('change', () => {
  if (current.source === 'preset') return renderCard(preset(cardType.value), false);
  for (const button of picker.children) button.setAttribute('aria-pressed', button.dataset.type === cardType.value ? 'true' : 'false');
});

cardForm.addEventListener('submit', event => {
  event.preventDefault();
  const card = savePersona({ ...current, ...Object.fromEntries(new FormData(cardForm)) });
  if (!card) { cardStatus.textContent = 'Fill in Builds, Wants, and Offers before continuing.'; return; }
  location.assign(EVENT_PATH + '?lens=' + encodeURIComponent(card.type));
});

if (current) renderCard(current, false);
