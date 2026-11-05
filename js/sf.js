import {clearTrackingURL} from './arrival.js';

// This static contact card never starts an analytics session.
clearTrackingURL();
console.log('Fog is called Karl here. Say hi to Gabriel.');

const lantern = document.querySelector('.lantern');
const inscription = document.querySelector('#inscription');
const raven = document.querySelector('.raven');
const caw = document.querySelector('#caw');
lantern.hidden = raven.hidden = false;

function showInscription(open) {
  inscription.hidden = !open;
  lantern.setAttribute('aria-expanded', String(open));
}
lantern.addEventListener('click', () => showInscription(inscription.hidden));

let returnTimer;
function returnRaven() {
  clearTimeout(returnTimer);
  raven.classList.remove('flown');
  caw.hidden = true;
}
function fly() {
  clearTimeout(returnTimer);
  caw.hidden = false;
  raven.classList.add('flown');
}
raven.addEventListener('click', () => {
  fly();
  if (matchMedia('(hover: none)').matches && !raven.matches(':focus-visible')) {
    returnTimer = setTimeout(returnRaven, 3500);
  }
});
raven.addEventListener('pointerenter', event => {
  if (event.pointerType === 'mouse' || event.pointerType === 'pen') fly();
});
raven.addEventListener('pointerleave', event => {
  if (event.pointerType !== 'touch' && !raven.matches(':focus-visible')) {
    returnTimer = setTimeout(returnRaven, 1300);
  }
});
raven.addEventListener('focus', () => { caw.hidden = false; });
raven.addEventListener('blur', returnRaven);
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    returnRaven();
    showInscription(false);
  }
});
