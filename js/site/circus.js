// Little purple circuses, scattered in the margins. A few hide something.
import {readPreference, savePreference} from '../storage.js';
const TENT = '<svg viewBox="0 0 32 32" aria-hidden="true" focusable="false"><path d="M16 3v4" stroke="#ffd76a" stroke-width="1.5"/><path d="M16 3l6 2-6 2z" fill="#ffd76a"/><path d="M16 7L3 19h26z" fill="#5a4386"/><path d="M16 7l-4.3 12h2.9zM16 7l4.3 12h-2.9zM16 7l-10.5 12h3zM16 7l10.5 12h-3z" fill="#2c1f45"/><path d="M5 19h22v9H5z" fill="#3d2b5e"/><path d="M13 28v-6a3 3 0 0 1 6 0v6z" fill="#120d1a"/><path d="M5 19h22" stroke="#ffd76a88"/></svg>';
const EMOJI = ['🎪', '🤹', '🎩', '🃏', '🦁', '🐘', '🎠', '🔦', '🪶', '🐦‍⬛', '✨', '🎟️'];
const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
const rand = (a, b) => a + Math.random() * (b - a);
const page = location.pathname.replace(/\/+$/, '') || '/';

function record(id) {
  const saved = readPreference('corvus-secrets', []), list = Array.isArray(saved) ? saved : [];
  if (!list.includes(id)) savePreference('corvus-secrets', [...list, id]);
  window.dispatchEvent(new CustomEvent('corvus-secret-found', {detail: {id}}));
}
function burst(x, y) {
  if (still) return;
  for (let i = 0; i < 7; i++) {
    const s = document.createElement('span');
    s.className = 'circus-pop'; s.setAttribute('aria-hidden', 'true');
    s.textContent = EMOJI[Math.floor(Math.random() * EMOJI.length)];
    s.style.left = x + 'px'; s.style.top = y + 'px';
    s.style.setProperty('--dx', rand(-70, 70) + 'px'); s.style.setProperty('--dy', rand(-130, -50) + 'px');
    document.body.append(s); setTimeout(() => s.remove(), 1300);
  }
}
const height = () => Math.max(document.documentElement.scrollHeight, innerHeight);
function scatter() {
  const h = height(), count = Math.max(3, Math.min(8, Math.round(h / 700)));
  const hiddenAt = Math.floor(Math.random() * count);
  for (let i = 0; i < count; i++) {
    const left = Math.random() < .5, top = rand(.12, .96) * h, side = `${left ? 'left' : 'right'}:${rand(.5, 4).toFixed(2)}vw`;
    if (i === hiddenAt) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'circus-tent is-secret'; b.innerHTML = TENT;
      b.setAttribute('aria-label', 'A tiny circus. Something is inside.');
      b.style.cssText = `${side};top:${top}px;--tilt:${rand(-12, 12)}deg`;
      b.addEventListener('click', () => { const r = b.getBoundingClientRect(); burst(r.left + r.width / 2, r.top); b.classList.add('found'); record('circus:' + page); });
      document.body.append(b);
    } else {
      const s = document.createElement('span');
      s.className = 'circus-tent'; s.innerHTML = TENT; s.setAttribute('aria-hidden', 'true');
      s.style.cssText = `${side};top:${top}px;--tilt:${rand(-12, 12)}deg;--size:${rand(14, 24)}px`;
      document.body.append(s);
    }
  }
  // Hidden emojis: invisible until a cursor wanders close.
  for (let i = 0; i < 3; i++) {
    const e = document.createElement('span');
    e.className = 'hidden-emoji'; e.setAttribute('aria-hidden', 'true');
    e.textContent = EMOJI[Math.floor(Math.random() * EMOJI.length)];
    e.style.cssText = `left:${rand(3, 88)}vw;top:${rand(.08, .96) * h}px`;
    e.addEventListener('pointerenter', () => { if (!e.dataset.seen) { e.dataset.seen = '1'; record('emoji:' + e.textContent); } });
    document.body.append(e);
  }
}
if (document.readyState === 'complete') scatter(); else addEventListener('load', scatter, {once: true});
