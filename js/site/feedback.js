// corvus.gent/feedback: every page on one board, pins and text edits on top.
import {readPreference, savePreference} from '../storage.js';
const $ = s => document.querySelector(s);
const API = '/api/feedback';
const FLAGS = ['🇧🇪','🇳🇱','🇫🇷','🇩🇪','🇬🇧','🇪🇸','🇵🇹','🇮🇹','🇺🇸','🇨🇦','🇧🇷','🇦🇷','🇲🇽','🇨🇳','🇭🇰','🇯🇵','🇰🇷','🇮🇳','🇸🇬','🇦🇺','🇪🇪','🇺🇦','🇵🇱','🇸🇪','🇨🇭','🇦🇹','🇮🇪','🇹🇷','🇳🇬','🇿🇦','🇲🇦','🇦🇪','🌍','🏴‍☠️'];
let me = readPreference('corvus-feedback-me', null), server = {items: [], contributors: [], me: {}};
const validName = n => /^[\p{L}\p{N}][\p{L}\p{N} ._-]{1,23}$/u.test(n || '');

// ---------- identity ----------
const meBtn = $('#fb-me'), who = $('#fb-who'), whoForm = $('#fb-who-form');
$('#fb-flag').append(...FLAGS.map(f => Object.assign(document.createElement('option'), {value: f, textContent: f})));
const showMe = () => { meBtn.textContent = me ? `${me.flag} ${me.name}${server.me.signedIn ? ' ✓' : ''}` : 'who are you?'; };
function askWho() {
  return new Promise(done => {
    whoForm.name.value = me?.name || ''; whoForm.flag.value = me?.flag || '🇧🇪';
    who.showModal();
    who.addEventListener('close', () => done(me), {once: true});
  });
}
whoForm.addEventListener('submit', e => {
  const name = whoForm.name.value.trim();
  if (!validName(name)) { e.preventDefault(); whoForm.name.setCustomValidity('2–24 letters, numbers, spaces, dots, dashes or underscores.'); whoForm.name.reportValidity(); return; }
  whoForm.name.setCustomValidity('');
  me = {name, flag: whoForm.flag.value}; savePreference('corvus-feedback-me', me); showMe();
});
whoForm.name.addEventListener('input', () => whoForm.name.setCustomValidity(''));
meBtn.addEventListener('click', askWho);
$('#fb-signin').href = '/army/access/?next=' + encodeURIComponent('/feedback/');

// ---------- data ----------
async function load() {
  try { server = await (await fetch(API, {cache: 'no-store'})).json(); } catch { server = {items: [], contributors: [], me: {}}; }
  showMe(); drawCounts(); drawPeople();
}

