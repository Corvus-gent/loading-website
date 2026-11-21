import { EVENT_PATH, preset, getPersona, savePersona, normalizeCard, normalizeProfileUrl, guessPersona, cleanText } from './persona.js';
import { CLASSES, OPTIONS, DEFAULT_PIRATE, seededPirate, normalizePirate, pixelCanvas, paintPirate, paintParrot } from './pirate.js';
import { playBaySound, wireSound } from './sound.js';

const picker = document.querySelector('#persona-choices');
const profileForm = document.querySelector('#profile-form');
const profileStatus = document.querySelector('#profile-status');
const cardForm = document.querySelector('#card-form');
const cardStatus = document.querySelector('#card-status');
const cardSource = document.querySelector('#card-source');
const stage = document.querySelector('#creator-sprite');
const figure = pixelCanvas(48, 'creator-body');
const parrot = pixelCanvas(22, 'creator-bird');
const wings = pixelCanvas(22, 'creator-wings');
const birdGroup = document.createElement('div');
birdGroup.className = 'creator-bird-group';
birdGroup.append(parrot, wings);
stage.append(figure, birdGroup);

const fields = ['builds', 'wants', 'offers'];
const sources = {
  preset: 'Class defaults', heuristic: 'Heuristic draft', 'private-demo': 'Private mode (demo)',
  llm: 'AI draft', private: 'NYTEX private mode'
};
const labels = {
  skin: 'Skin palette', hat: 'Hat', coat: 'Coat color', eye: 'Eyewear',
  item: 'Held item', bird: 'Species / color', birdHat: 'Parrot hat'
};
const names = ['Tide Byte', 'Salt Shard', 'Cinder Voss', 'Bit Marlow', 'Brass Wake', 'Patch Reed'];
const saved = getPersona();
let current = saved || preset('hacker');

for (const [key, options] of Object.entries(OPTIONS)) {
  const label = document.createElement('label');
  const caption = document.createElement('span');
  caption.id = 'kit-' + key;
  caption.textContent = labels[key];
  const select = document.createElement('select');
  select.name = key;
  select.setAttribute('aria-labelledby', caption.id);
  options.forEach((option, index) => select.add(new Option(option, index)));
  label.append(caption, select);
  document.querySelector(key.startsWith('bird') ? '#parrot-options' : '#pirate-options').append(label);
}

for (const [type, crewClass] of Object.entries(CLASSES)) {
  const choice = document.createElement('label');
  choice.className = 'persona-choice creator-choice';
  const input = document.createElement('input');
  input.type = 'radio';
  input.name = 'type';
  input.value = type;
  const mark = document.createElement('span');
  mark.className = 'choice-icon';
  mark.setAttribute('aria-hidden', 'true');
  mark.textContent = crewClass.mark;
  const text = document.createElement('span');
  const title = document.createElement('strong');
  title.textContent = crewClass.name;
  const role = document.createElement('small');
  role.className = 'creator-role';
  role.textContent = crewClass.role;
  const pitch = document.createElement('small');
  pitch.textContent = crewClass.pitch;
  text.append(title, role, pitch);
  choice.append(input, mark, text);
  picker.append(choice);
}

function setDetails(card) {
  current = card;
  for (const field of fields) cardForm.elements.namedItem(field).value = card[field];
  cardSource.textContent = sources[card.source] + (card.reader === 'context' ? ' · Context.dev' : '');
}

function setAppearance(pirate) {
  for (const key of Object.keys(OPTIONS)) cardForm.elements.namedItem(key).value = pirate[key];
  cardForm.elements.birdName.value = pirate.birdName;
}

function getAppearance() {
  const pirate = Object.fromEntries(Object.keys(OPTIONS).map(key => [key, Number(cardForm.elements.namedItem(key).value)]));
  return normalizePirate({ ...pirate, birdName: cardForm.elements.birdName.value });
}

function draw() {
  const pirate = getAppearance();
  paintPirate(figure.getContext('2d'), pirate, { parrot: false });
  for (const [canvas, flying] of [[parrot, false], [wings, true]]) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 22, 22);
    paintParrot(ctx, pirate, 0, 0, flying);
  }
  document.querySelector('#sprite-class').textContent = CLASSES[cardForm.elements.type.value].name;
  document.querySelector('#sprite-name').textContent = cleanText(cardForm.elements.name.value, 48) || 'Unnamed pirate';
  document.querySelector('#sprite-bird-name').textContent = pirate.birdName || 'Parrot';
  document.querySelector('#sprite-wants').textContent = cleanText(cardForm.elements.wants.value) || 'Squawk!';
}

cardForm.elements.type.value = current.type;
if (saved?.pirate) cardForm.elements.name.value = saved.name;
setAppearance(saved?.pirate || DEFAULT_PIRATE);
setDetails(current);
draw();
wireSound(document.querySelector('#bay-sound'));

cardForm.addEventListener('input', event => {
  if (event.target.name === 'type' && current.source === 'preset') setDetails(preset(event.target.value));
  draw();
});

document.querySelector('#roll-pirate').addEventListener('click', () => {
  setAppearance(seededPirate(crypto.getRandomValues(new Uint32Array(1))[0]));
  cardForm.elements.name.value = names[Math.floor(Math.random() * names.length)];
  draw();
  playBaySound('squawk');
});

profileForm.addEventListener('submit', async event => {
  event.preventDefault();
  const button = profileForm.querySelector('button[type="submit"]');
  let url;
  try { url = normalizeProfileUrl(profileForm.elements.profile.value); }
  catch (error) { profileStatus.textContent = error.message; return; }

  const privateMode = profileForm.elements.privateMode.checked;
  button.disabled = true;
  profileStatus.textContent = 'Your parrot is reading the public link…';
  let card;
  try {
    const response = await fetch('/api/hackersbay?action=persona', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: url.href, privateMode }), signal: AbortSignal.timeout(10000)
    });
    if (response.ok) card = normalizeCard(await response.json());
  } catch { /* The same heuristic works entirely in the browser. */ }
  button.disabled = false;
  profileStatus.textContent = 'Builds, Wants, and Offers are ready in the ship’s log.';
  setDetails(card || guessPersona(url, '', privateMode));
  draw();
  playBaySound('squawk');
});

cardForm.addEventListener('submit', event => {
  event.preventDefault();
  const { name, type, builds, wants, offers } = Object.fromEntries(new FormData(cardForm));
  const card = savePersona({ ...current, name, type, builds, wants, offers, pirate: getAppearance() });
  if (!card) { cardStatus.textContent = 'Add a pirate name and fill in Builds, Wants, and Offers.'; return; }
  location.assign(EVENT_PATH + '?lens=' + encodeURIComponent(card.type));
});
