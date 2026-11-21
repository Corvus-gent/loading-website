import { artPicture, captainArt } from './art.js';

const storageKey = 'hackersbay-coin-ledger';
let ledger = {};
try {
  const saved = JSON.parse(localStorage.getItem(storageKey));
  if (saved && !Array.isArray(saved) && typeof saved === 'object') ledger = saved;
} catch { /* The session ledger works without storage. */ }

function drawCoins() {
  const count = Object.values(ledger).filter(Number.isFinite).reduce((sum, value) => sum + value, 0);
  for (const node of document.querySelectorAll('[data-bay-coins]')) {
    node.querySelector('span').textContent = String(count).padStart(2,'0');
    node.setAttribute('aria-label', count + ' gold coins');
  }
}

export function giveCoins(id, count) {
  if (Object.hasOwn(ledger,id)) return;
  ledger[id] = count;
  try { localStorage.setItem(storageKey, JSON.stringify(ledger)); } catch { /* Keep the session ledger. */ }
  drawCoins();
  for (const node of document.querySelectorAll('[data-bay-coins]')) {
    node.getAnimations().forEach(animation => animation.cancel());
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      node.animate([{transform:'translateY(0)'},{transform:'translateY(-5px)'},{transform:'translateY(0)'}],{duration:250});
    }
  }
}

export function squawkStatus(node, text, pose = 'squawk') {
  if (!node) return;
  node.classList.add('squawk-status');
  const words = document.createElement('span');
  words.textContent = text;
  node.replaceChildren(captainArt(pose,{lazy:false}), words);
}

for (const node of document.querySelectorAll('[data-bay-coins]')) {
  const icon = artPicture('coin', {width:18,height:18,lazy:false});
  node.replaceChildren(icon, document.createElement('span'));
}
drawCoins();
for (const node of document.querySelectorAll('[data-squawk]')) {
  squawkStatus(node,node.textContent.trim(),node.dataset.squawk);
}
