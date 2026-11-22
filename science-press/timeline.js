const byId = (id) => document.getElementById(id);
const archiveBase = new URL('.', document.currentScript.src);
const timeline = byId('timeline');
const filters = byId('filters');
const status = byId('status');
const reader = byId('reader');
const shortDate = new Intl.DateTimeFormat('nl-BE', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const fullDate = new Intl.DateTimeFormat('nl-BE', { dateStyle: 'long', timeZone: 'UTC' });
const monthName = new Intl.DateTimeFormat('nl-BE', { month: 'long', timeZone: 'UTC' });
const categories = ['Kijken en zien', 'Kijken en begrijpen', 'Overige'];
const batches = new Map();
let archive = [];

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

async function json(file) {
  const response = await fetch(new URL('data/' + file, archiveBase));
  if (!response.ok) throw new Error('Archiefbestand niet beschikbaar');
  return response.json();
}

function fetchMonth(file) {
  if (!batches.has(file)) {
    batches.set(file, json(file).catch((error) => {
      batches.delete(file);
      throw error;
    }));
  }
  return batches.get(file);
}

const parseDate = (value) => new Date(value + 'T00:00:00Z');
const countLabel = (count) => count + (count === 1 ? ' artikel' : ' artikels');

function photoFor(post, lazy) {
  const frame = element('div', 'photo');
  const img = element('img');
  img.alt = post.photo.alt;
  img.loading = lazy ? 'lazy' : 'eager';
  img.decoding = 'async';
  img.addEventListener('error', () => frame.remove(), { once: true });
  img.src = post.photo.url;
  frame.append(img);
  return frame;
}

function openPost(post, date) {
  byId('post-date').dateTime = post.date;
  byId('post-date').textContent = fullDate.format(date);
  byId('post-title').textContent = post.title;
  byId('post-preview').textContent = post.preview;
  byId('post-photo').replaceChildren(...(post.photo ? [photoFor(post, false)] : []));
  byId('post-link').href = post.url;
  reader.showModal();
}

function postRow(post) {
  const item = element('li', 'entry');
  const button = element('button');
  button.type = 'button';
  button.setAttribute('aria-haspopup', 'dialog');
  const date = parseDate(post.date);
  const copy = element('span', 'entry-copy');
  const time = element('time', '', shortDate.format(date));
  time.dateTime = post.date;
  copy.append(time, element('span', 'title', post.title));
  const icon = element('span', 'open', '+');
  icon.setAttribute('aria-hidden', 'true');
  if (post.photo) button.append(photoFor(post, true));
  button.append(copy, icon);
  button.addEventListener('click', () => openPost(post, date));
  item.append(button);
  return item;
}

function disclosure(label, count, className) {
  const details = element('details', className);
  const summary = element('summary');
  summary.append(element('span', 'disclosure-label', label), element('span', 'count', countLabel(count)));
  details.append(summary);
  return details;
}

function countFor(month, category) {
  return category ? (month.counts[category] || 0) : Object.values(month.counts).reduce((sum, count) => sum + count, 0);
}

function monthSection(month, category) {
  const label = monthName.format(parseDate(month.month + '-01'));
  const details = disclosure(label, countFor(month, category), 'month');
  const content = element('div', 'month-content');
  const message = element('p', 'month-status');
  message.setAttribute('role', 'status');
  content.append(message);
  details.append(content);

  let state = 'idle';
  async function load() {
    if (state !== 'idle') return;
    state = 'loading';
    message.textContent = 'Artikels laden…';
    try {
      const posts = await fetchMonth(month.file);
      const list = element('ol');
      list.append(...posts.filter((post) => !category || post.category === category).map(postRow));
      content.replaceChildren(list);
      state = 'loaded';
    } catch {
      state = 'idle';
      message.textContent = 'Laden mislukt.';
      const retry = element('button', 'retry', 'Opnieuw proberen');
      retry.type = 'button';
      retry.addEventListener('click', () => {
        retry.remove();
        load();
      });
      message.append(' ', retry);
    }
  }

  details.addEventListener('toggle', () => { if (details.open && !message.querySelector('button')) load(); });
  return details;
}

function selectCategory(category) {
  for (const button of filters.children) {
    button.setAttribute('aria-pressed', String(button.dataset.category === category));
  }
  timeline.replaceChildren();
  let total = 0;
  for (const group of archive) {
    const months = group.months.filter((month) => countFor(month, category));
    const count = months.reduce((sum, month) => sum + countFor(month, category), 0);
    if (!count) continue;
    total += count;
    const year = disclosure(group.year, count, 'year');
    const monthList = element('div', 'months');
    monthList.append(...months.map((month) => monthSection(month, category)));
    year.append(monthList);
    timeline.append(year);
  }
  byId('summary').textContent = countLabel(total);
}

async function start() {
  byId('retry').hidden = true;
  status.textContent = 'Archief laden…';
  try {
    archive = await json('index.json');
    for (const category of ['', ...categories]) {
      const button = element('button', '', category || 'Alle rubrieken');
      button.type = 'button';
      button.dataset.category = category;
      button.addEventListener('click', () => selectCategory(category));
      filters.append(button);
    }
    byId('years').hidden = false;
    selectCategory('');
    status.textContent = '';
  } catch {
    status.textContent = 'Het archief kon niet worden geladen.';
    byId('retry').hidden = false;
  }
}

byId('retry').addEventListener('click', start);
start();
