import { captainArt } from './art.js';
import { playSalute, playShanty } from './sound.js';

const konami = ['arrowup','arrowup','arrowdown','arrowdown','arrowleft','arrowright','arrowleft','arrowright','b','a'].join(' ');
let keys = [];
let letters = '';
let rain;
let lastAhoy = -Infinity;
let salute;

function parrotRain() {
  rain?.remove();
  const cloud = document.createElement('div');
  cloud.className = 'parrot-rain';
  cloud.setAttribute('aria-hidden','true');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  for (let i = 0; i < (reduced ? 5 : 22); i++) {
    const drop = captainArt(i % 5 ? 'flying' : 'wave', { lazy:false });
    drop.style.setProperty('--rain-x', ((7 + i * 37) % 93) + '%');
    drop.style.setProperty('--rain-y', (10 + i * 13 % 65) + '%');
    drop.style.setProperty('--rain-delay', (i % 9 * .12) + 's');
    drop.style.setProperty('--rain-duration', (1.45 + i % 6 * .26) + 's');
    drop.style.setProperty('--rain-spin', (i % 2 ? 85 : -75) + 'deg');
    cloud.append(drop);
  }
  document.body.append(cloud);
  rain = cloud;
  setTimeout(() => cloud.remove(), reduced ? 1900 : 3800);
}

function crewSalute() {
  if (salute?.isConnected) return;
  salute = document.createElement('div');
  salute.className = 'crew-salute';
  salute.setAttribute('role', 'status');

  const words = document.createElement('strong');
  words.textContent = 'AYE AYE!';
  const captain = captainArt('wave', { lazy:false, alt:'Captain Squawk salutes' });
  const confetti = document.createElement('div');
  confetti.className = 'salute-confetti';
  confetti.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < 20; i++) {
    const fleck = document.createElement('i');
    const angle = i * Math.PI / 10;
    const distance = 15 + (i % 6)*3;
    fleck.style.setProperty('--salute-x', Math.round(Math.cos(angle) * distance) + 'vmin');
    fleck.style.setProperty('--salute-y', Math.round(Math.sin(angle) * distance) + 'vmin');
    fleck.style.setProperty('--salute-turn', ((i % 2 ? 1 : -1) * (90 + i*24)) + 'deg');
    fleck.style.setProperty('--salute-color', ['#ffc66b','#3ee6c4','#fb725e'][i%3]);
    confetti.append(fleck);
  }
  const current = salute;
  current.append(confetti, captain, words);
  document.body.append(current);
  playSalute();
  setTimeout(() => current.remove(), 2600);
}

window.addEventListener('keydown', event => {
  if (event.repeat || event.altKey || event.metaKey || event.ctrlKey) return;
  const key = event.key.toLowerCase();
  keys = [...keys.slice(-9), key];
  if (keys.join(' ') === konami) {
    keys = [];
    parrotRain();
  }
  letters = /^[a-z]$/.test(key) ? (letters + key).slice(-4) : '';
  if (letters === 'ayay') crewSalute();
  if (letters === 'ahoy' && performance.now() - lastAhoy > 3000) {
    lastAhoy = performance.now();
    void playShanty();
  }
});

if (new URLSearchParams(location.search).get('captain') === 'trav') {
  for (const link of document.querySelectorAll('a[href^="/hackersbay/board"]')) {
    const url = new URL(link.href);
    url.searchParams.set('captain','trav');
    link.href = url.href;
  }
}