// ---------- board ----------
const world = $('#fb-world'), canvas = $('#fb-canvas');
const FRAME_W = 1280, FRAME_H = 800, SCALE = .22, GAP = 70;
let pages = [], frames = [], view = {x: 40, y: 30, z: 1};
const applyView = () => { world.style.transform = `translate(${view.x}px,${view.y}px) scale(${view.z})`; };
async function loadPages() {
  let routes = [];
  try { routes = (await (await fetch('/site-directory.json')).json()).routes || []; } catch {}
  const top = new Map([['/', {path: '/', title: 'the realm', section: 'home'}], ['/public/realm-entry.html', {path: '/public/realm-entry.html', title: 'the entrance', section: 'home'}]]);
  for (const r of routes) {
    const p = r.path.replace(/\/$/, '') || '/';
    if (!p.startsWith('/') || p.includes('?') || top.has(p)) continue;
    const depth = p.split('/').filter(Boolean).length;
    if (depth > 2 || (p.startsWith('/compound/') && depth > 1) || /^\/(admin|stats)/.test(p)) continue;
    top.set(p, {path: p, title: r.title, section: r.section});
  }
  const order = ['home', 'legion', 'quests', 'daily', 'gabe', 'live'];
  pages = [...top.values()].sort((a, b) => (order.indexOf(a.section) + 99) % 99 - (order.indexOf(b.section) + 99) % 99 || a.path.localeCompare(b.path)).slice(0, 90);
}
function drawBoard() {
  const cols = Math.max(3, Math.round(Math.sqrt(pages.length * 1.6)));
  const w = FRAME_W * SCALE, h = FRAME_H * SCALE;
  frames = pages.map((p, i) => {
    const el = document.createElement('button');
    el.type = 'button'; el.className = 'fb-frame'; el.dataset.path = p.path;
    el.style.left = (i % cols) * (w + GAP) + 'px'; el.style.top = Math.floor(i / cols) * (h + GAP + 24) + 'px';
    el.style.width = w + 'px'; el.style.height = h + 24 + 'px';
    el.setAttribute('aria-label', `Open ${p.title} (${p.path}) for review`);
    const label = document.createElement('span'); label.className = 'fb-frame-label'; label.textContent = `${p.title} · ${p.path}`;
    const shot = document.createElement('span'); shot.className = 'fb-frame-shot';
    const count = document.createElement('span'); count.className = 'fb-count'; count.hidden = true;
    el.append(label, shot, count);
    el.addEventListener('click', () => { if (!dragged) openReview(p.path); });
    world.append(el);
    return el;
  });
  world.style.width = cols * (w + GAP) + 'px'; world.style.height = Math.ceil(pages.length / cols) * (h + GAP + 24) + 120 + 'px';
  const io = new IntersectionObserver(entries => entries.forEach(e => {
    if (!e.isIntersecting) return;
    const shot = e.target.querySelector('.fb-frame-shot'); if (shot.firstChild) return;
    const f = document.createElement('iframe');
    f.src = e.target.dataset.path; f.loading = 'lazy'; f.tabIndex = -1; f.setAttribute('aria-hidden', 'true'); f.title = '';
    f.style.width = FRAME_W + 'px'; f.style.height = FRAME_H + 'px'; f.style.transform = `scale(${SCALE})`;
    shot.append(f); io.unobserve(e.target);
  }), {root: canvas, rootMargin: '200px'});
  frames.forEach(f => io.observe(f));
  fit();
}
function drawCounts() {
  const by = {};
  for (const it of server.items || []) by[it.page] = (by[it.page] || 0) + 1;
  for (const f of frames) { const c = f.querySelector('.fb-count'), n = by[f.dataset.path] || 0; c.hidden = !n; c.textContent = n ? `💬 ${n}` : ''; }
}
function fit() {
  const ww = parseFloat(world.style.width) || 1000;
  view.z = Math.min(1, Math.max(.3, (canvas.clientWidth - 40) / ww));
  view.x = Math.max(20, (canvas.clientWidth - ww * view.z) / 2); view.y = 20; applyView();
}
let dragged = false, drag = null;
canvas.addEventListener('pointerdown', e => { drag = {x: e.clientX, y: e.clientY, vx: view.x, vy: view.y}; dragged = false; });
addEventListener('pointermove', e => {
  if (!drag) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  if (Math.abs(dx) + Math.abs(dy) > 5) { dragged = true; canvas.classList.add('dragging'); }
  if (dragged) { view.x = drag.vx + dx; view.y = drag.vy + dy; applyView(); }
});
addEventListener('pointerup', () => { drag = null; canvas.classList.remove('dragging'); setTimeout(() => { dragged = false; }, 0); });
const zoomAt = (factor, cx, cy) => {
  const r = canvas.getBoundingClientRect(), px = cx - r.left, py = cy - r.top, z = Math.min(2.5, Math.max(.2, view.z * factor));
  view.x = px - (px - view.x) * (z / view.z); view.y = py - (py - view.y) * (z / view.z); view.z = z; applyView();
};
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  if (e.ctrlKey || e.metaKey) zoomAt(Math.exp(-e.deltaY * .01), e.clientX, e.clientY);
  else { view.x -= e.deltaX; view.y -= e.deltaY; applyView(); }
}, {passive: false});
document.querySelectorAll('[data-zoom]').forEach(b => b.addEventListener('click', () => {
  const d = +b.dataset.zoom, r = canvas.getBoundingClientRect();
  d ? zoomAt(d > 0 ? 1.25 : .8, r.left + r.width / 2, r.top + r.height / 2) : fit();
}));
$('#fb-filter').addEventListener('input', e => {
  const q = e.target.value.trim().toLowerCase();
  frames.forEach(f => f.classList.toggle('dim', Boolean(q) && !f.textContent.toLowerCase().includes(q)));
  const hit = frames.find(f => q && !f.classList.contains('dim'));
  if (hit) { view.x = canvas.clientWidth / 2 - (parseFloat(hit.style.left) + 140) * view.z; view.y = 120 - parseFloat(hit.style.top) * view.z; applyView(); }
});

