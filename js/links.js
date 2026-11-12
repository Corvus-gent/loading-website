import {arrivalSearch} from './arrival.js';
import {linkContext} from './link-context.js';
import {loadPersonas, mountPortrait, publicSocials} from './personas.js';

const props = linkContext(location.pathname, arrivalSearch);
const id = props.links_person;
const $ = id => document.getElementById(id);

function anchor(link, className) {
  const element = document.createElement('a');
  const url = new URL(link.href, location.origin);
  url.searchParams.set('utm_source', props.links_source);
  url.searchParams.set('utm_medium', 'links');
  url.searchParams.set('utm_campaign', id + '-' + props.links_campaign);
  url.searchParams.set('utm_content', props.utm_content || link.id);
  element.href = url;
  element.className = className;
  element.dataset.link = link.id;
  element.textContent = link.text;
  if (url.origin !== location.origin) {
    element.target = '_blank';
    element.rel = 'noopener noreferrer';
  }
  function capture() {
    window.posthog?.capture('links_click', {...props, link:link.id});
    if (link.id === 'crow') window.posthog?.capture('links_crow_click', props);
  }
  element.addEventListener('click', capture);
  element.addEventListener('auxclick', e => { if (e.button === 1) capture(); });
  return element;
}

function image(src, className = '', alt = '') {
  const img = document.createElement('img');
  Object.assign(img, {src, alt, className});
  return img;
}

function renderTrial(person) {
  const trial = person.trial;
  $('main').append(anchor(trial, 'lt-trial'));
  const details = document.createElement('details');
  details.className = 'lt-qr';
  const summary = document.createElement('summary');
  summary.textContent = trial.qr.summary;
  const card = document.createElement('div');
  card.className = 'lt-qr-card';
  const caption = document.createElement('span');
  caption.textContent = trial.qr.caption;
  card.append(image(person.main.img, 'lt-qr-bird'), image(trial.qr.src, 'lt-qr-code', trial.qr.caption), caption);
  details.append(summary, card);
  details.addEventListener('toggle', () => { if (details.open) window.posthog?.capture('links_qr_open', props); });
  $('main').append(details);
}

function renderLantern(lantern) {
  const note = anchor(lantern, 'lt-lantern');
  const glow = document.createElement('span');
  glow.className = 'term-lantern';
  glow.ariaHidden = 'true';
  note.prepend(glow);
  $('main').before(note);

  const crow = anchor({...lantern, id:'crow', text:lantern.crowText}, 'lt-crow');
  const bubble = document.createElement('span');
  bubble.className = 'lt-bubble';
  bubble.textContent = lantern.crowText;
  crow.replaceChildren(image('/img/link-crow.svg'), bubble);
  crow.tabIndex = -1;
  document.body.append(crow);
  let round = 0;
  function fly() {
    if (!document.hidden && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      crow.className = 'lt-crow in';
      crow.tabIndex = 0;
      setTimeout(() => { crow.tabIndex = -1; crow.className = 'lt-crow out'; }, 4600);
      setTimeout(() => { crow.className = 'lt-crow'; }, 6100);
    }
    round++;
    setTimeout(fly, 6100 + (10 + round * (round + 1) / 2) * 1000);
  }
  setTimeout(fly, 10000);
}

function follow(socials) {
  const nav = $('follow');
  if (!socials.length) return;
  nav.hidden = false;
  for (const link of socials) {
    const a = anchor(link, 'follow-button');
    a.setAttribute('aria-label', 'Follow on ' + link.text);
    a.title = link.text;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('aria-hidden', 'true');
    const use = document.createElementNS(svg.namespaceURI, 'use');
    use.setAttribute('href', '/img/follow.svg#' + link.id);
    svg.append(use);
    a.replaceChildren(svg);
    nav.append(a);
  }
}

async function render() {
  const person = (await loadPersonas())[id];
  document.body.dataset.persona = id;
  document.title = person.name + ' | corvus.gent';
  mountPortrait($('portrait'), person, 'Next portrait of ' + person.name);
  $('name').textContent = person.name;
  $('full').textContent = person.bio;
  $('line').textContent = person.tagline;

  const main = anchor(person.main, 'lt-main');
  main.prepend(image(person.main.img));
  $('main').append(main);
  if (person.trial) renderTrial(person);
  if (person.lantern) renderLantern(person.lantern);
  const socials = publicSocials(person);
  if (id !== 'gabe') follow(socials);
  for (const [where, links, cls] of [['links', person.links, 'lt-btn'], ['socials', id === 'gabe' ? socials : [], 'lt-small'], ['extra', person.extra, 'lt-small']]) {
    $(where).replaceChildren(...links.map(link => anchor(link, cls)));
  }
}

render().catch(() => { $('line').textContent = 'these links could not load. refresh to try again.'; });
