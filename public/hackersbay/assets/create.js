import { normalizeLumaUrl } from './luma.js';
import { eventCall, eventLink, previewEvent } from './organizer.js';

const form = document.querySelector('#event-form');
const importForm = document.querySelector('#import-event');
const importStatus = document.querySelector('#import-status');
const status = document.querySelector('#event-status');
const result = document.querySelector('#event-created');
const inviteLink = document.querySelector('#public-invite');
let source = '';

importForm.addEventListener('submit', async event => {
  event.preventDefault();
  const submit = importForm.querySelector('button');
  submit.disabled = true;
  source = '';
  importStatus.textContent = 'Reading the public event page…';
  try {
    const url = normalizeLumaUrl(importForm.elements.url.value);
    const { event: imported } = await eventCall('luma', { url: url.href });
    if (!imported) throw new Error('Public details weren’t available. Enter the event details below.');
    for (const name of ['title', 'startsAt', 'place', 'host']) {
      if (imported[name]) form.elements[name].value = imported[name];
    }
    source = url.href;
    importStatus.textContent = 'Imported public details. Review them before creating your event.';
  } catch (error) {
    importStatus.textContent = error.message;
  } finally {
    submit.disabled = false;
  }
});

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (importForm.querySelector('button').disabled) {
    status.textContent = 'Wait for the public event import to finish.';
    return;
  }
  const submit = form.querySelector('button');
  submit.disabled = true;
  status.textContent = 'Creating your event…';
  try {
    const details = { ...Object.fromEntries(new FormData(form)), source };
    let created;
    try { created = await eventCall('create-event', details); }
    catch (error) {
      if (error.status !== 503) throw error;
      created = previewEvent(details);
    }
    const selection = { id: created.event.id, local: created.local };
    inviteLink.href = eventLink('invite', selection);
    document.querySelector('#organizer-link').href = eventLink('host', selection) + '#key=' + created.key;
    document.querySelector('#share-note').textContent = created.local
      ? 'Local preview. Your invite and roster open in this browser.'
      : 'Share the invite with guests. Keep your organizer link private so you can see the roster.';
    status.textContent = 'Event created.';
    result.hidden = false;
    result.querySelector('h2').focus();
  } catch (error) {
    status.textContent = error.message || 'The event could not be created. Try again.';
  } finally {
    submit.disabled = false;
  }
});

document.querySelector('#copy-invite').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(inviteLink.href);
    status.textContent = 'Invite copied.';
  } catch {
    status.textContent = inviteLink.href;
  }
});
