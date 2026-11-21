import { element, loadRoom, crewAvatar } from './event-data.js';
import { eventLink, eventSelection, readEvent } from './organizer.js';
import { PERSONAS } from './persona.js';
import { personaTags } from './lens.js';
import { CLASSES } from './pirate.js';
import { rosterCsv } from './roster-csv.js';
import { squawkStatus } from './game.js';

const custom = eventSelection();
const STORAGE = 'hackersbay-room-composer-v1' + (custom ? ':' + custom.id : '');
const DEFAULT_CREW = ['mina-park', 'zora-quinn', 'ravi-mora', 'noor-tan'];
const CAPACITY = 10;
const board = document.querySelector('#host-room');
const status = document.querySelector('#host-state');
const graph = document.querySelector('#match-graph');
const canvas = graph.querySelector('canvas');
const nodes = document.querySelector('#graph-nodes');
const graphDetail = document.querySelector('#graph-detail');
const list = document.querySelector('#applicants');
const filter = document.querySelector('#find-applicant');
const dock = document.querySelector('#deck-drop');

function makeDragHandle(person, boardPirate) {
  const grip = element('button', 'Drag aboard', 'button drag-pirate');
  grip.type = 'button';
  grip.setAttribute('aria-label', 'Drag ' + person.name + ' aboard');
  let drag;

  function place(event) {
    drag.ghost.style.transform = `translate(${event.clientX - 33}px,${event.clientY - 52}px)`;
    const target = document.elementFromPoint(event.clientX, event.clientY);
    graph.toggleAttribute('data-drop-target', graph.contains(target));
    dock.toggleAttribute('data-drop-target', dock.contains(target));
  }
  function finish(event) {
    if (!drag || event.pointerId !== drag.id) return;
    if (event.type === 'pointerup') place(event);
    const landed = event.type === 'pointerup' && (graph.hasAttribute('data-drop-target') || dock.hasAttribute('data-drop-target'));
    drag.ghost.remove();
    drag = null;
    dock.hidden = true;
    graph.removeAttribute('data-drop-target');
    dock.removeAttribute('data-drop-target');
    document.body.removeAttribute('data-dragging-pirate');
    if (landed) boardPirate(person.id);
  }
  grip.addEventListener('pointerdown', event => {
    if (grip.disabled || !event.isPrimary || event.button !== 0) return;
    const ghost = element('div', undefined, 'drag-ghost');
    ghost.setAttribute('aria-hidden', 'true');
    ghost.append(crewAvatar(person));
    document.body.append(ghost);
    document.body.setAttribute('data-dragging-pirate', '');
    dock.hidden = false;
    grip.setPointerCapture(event.pointerId);
    drag = { ghost, id: event.pointerId };
    place(event);
  });
  grip.addEventListener('pointermove', event => { if (drag?.id === event.pointerId) place(event); });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) grip.addEventListener(type, finish);
  grip.addEventListener('click', event => { if (event.detail === 0) boardPirate(person.id); });
  return grip;
}

function shared(a, b) {
  return a.filter(tag => b.includes(tag));
}
function relationship(a, b) {
  return { a, b, aGets: shared(a.seeks, b.brings), bGets: shared(b.seeks, a.brings) };
}
function mutual(edge) {
  return edge.aGets.length > 0 && edge.bGets.length > 0;
}
function rankCandidate(person, crew, tagsInRoom) {
  const edges = crew.map(member => relationship(person, member));
  const linked = edges.filter(mutual);
  const adds = person.brings.filter(tag => !tagsInRoom.has(tag));
  const touches = edges.reduce((count, edge) => count + edge.aGets.length + edge.bGets.length, 0);
  const stage = { shipping: 3, pilot: 2, prototype: 1 }[person.stage];
  return { person, linked, adds, score: linked.length * 8 + touches * 2 + adds.length * 3 + stage };
}
function readCrew() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE));
    if (Array.isArray(saved)) return saved;
  } catch { /* Start from the sample crew. */ }
  return custom ? [] : DEFAULT_CREW;
}
function storeCrew(ids) {
  try { localStorage.setItem(STORAGE, JSON.stringify(ids)); } catch { /* The current page keeps the draft. */ }
}
function label(tags) {
  return tags.map(tag => ({ opensource: 'open source', devtools: 'dev tools', cofounder: 'co-founder' })[tag] || tag).join(', ');
}

