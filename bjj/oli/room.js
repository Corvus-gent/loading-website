const $ = id => document.getElementById(id);
const cuts = [...document.querySelectorAll('[data-cut]')];
const video = $('player');
const note = $('note');
const timestamp = $('timestamp');
const notice = $('notice');
const gateNote = $('gate-note');
const drafts = new Map();
const defaultDraft = () => ({ content: '', files: [], atTime: undefined });
let variant = 'en';
let draft = defaultDraft();
let versions = [];
let poll;
let requestId = 0;
let sending = false;
let historyKey;

class RequestError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function api(route, body) {
  const response = await fetch('/api/oli/' + route, body ? {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  } : {});
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new RequestError(data.error || 'The review room is unavailable.', response.status);
  return data;
}

function element(tag, content, className) {
  const node = document.createElement(tag);
  node.textContent = content;
  if (className) node.className = className;
  return node;
}

function showGate(message = '') {
  clearTimeout(poll);
  requestId++;
  $('gate').hidden = false;
  $('room').hidden = true;
  gateNote.textContent = message;
  video.removeAttribute('src');
  video.load();
  $('history').replaceChildren();
  historyKey = null;
}

function displayTime(seconds) {
  const n = Math.floor(seconds || 0);
  return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
}

function showTimestamp() {
  timestamp.textContent = '@ ' + displayTime(draft.atTime ?? video.currentTime);
  timestamp.setAttribute('aria-pressed', draft.atTime !== undefined);
  timestamp.disabled = sending || (video.hidden && draft.atTime === undefined);
}

function showVersion() {
  const item = versions.find(v => v.label === $('version').value);
  if (item && video.getAttribute('src') !== item.url) video.src = item.url;
  if (!item && video.hasAttribute('src')) {
    video.removeAttribute('src');
    video.load();
  }
  video.hidden = !item;
  $('placeholder').hidden = Boolean(item);
  $('version-details').hidden = !item;
  $('changelog').textContent = item?.changelog || '';
  showTimestamp();
}

function showHistory(chat, jobs) {
  const signature = JSON.stringify([chat, jobs]);
  if (signature === historyKey) return;
  const history = $('history');
  const bottom = history.scrollHeight - history.scrollTop - history.clientHeight < 40;
  historyKey = signature;
  const byId = new Map(jobs.map(job => [job.id, job]));
  const nodes = chat.map(row => {
    const bubble = element('article', '', 'message ' + row.role);
    bubble.setAttribute('aria-label', row.role === 'user' ? 'Oli' : 'Editor');
    if (row.atTime !== undefined) bubble.append(element('time', '@ ' + displayTime(row.atTime)));
    if (row.content) bubble.append(element('p', row.content));
    for (const src of row.images || []) {
      const image = element('img', '');
      image.src = src;
      image.alt = 'Attached reference photo';
      image.loading = 'lazy';
      bubble.append(image);
    }
    for (const url of row.driveLinks || []) {
      const link = element('a', 'Google Drive link ↗');
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      bubble.append(link);
    }
    if (row.proposal) {
      const job = byId.get(row.proposal.id);
      const status = job?.status || row.proposal.status;
      const text = { proposed: 'Proposed', queued: 'Queued', rendering: 'Rendering', live: `Live · ${job?.label}`, failed: 'Failed' }[status];
      const diff = element('div', '', 'diff');
      diff.append(element('strong', row.proposal.summary), element('small', text || 'Proposed'));
      if (job?.reason) diff.append(element('small', job.reason));
      bubble.append(diff);
    }
    return bubble;
  });
  history.replaceChildren(...(nodes.length ? nodes : [element('p', 'Leave a note for the editor.', 'empty')]));
  if (bottom) history.scrollTop = history.scrollHeight;
}

function present(data, newCut = false) {
  $('gate').hidden = true;
  $('room').hidden = false;
  gateNote.textContent = '';
  const previousLatest = versions[0]?.label;
  const selected = $('version').value;
  versions = data.versions;
  $('version').replaceChildren(...versions.map(v => {
    const option = element('option', v.label);
    option.value = v.label;
    return option;
  }));
  if (!newCut && previousLatest === versions[0]?.label && versions.some(v => v.label === selected)) {
    $('version').value = selected;
  }
  $('preview').classList.toggle('long', variant === 'long');
  $('placeholder').textContent = variant === 'long' ? 'In production — first cut coming' : 'Waiting for the first review cut';
  showVersion();
  showHistory(data.chat, data.jobs);
  clearTimeout(poll);
  if (data.jobs.some(job => ['queued', 'rendering'].includes(job.status))) {
    poll = setTimeout(() => load(true), 5000);
  }
}

async function load(polling = false) {
  if (sending) {
    poll = setTimeout(() => load(polling), 5000);
    return;
  }
  const id = ++requestId;
  try {
    const data = await api('state?variant=' + variant);
    if (id === requestId) present(data, !polling);
  } catch (error) {
    if (id !== requestId) return;
    if (error.status === 401) showGate();
    else if ($('room').hidden) showGate(error.message);
    else {
      notice.textContent = error.message;
      poll = setTimeout(() => load(polling), 5000);
    }
  }
}

