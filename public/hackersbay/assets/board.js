import { EVENT_PATH, preset, getPersona, savePersona, normalizeCard, normalizeProfileUrl, guessPersona, cleanText } from './persona.js';
import { CLASSES, pixelCanvas } from './pirate.js';
import { artPicture, captainArt, classArt } from './art.js';
import { normalizeLook, partArt, prepareDressed, rollLook, WARDROBE } from './wardrobe.js';
import { giveCoins, squawkStatus } from './game.js';
import { playBaySound, wireSound } from './sound.js';

const picker = document.querySelector('#persona-choices');
const profileForm = document.querySelector('#profile-form');
const profileStatus = document.querySelector('#profile-status');
const cardForm = document.querySelector('#card-form');
const cardStatus = document.querySelector('#card-status');
const cardSource = document.querySelector('#card-source');
const stage = document.querySelector('#creator-sprite');
const figure = pixelCanvas(132, 'creator-body');
figure.height = 144;
const ctx = figure.getContext('2d');
stage.append(figure);
document.querySelector('#wardrobe-captain').append(captainArt('squawk',{lazy:false}));

const fields = ['builds', 'wants', 'offers'];
const sources = {
  preset: 'Class defaults', heuristic: 'Heuristic draft', 'private-demo': 'Private mode (demo)',
  llm: 'AI draft', private: 'NYTEX private mode'
};
const labels = {hat:'Hat', eyes:'Eyewear', coat:'Outfit', item:'Held item'};
const names = ['Tide Byte', 'Salt Shard', 'Cinder Voss', 'Bit Marlow', 'Brass Wake', 'Patch Reed'];
const saved = getPersona();
let current = saved || preset('hacker');
let drawn = '';
const previews = {};

for (const [key, options] of Object.entries(WARDROBE)) {
  const label = document.createElement('label');
  const caption = document.createElement('span');
  caption.id = 'kit-' + key;
  caption.textContent = labels[key];
  const select = document.createElement('select');
  select.name = key;
  select.setAttribute('aria-labelledby',caption.id);
  select.add(new Option('Class kit',-1));
  options.forEach(([, name], index) => select.add(new Option(name,index)));
  const tile = document.createElement('span');
  tile.className = 'kit-tile';
  tile.setAttribute('aria-hidden','true');
  previews[key] = tile;
  label.append(caption,tile,select);
  document.querySelector('#pirate-options').append(label);
}

for (const [type, crewClass] of Object.entries(CLASSES)) {
  const choice = document.createElement('label');
  choice.className = 'persona-choice creator-choice';
  const input = document.createElement('input');
  input.type = 'radio';
  input.name = 'type';
  input.value = type;
  const text = document.createElement('span');
  const title = document.createElement('strong');
  title.textContent = crewClass.name;
  const role = document.createElement('small');
  role.className = 'creator-role';
  role.textContent = crewClass.role;
  const pitch = document.createElement('small');
  pitch.textContent = crewClass.pitch;
  text.append(title,role,pitch);
  choice.append(input,artPicture(classArt(type),{width:132,height:144,lazy:false,className:'class-preset'}),text);
  picker.append(choice);
}

function setDetails(card) {
  current = card;
  for (const field of fields) cardForm.elements.namedItem(field).value = card[field];
  cardSource.textContent = sources[card.source] + (card.reader === 'context' ? ' · Context.dev' : '');
}

function setAppearance(look) {
  for (const [key, index] of Object.entries(normalizeLook(look))) cardForm.elements.namedItem(key).value = index;
}

function getAppearance() {
  return normalizeLook(Object.fromEntries(Object.keys(WARDROBE).map(key => [key,Number(cardForm.elements.namedItem(key).value)])));
}

function draw() {
  const type = cardForm.elements.type.value;
  const look = getAppearance();
  const signature = type + JSON.stringify(look);
  if (signature !== drawn) {
    drawn = signature;
    for (const [key, index] of Object.entries(look)) {
      const art = partArt(key,index);
      previews[key].replaceChildren(art ? artPicture(art,{lazy:false}) : artPicture(classArt(type),{lazy:false,width:132,height:144}));
    }
    void prepareDressed(type,look).then(paint => {
      if (drawn === signature) paint(ctx);
    });
  }
  document.querySelector('#sprite-class').textContent = CLASSES[type].name;
  stage.setAttribute('aria-label', 'Your ' + CLASSES[type].name + ' parrot pirate');
  document.querySelector('#sprite-name').textContent = cleanText(cardForm.elements.name.value,48) || 'Unnamed pirate';
  document.querySelector('#sprite-wants').textContent = cleanText(cardForm.elements.wants.value) || 'What are you looking for tonight?';
}

cardForm.elements.type.value = current.type;
if (saved && saved.source !== 'preset') cardForm.elements.name.value = saved.name;
else if (saved?.look || saved?.pirate) cardForm.elements.name.value = saved.name;
setAppearance(saved?.look);
setDetails(current);
draw();
wireSound(document.querySelector('#bay-sound'));

cardForm.addEventListener('input',event => {
  if (event.target.name === 'type' && current.source === 'preset') setDetails(preset(event.target.value));
  draw();
});
document.querySelector('#reset-kit').addEventListener('click',() => { setAppearance(); draw(); });
document.querySelector('#roll-pirate').addEventListener('click',() => {
  const previous = JSON.stringify(getAppearance());
  let next = rollLook();
  if (previous === JSON.stringify(next)) next = {...next, item:(next.item+1)%WARDROBE.item.length};
  setAppearance(next);
  cardForm.elements.name.value = names[Math.floor(Math.random() * names.length)];
  draw();
  playBaySound('squawk');
});

profileForm.addEventListener('submit',async event => {
  event.preventDefault();
  const button = profileForm.querySelector('button[type="submit"]');
  let url;
  try { url = normalizeProfileUrl(profileForm.elements.profile.value); }
  catch (error) { squawkStatus(profileStatus,error.message); return; }

  const privateMode = profileForm.elements.privateMode.checked;
  button.disabled = true;
  squawkStatus(profileStatus,'Captain Squawk is reading the public link…','typing');
  let card;
  try {
    const response = await fetch('/api/hackersbay?action=persona', {
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({url:url.href,privateMode}),signal:AbortSignal.timeout(10000)
    });
    if (response.ok) card = normalizeCard(await response.json());
  } catch { /* The same heuristic works entirely in the browser. */ }
  button.disabled = false;
  squawkStatus(profileStatus,'Builds, Wants, and Offers are ready in the ship’s log.','thumbs-up');
  setDetails(card || guessPersona(url,'',privateMode));
  draw();
  playBaySound('squawk');
});

cardForm.addEventListener('submit',event => {
  event.preventDefault();
  const {name,type,builds,wants,offers} = Object.fromEntries(new FormData(cardForm));
  const card = savePersona({...current,name,type,builds,wants,offers,look:getAppearance()});
  if (!card) { squawkStatus(cardStatus,'Add a pirate name and fill in Builds, Wants, and Offers.'); return; }
  giveCoins('raised-first-flag',3);
  location.assign(EVENT_PATH + '?lens=' + encodeURIComponent(card.type));
});