function placeGraph(crew, edges, selected) {
  const rect = graph.getBoundingClientRect();
  const dpr = Math.min(devicePixelRatio, 2);
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  const coordinates = new Map(crew.map((person, index) => {
    const angle = (index / crew.length) * 2 * Math.PI - Math.PI / 2;
    return [person.id, [50 + 36 * Math.cos(angle), 50 + 36 * Math.sin(angle)]];
  }));
  for (const edge of edges) {
    const color = edge.a.id === selected || edge.b.id === selected ? '#3ee6c4' : '#387973';
    const [aX, aY] = coordinates.get(edge.a.id);
    const [bX, bY] = coordinates.get(edge.b.id);
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = color === '#3ee6c4' ? 2 : 1;
    ctx.moveTo(aX * rect.width / 100, aY * rect.height / 100);
    ctx.lineTo(bX * rect.width / 100, bY * rect.height / 100);
    ctx.stroke();
  }
  return coordinates;
}

async function start() {
  let attendees;
  let exportRows;
  if (custom) {
    const key = new URLSearchParams(location.hash.slice(1)).get('key') || '';
    const room = await readEvent(custom, key);
    exportRows = room.attendees.map(person => ({ ...person, role:CLASSES[person.type].name }));
    attendees = room.attendees.map(entry => {
      const defaults = PERSONAS[entry.type];
      const { brings, seeks } = personaTags(entry);
      return { ...entry, role: CLASSES[entry.type].name, brings, seeks, offers: entry.offers || defaults.offers, project: entry.builds, stage: 'prototype' };
    });
    document.querySelector('#room-event-title').textContent = room.event.title;
    document.querySelector('#roster-label').textContent = custom.local ? 'LOCAL PREVIEW ROSTER' : 'EVENT ROSTER';
    const invite = document.querySelector('#room-invite');
    invite.href = eventLink('invite', custom);
    invite.hidden = false;
    document.querySelector('#room-refresh').hidden = false;
  } else {
    ({ attendees } = await loadRoom());
    exportRows = attendees;
  }
  const byId = new Map(attendees.map(person => [person.id, person]));
  let ids = [...new Set(readCrew().filter(id => byId.has(id)))].slice(0, CAPACITY);
  let selected = ids[0];
  let redraw = () => {};
  document.querySelector('#export-roster').addEventListener('click', () => {
    const file = new Blob([rosterCsv(exportRows,new Set(ids))], {type:'text/csv;charset=utf-8'});
    const url = URL.createObjectURL(file);
    const download = element('a');
    download.href = url;
    download.download = 'hackersbay-attendee-sheet.csv';
    download.click();
    setTimeout(() => URL.revokeObjectURL(url),1000);
  });

  function boardPirate(id) {
    if (ids.length >= CAPACITY || ids.includes(id) || !byId.has(id)) return;
    ids = [...ids, id];
    selected = id;
    storeCrew(ids);
    render(id);
  }

  function render(focusId) {
    const crew = ids.map(id => byId.get(id));
    const edges = crew.flatMap((person, index) => crew.slice(index + 1).map(member => relationship(person, member))).filter(mutual);
    const tags = new Set(crew.flatMap(person => person.brings));
    document.querySelector('#room-metrics').textContent = `${crew.length}/${CAPACITY} seats · ${edges.length} two-way fits · ${tags.size} skill or resource tags`;
    redraw = () => placeGraph(crew, edges, selected);
    const coordinates = redraw();
    nodes.replaceChildren(...crew.map(person => {
      const button = element('button', undefined, 'graph-node');
      button.append(crewAvatar(person));
      button.type = 'button';
      button.setAttribute('aria-label', 'Connections for ' + person.name);
      button.setAttribute('aria-pressed', String(person.id === selected));
      button.dataset.node = person.id;
      const [x, y] = coordinates.get(person.id);
      button.style.left = x + '%';
      button.style.top = y + '%';
      button.addEventListener('click', () => { selected = person.id; render(person.id); });
      return button;
    }));

    const focus = byId.get(selected);
    const connects = edges.filter(edge => edge.a.id === selected || edge.b.id === selected);
    graphDetail.textContent = focus
      ? focus.name + (connects.length ? ' has two-way fit with ' + connects.map(edge => edge.a.id === selected ? edge.b.name : edge.a.name).join(', ') + '.' : ' has no two-way fit in this draft yet.')
      : 'Add an applicant to start the graph.';
    document.querySelector('#draft-crew').replaceChildren(...crew.map(person => {
      const button = element('button', person.name + ' ×', 'button');
      button.type = 'button';
      button.setAttribute('aria-label', 'Remove ' + person.name);
      button.addEventListener('click', () => {
        ids = ids.filter(id => id !== person.id);
        if (selected === person.id) selected = ids[0];
        storeCrew(ids);
        render(selected);
      });
      return button;
    }));

    const term = filter.value.trim().toLowerCase();
    const ranked = attendees.filter(person => !ids.includes(person.id) && [person.name, person.role, person.project].join(' ').toLowerCase().includes(term))
      .map(person => rankCandidate(person, crew, tags)).sort((a, b) => b.score - a.score || a.person.name.localeCompare(b.person.name));
    list.replaceChildren(...ranked.map(({ person, adds, linked, score }) => {
      const article = element('article', undefined, 'panel applicant');
      const title = element('div');
      title.append(element('h3', person.name), element('p', person.project ? person.role + ' · ' + person.project : person.role, 'fine'));
      const top = element('header');
      top.append(crewAvatar(person), title, element('span', '+' + score, 'match-mark'));
      const contribution = element('p', 'Offers ' + person.offers + '.');
      const reason = element('p', (adds.length ? 'Adds ' + label(adds) + '. ' : '') +
        (linked.length ? 'Two-way fit with ' + linked.map(edge => edge.b.name).join(', ') + '.' : person.project ? 'Builds ' + person.project + '.' : 'Fit uses this pirate’s class defaults.'), 'fine');
      const add = element('button', 'Add to room', 'button');
      add.type = 'button';
      add.disabled = ids.length >= CAPACITY;
      add.setAttribute('aria-label', 'Add ' + person.name + ' to room');
      add.addEventListener('click', () => boardPirate(person.id));
      const drag = makeDragHandle(person, boardPirate);
      drag.disabled = add.disabled;
      const actions = element('div', undefined, 'applicant-actions');
      actions.append(add, drag);
      article.append(top, contribution, reason, actions);
      return article;
    }));
    if (!ranked.length) {
      const empty = element('p',undefined,'panel');
      squawkStatus(empty, attendees.length ? 'No pirates match that search.' : 'No one has boarded yet. Share your event invite, then refresh the roster.');
      list.append(empty);
    }
    if (focusId) nodes.querySelector('[data-node="' + focusId + '"]')?.focus();
  }

  board.hidden = false;
  status.hidden = true;
  render();
  new ResizeObserver(() => redraw()).observe(graph);
  filter.addEventListener('input', () => render());
  document.querySelector('#reset-room').addEventListener('click', () => {
    ids = (custom ? [] : DEFAULT_CREW).filter(id => byId.has(id));
    [selected] = ids;
    storeCrew(ids);
    render();
  });
}
if (custom) status.textContent = 'Loading your event roster…';
start().catch(error => { squawkStatus(status, custom ? error.message : 'The crew couldn’t board. Reload the page to try again.'); });

document.querySelector('#room-refresh').addEventListener('click', () => location.reload());