function showFiles() {
  const attachments = $('attachments');
  attachments.hidden = !draft.files.length;
  attachments.replaceChildren(...draft.files.map((file, i) => {
    const button = element('button', file.name + ' ×');
    button.type = 'button';
    button.disabled = sending;
    button.setAttribute('aria-label', 'Remove ' + file.name);
    button.onclick = () => { draft.files.splice(i, 1); showFiles(); };
    return button;
  }));
}

function busy(value) {
  sending = value;
  for (const button of [...cuts, $('send'), $('photo'), $('mic')]) button.disabled = value;
  note.readOnly = value;
  showFiles();
  showTimestamp();
}

$('gate').onsubmit = async event => {
  event.preventDefault();
  const button = $('gate').querySelector('button');
  button.disabled = true;
  gateNote.textContent = 'Checking passcode…';
  try {
    await api('access', { passcode: $('passcode').value });
    $('passcode').value = '';
    await load();
  } catch (error) {
    gateNote.textContent = error.message;
  } finally {
    button.disabled = false;
  }
};

for (const tab of cuts) tab.onclick = () => {
  if (tab.dataset.cut === variant) return;
  clearTimeout(poll);
  draft.content = note.value;
  drafts.set(variant, draft);
  variant = tab.dataset.cut;
  draft = drafts.get(variant) || defaultDraft();
  note.value = draft.content;
  notice.textContent = '';
  for (const button of cuts) button.setAttribute('aria-pressed', button === tab);
  versions = [];
  $('version').replaceChildren();
  $('placeholder').textContent = 'Loading cut…';
  showVersion();
  showFiles();
  showHistory([], []);
  load();
};

$('version').onchange = showVersion;
video.ontimeupdate = showTimestamp;
timestamp.onclick = () => {
  draft.atTime = draft.atTime === undefined ? Math.floor(video.currentTime * 10) / 10 : undefined;
  showTimestamp();
};

$('photo').onclick = () => $('files').click();
$('files').onchange = event => {
  notice.textContent = '';
  for (const file of event.target.files) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 8 * 1024 ** 2) {
      notice.textContent = 'Choose JPEG, PNG or WebP photos up to 8 MB each.';
    } else if (draft.files.length >= 3) {
      notice.textContent = 'Attach up to three photos per message.';
    } else draft.files.push(file);
  }
  event.target.value = '';
  showFiles();
};

$('mic').onclick = () => {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) {
    notice.textContent = 'Speech-to-text is unavailable in this browser. You can type your note.';
    return;
  }
  const recognition = new Recognition();
  const startedDraft = draft;
  recognition.lang = 'en-AU';
  notice.textContent = 'Listening…';
  recognition.onresult = event => {
    if (draft !== startedDraft || sending) return;
    const words = event.results[0][0].transcript;
    note.value = [note.value.trim(), words].filter(Boolean).join(' ').slice(0, note.maxLength);
    notice.textContent = '';
  };
  recognition.onerror = () => { notice.textContent = 'Speech-to-text could not start. You can type your note.'; };
  recognition.onend = () => { if (notice.textContent === 'Listening…') notice.textContent = ''; };
  try { recognition.start(); } catch { recognition.onerror(); }
};

async function photoData(file) {
  const image = await createImageBitmap(file).catch(() => {
    throw new Error('This photo could not be opened.');
  });
  try {
    const scale = Math.min(1, 1600 / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
  } finally {
    image.close();
  }
}

const drivePattern = /https:\/\/drive\.google\.com\/[^\s<>"']+/gi;
$('composer').onsubmit = async event => {
  event.preventDefault();
  if (sending) return;
  const text = note.value.trim();
  const driveLinks = [...new Set([...text.matchAll(drivePattern)].map(match => match[0].replace(/[),.;!?]+$/, '')))];
  const content = text.replace(drivePattern, '').trim();
  if (!text && !draft.files.length) {
    notice.textContent = 'Add a note, photo or Drive link.';
    return;
  }
  if (driveLinks.length > 5) {
    notice.textContent = 'Attach up to five Drive links per message.';
    return;
  }
  ++requestId;
  clearTimeout(poll);
  busy(true);
  notice.textContent = draft.files.length ? 'Uploading photos…' : 'Editor is working…';
  try {
    const images = [];
    for (const file of draft.files) images.push((await api('upload', { photo: await photoData(file) })).image);
    notice.textContent = 'Editor is working…';
    const result = await api('chat', { variant, messages: [{ role: 'user', content }], images, driveLinks, atTime: draft.atTime });
    note.value = '';
    draft = defaultDraft();
    notice.textContent = '';
    present(result);
    $('history').scrollTop = $('history').scrollHeight;
  } catch (error) {
    if (error.status === 401) showGate(error.message);
    else {
      notice.textContent = error.message;
      poll = setTimeout(() => load(true), 5000);
    }
  } finally {
    busy(false);
  }
};

load();