// ---------- views ----------
document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('[data-view]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  $('#fb-board').hidden = b.dataset.view !== 'board'; $('#fb-people').hidden = b.dataset.view !== 'people';
}));
function weeks(days) {
  const cells = [], today = new Date(); today.setUTCHours(0, 0, 0, 0);
  for (let i = 7 * 18 - 1; i >= 0; i--) {
    const d = new Date(today - i * 86400000).toISOString().slice(0, 10), n = days[d] || 0;
    const c = document.createElement('i'); c.className = 'lv' + Math.min(4, n); c.title = `${d}: ${n}`; cells.push(c);
  }
  const g = document.createElement('span'); g.className = 'fb-graph'; g.setAttribute('aria-hidden', 'true'); g.append(...cells); return g;
}
function drawPeople() {
  const list = $('#fb-people-list'); list.replaceChildren();
  const people = server.contributors || [];
  if (!people.length) { const li = document.createElement('li'); li.className = 'fb-empty'; li.textContent = 'Nobody yet. Your name could be first.'; list.append(li); }
  for (const p of people) {
    const li = document.createElement('li'); li.className = 'fb-person' + (p.verified ? ' verified' : '');
    const av = document.createElement('span'); av.className = 'fb-avatar'; av.textContent = p.flag;
    const name = document.createElement('strong'); name.textContent = p.name;
    const meta = document.createElement('span'); meta.className = 'fb-meta'; meta.textContent = `${p.count} contribution${p.count === 1 ? '' : 's'}${p.verified ? ' · verified contributor' : ''}`;
    const txt = document.createElement('span'); txt.className = 'fb-person-text'; txt.append(name, meta);
    li.append(av, txt, weeks(p.days || {})); list.append(li);
  }
  const feed = $('#fb-feed'); feed.replaceChildren(...(server.items || []).slice(0, 40).map(itemNode));
}
function itemNode(it) {
  const li = document.createElement('li'); li.className = 'fb-item';
  const head = document.createElement('p'); head.className = 'fb-item-head';
  head.textContent = `${it.flag} ${it.name}${it.verified ? ' ✓' : ''} · ${new Date(it.at).toLocaleDateString()} · `;
  const a = document.createElement('a'); a.href = '#'; a.textContent = it.page; a.addEventListener('click', e => { e.preventDefault(); openReview(it.page); });
  head.append(a); li.append(head);
  if (it.quote) { const q = document.createElement('p'); q.className = 'fb-item-quote'; q.textContent = '“' + it.quote + '”'; li.append(q); }
  if (it.suggestion) { const s = document.createElement('p'); s.className = 'fb-item-suggest'; s.textContent = '→ ' + it.suggestion; li.append(s); }
  if (it.note) { const n = document.createElement('p'); n.textContent = it.note; li.append(n); }
  if (server.me?.owner) { const h = document.createElement('button'); h.type = 'button'; h.className = 'fb-hide'; h.textContent = 'hide'; h.onclick = async () => { await fetch(API, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({action: 'hide', id: it.id})}); li.remove(); }; li.append(h); }
  return li;
}

