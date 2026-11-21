import { squawkStatus } from './game.js';
import { DEMO_PREVIEW, boatPreviewUrl, normalizeRepo } from './proof.js';

const form = document.querySelector('#proof-form');
const status = document.querySelector('#proof-status');
const link = document.querySelector('#proof-result');
const button = form.querySelector('button');
const storageKey = 'hackersbay-proof-v1';

function render(result) {
  const liveUrl = result.mode === 'boat' && result.expiresAt > Date.now() ? boatPreviewUrl(result.url) : '';
  link.href = liveUrl || DEMO_PREVIEW;
  link.textContent = liveUrl ? 'Open running preview ↗' : 'Open sample preview ↗';
  link.hidden = false;
  squawkStatus(status,liveUrl ? 'Boat.dev sandbox ready · ' + result.repo
    : 'Boat.dev demo · ' + (result.reason || 'Example sandbox preview') + ' for ' + result.repo + '.', 'thumbs-up');
}

try {
  const saved = JSON.parse(localStorage.getItem(storageKey));
  if (saved?.repo) render(saved);
} catch { /* Start with an empty preview panel. */ }

form.addEventListener('submit', async event => {
  event.preventDefault();
  let repo;
  try { repo = normalizeRepo(form.elements.repo.value); }
  catch (error) { status.textContent = error.message; return; }
  squawkStatus(status,'Checking sandbox availability…','typing');
  button.disabled = true;
  link.hidden = true;
  let result;
  const deadline = Date.now() + 65000;
  try {
    do {
      const response = await fetch('/api/hackersbay?action=proof', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo }), signal: AbortSignal.timeout(15000)
      });
      if (!response.ok) throw new Error('Preview unavailable');
      result = await response.json();
      if (result.mode !== 'building') break;
      squawkStatus(status,'Boat.dev is starting the VM and checking the app…','typing');
      await new Promise(resolve => setTimeout(resolve, 2700));
    } while (Date.now() < deadline);
  } catch { /* Keep the sample available through network errors. */ }
  if (!result || result.mode === 'building') result = { mode: 'demo', repo, reason: 'The live preview is unavailable' };
  render(result);
  try { localStorage.setItem(storageKey, JSON.stringify(result)); } catch { /* Keep the result on this page. */ }
  button.disabled = false;
});
