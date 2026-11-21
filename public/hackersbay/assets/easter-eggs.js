import { captainArt } from './art.js';
import { playShanty } from './sound.js';

const konami = ['arrowup','arrowup','arrowdown','arrowdown','arrowleft','arrowright','arrowleft','arrowright','b','a'].join(' ');
let keys = [];
let letters = '';
let rain;
let lastAhoy = -Infinity;

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

window.addEventListener('keydown', event => {
  if (event.repeat || event.altKey || event.metaKey || event.ctrlKey) return;
  const key = event.key.toLowerCase();
  keys = [...keys.slice(-9), key];
  if (keys.join(' ') === konami) {
    keys = [];
    parrotRain();
  }
  letters = /^[a-z]$/.test(key) ? (letters + key).slice(-4) : '';
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
