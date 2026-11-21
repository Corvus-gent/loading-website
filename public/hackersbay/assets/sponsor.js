import { element, loadRoom, portrait } from './event-data.js';

const features = {
  'ari-sol': { thesis: 'infra', fit: 'Boat.dev', opportunity: 'Run the same CI jobs on disposable VMs and compare time to preview.' },
  'imani-reed': { thesis: 'infra', fit: 'Boat.dev', opportunity: 'Give new users an isolated starter environment and record successful first runs.' },
  'kai-navarro': { thesis: 'web', fit: 'Context.dev', opportunity: 'Read public venue pages and turn changes into an offline route update.' },
  'cleo-wind': { thesis: 'web', fit: 'Context.dev', opportunity: 'Build a venue discovery feed from public repair-cafe listings.' },
  'zora-quinn': { thesis: 'privacy', fit: 'NYTEX', opportunity: 'Test a confidential inference route for post-meeting summaries.' },
  'jay-ren': { thesis: 'privacy', fit: 'NYTEX', opportunity: 'Benchmark latency and throughput for two eligible confidential inference routes.' }
};

const projects = document.querySelector('#report-projects');
const state = document.querySelector('#report-state');
const filter = document.querySelector('#sponsor-fit');

function projectCard(person) {
  const { fit, opportunity } = features[person.id];
  const card = element('article', undefined, 'panel report-card');
  const header = element('header');
  const title = element('div');
  title.append(element('h3', person.project), element('p', person.name + ' · ' + person.role, 'fine'));
  header.append(portrait(person), title);
  const traction = element('p', 'Demo signal · ' + person.signal, 'pill');
  const details = element('p', person.builds + '.');
  const next = element('p', fit + ' fit · ' + opportunity, 'fine');
  card.append(header, details, traction, next);
  return card;
}

loadRoom().then(({ attendees }) => {
  const byId = new Map(attendees.map(person => [person.id, person]));
  function render() {
    const shown = Object.keys(features).filter(id => filter.value === 'all' || features[id].thesis === filter.value);
    projects.replaceChildren(...shown.map(id => projectCard(byId.get(id))));
    state.textContent = shown.length + ' fictional projects shown.';
  }
  filter.addEventListener('change', render);
  render();
}).catch(() => { state.textContent = 'The demo report is unavailable. Reload the page to try again.'; });