// ---------- review ----------
const review = $('#fb-review'), frame = $('#fb-frame'), modeBtn = $('#fb-mode');
let commenting = true, current = '/', pageItems = [];
function setMode(on) { commenting = on; modeBtn.setAttribute('aria-pressed', String(on)); modeBtn.textContent = on ? '💬 comment mode · on' : '🧭 browse mode'; review.classList.toggle('browsing', !on); }
modeBtn.addEventListener('click', () => setMode(!commenting));
addEventListener('keydown', e => { if (!review.hidden && e.key.toLowerCase() === 'c' && !e.target.closest('input,textarea,select')) setMode(!commenting); });
function openReview(path) {
  current = path; review.hidden = false; document.body.classList.add('reviewing');
  frame.src = path; $('#fb-path').textContent = path; setMode(true);
  history.replaceState(null, '', '#' + path);
}
$('#fb-back').addEventListener('click', () => { review.hidden = true; document.body.classList.remove('reviewing'); frame.src = 'about:blank'; history.replaceState(null, '', location.pathname); load(); });
async function pageFeedback() {
  try { pageItems = (await (await fetch(`${API}?page=${encodeURIComponent(current)}`)).json()).items || []; } catch { pageItems = []; }
  const list = $('#fb-side-list'); list.replaceChildren(...pageItems.map(itemNode)); $('#fb-empty').hidden = pageItems.length > 0;
  pins();
}
function cssPath(el) {
  const parts = [];
  for (let n = el; n && n.nodeType === 1 && parts.length < 6; n = n.parentElement) {
    if (n.id) { parts.unshift('#' + CSS.escape(n.id)); break; }
    const i = n.parentElement ? [...n.parentElement.children].indexOf(n) + 1 : 1;
    parts.unshift(n.localName + `:nth-child(${i})`);
  }
  return parts.join('>');
}
function pins() {
  const doc = frame.contentDocument; if (!doc?.body) return;
  doc.querySelectorAll('.fb-pin,#fb-pin-style').forEach(n => n.remove());
  const st = doc.createElement('style'); st.id = 'fb-pin-style';
  st.textContent = '.fb-pin{position:absolute;z-index:2147483000;width:26px;height:26px;margin:-13px 0 0 -13px;border-radius:50% 50% 50% 4px;background:#ffd76a;color:#140d1f;font:700 12px/26px system-ui;text-align:center;box-shadow:0 0 0 3px #140d1f,0 0 18px #ffd76a;cursor:pointer}.fb-hover{outline:2px dashed #b9a3ff!important;outline-offset:3px!important;cursor:copy!important}';
  doc.head.append(st);
  const H = Math.max(doc.documentElement.scrollHeight, doc.body.scrollHeight), W = doc.documentElement.scrollWidth;
  pageItems.forEach((it, i) => {
    const p = doc.createElement('span'); p.className = 'fb-pin'; p.textContent = String(i + 1); p.title = `${it.name}: ${it.note || it.suggestion}`;
    p.style.left = it.x / 100 * W + 'px'; p.style.top = it.y / 100 * H + 'px'; doc.body.append(p);
  });
}
frame.addEventListener('load', () => {
  const doc = frame.contentDocument; if (!doc) return;
  let path = '/'; try { path = frame.contentWindow.location.pathname.replace(/\/$/, '') || '/'; } catch {}
  current = path; $('#fb-path').textContent = path; history.replaceState(null, '', '#' + path);
  let hovered = null;
  doc.addEventListener('mouseover', e => { if (!commenting) return; hovered?.classList.remove('fb-hover'); hovered = e.target; hovered.classList.add('fb-hover'); }, true);
  doc.addEventListener('click', e => {
    if (!commenting || e.target.closest('.fb-pin')) return;
    e.preventDefault(); e.stopPropagation();
    const el = e.target, H = Math.max(doc.documentElement.scrollHeight, doc.body.scrollHeight), W = doc.documentElement.scrollWidth;
    const x = (e.pageX / W) * 100, y = (e.pageY / H) * 100;
    hovered?.classList.remove('fb-hover');
    compose({x, y, selector: cssPath(el), quote: (el.innerText || '').trim().slice(0, 240)});
  }, true);
  pageFeedback();
});

// ---------- compose ----------
const dlg = $('#fb-compose'), form = $('#fb-compose-form');
let draft = null;
async function compose(target) {
  if (!me) { await askWho(); if (!me) return; }
  draft = target;
  const hasText = target.quote && target.quote.length > 1;
  $('#fb-quote').hidden = !hasText; $('#fb-quote').textContent = hasText ? '“' + target.quote + '”' : '';
  $('#fb-suggest-wrap').hidden = !hasText;
  form.note.value = ''; form.suggestion.value = hasText ? target.quote : '';
  $('#fb-as').textContent = `as ${me.flag} ${me.name}${server.me?.signedIn ? ' · verified contributor' : ''}`;
  form.querySelector('.fb-status').textContent = '';
  dlg.showModal(); form.note.focus();
}
$('#fb-cancel').addEventListener('click', () => dlg.close());
form.addEventListener('submit', async e => {
  e.preventDefault();
  const note = form.note.value.trim(), suggestion = form.suggestion.value.trim() === (draft.quote || '').trim() ? '' : form.suggestion.value.trim();
  const status = form.querySelector('.fb-status');
  if (!note && !suggestion) { status.textContent = 'Write a note or change the text first.'; return; }
  status.textContent = 'dropping…';
  try {
    const r = await fetch(API, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({...draft, note, suggestion, page: current, name: me.name, flag: me.flag})});
    const d = await r.json(); if (!r.ok) throw Error(d.error || 'Could not save.');
    dlg.close(); pageFeedback(); sparkle();
  } catch (err) { status.textContent = err.message; }
});
function sparkle() { const t = document.createElement('p'); t.className = 'fb-toast'; t.textContent = 'Thank you. You are on the board. ✨'; document.body.append(t); setTimeout(() => t.remove(), 2600); }

// ---------- start ----------
await loadPages(); drawBoard(); load();
if (location.hash.length > 1) openReview(decodeURIComponent(location.hash.slice(1)));
