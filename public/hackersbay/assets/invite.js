import { eventLink, eventSelection, readEvent } from './organizer.js';

const status = document.querySelector('#invite-status');
const selection = eventSelection();

async function show() {
  if (!selection) throw new Error('Open the invite link from your organizer.');
  const { event } = await readEvent(selection);
  document.title = event.title + ' · The Hackers Bay';
  document.querySelector('#invite-title').textContent = event.title;
  for (const [key, label] of Object.entries({ startsAt: 'When', place: 'Where', host: 'Host' })) {
    if (!event[key]) continue;
    const row = document.createElement('li');
    row.textContent = label + ' · ' + event[key];
    document.querySelector('#invite-facts').append(row);
  }
  const source = document.querySelector('#invite-source');
  if (event.source) {
    source.href = event.source;
    source.hidden = false;
  }
  document.querySelector('#invite-board').href = eventLink('board', selection);
  document.querySelector('#invite-content').hidden = false;
  status.textContent = new URLSearchParams(location.search).has('boarded')
    ? 'You boarded as your pirate. The organizer can see your pirate name, class, and outfit.'
    : selection.local ? 'Local preview · this roster is saved in this browser.' : '';
}
show().catch(error => { status.textContent = error.message; });
