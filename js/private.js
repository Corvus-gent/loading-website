import { showStorageWarning } from './storage-warning.js';
const $ = (id) => document.getElementById(id);
const post = (body) =>
  fetch('/api/auth', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }).then(async (r) => ({ ok: r.ok, ...(await r.json().catch(() => ({}))) }));
let email = '';

const TITLES = {
  outbound: ['outbound links', ['page', 'host', 'link', 'clicks']],
  funnel: ['per platform & post', ['source', 'post', 'views', 'clicks', 'pidgy', 'trial', 'qr']],
  links: ['clicks per link', ['link', 'clicks']],
  pidgy_out: ['short links out (pidgy)', ['source', 'campaign', 'n']],
  calls: ['call & coffee clicks', ['page', 'n']],
  search: ['search activity', ['action', 'n']],
  terminal: ['terminal commands', ['command', 'n']],
  hours: ['hour of day (Brussels)', ['hour', 'views']],
  pages: ['pages', ['page', 'views', 'visitors']],
  feathers: ['feathers found', ['where', 'n']],
  referrers: ['referrers', ['domain', 'views']]
};

function table(title, head, data) {
  const sec = document.createElement('section');
  sec.className = 'st-sec';
  const h = document.createElement('h2');
  h.textContent = title;
  sec.appendChild(h);
  if (!data.length) {
    const p = document.createElement('p');
    p.className = 'sub';
    p.textContent = 'nothing yet.';
    sec.appendChild(p);
    return sec;
  }
  const t = document.createElement('table');
  t.className = 'st-table';
  t.innerHTML = '<tr>' + head.map((x) => `<th>${x}</th>`).join('') + '</tr>';
  data.forEach((row) => {
    const tr = document.createElement('tr');
    (Array.isArray(row) ? row : head.map((k) => row[k])).forEach((v) => {
      const td = document.createElement('td');
      td.textContent = v ?? '–';
      tr.appendChild(td);
    });
    t.appendChild(tr);
  });
  sec.appendChild(t);
  return sec;
}

function whenVisible(id, fn) {
  const root = $(id);
  const observer = new IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.isIntersecting)) {
      observer.disconnect();
      fn(root).catch(() => {
        root.textContent = 'section unavailable.';
      });
    }
  });
  observer.observe(root);
}
let opened = false;
function dash(snap) {
  if (!snap.viewer && snap.state !== 'login') {
    $('private-pending').hidden = false;
    $('private-pending').textContent = 'the dashboard could not check your session. reload to try again.';
    return;
  }
  $('private-pending').hidden = true;
  if (!snap.viewer) {
    $('login').hidden = false;
    return;
  }
  $('login').style.display = 'none';
  $('dash').style.display = 'block';
  showStorageWarning(snap.storage_plaintext_until);
  $('who').textContent = snap.viewer;
  const s = snap.data || {};
  const output = $('out');
  output.replaceChildren();
  for (const [k, [title, head]] of Object.entries(TITLES)) {
    const slot = document.createElement('section');
    slot.className = 'st-sec';
    slot.classList.add('private-slot');
    slot.textContent = title;
    output.append(slot);
    if (!Array.isArray(s[k]) && !s.tables?.includes(k)) {
      slot.textContent = title + ' · unavailable';
      continue;
    }
    const observer = new IntersectionObserver(async (entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      observer.disconnect();
      try {
        let rows = s[k];
        if (!Array.isArray(rows)) {
          const params = new URLSearchParams({ page: 'private', day: snap.day, part: k });
          const r = await fetch('/api/stats?' + params, {
            cache: 'no-store',
            credentials: 'same-origin'
          });
          if (!r.ok) throw Error();
          rows = (await r.json()).data?.[k];
        }
        if (!Array.isArray(rows)) throw Error();
        slot.replaceChildren(table(title, head, rows));
      } catch {
        slot.textContent = title + ' · unavailable';
      }
    });
    observer.observe(slot);
  }
  if (opened) return;
  opened = true;
  whenVisible('records', async (root) => {
    const r = await fetch('/api/private-stats?records=1', { cache: 'no-store' });
    if (!r.ok) throw Error();
    const records = await r.json();
    root.replaceChildren(
      table('goodreads requests', ['email', 'at'], records.access_requests || []),
      table('visitor guesses (exact = gift)', ['day', 'email', 'guess'], records.guesses || []),
      table('logins', ['email', 'at'], records.logins || [])
    );
  });
  whenVisible('x-log', async (root) => (await import('./private-x.js')).mountXLog(root));
  if (snap.viewer.toLowerCase() === 'gabriel@corvus.gent')
    whenVisible('sf-leads', async (root) =>
      (await import('./private-sf.js')).mountSFLeads(root, s.funnelSF)
    );
  else $('sf-leads').hidden = true;
}
$('f-mail').addEventListener('submit', async (e) => {
  e.preventDefault();
  email = e.target.email.value.trim();
  const r = await post({ action: 'request', email });
  $('msg').textContent = r.message || r.error || '';
  if (r.ok) {
    $('f-mail').style.display = 'none';
    $('f-code').style.display = 'flex';
    e.target.reset();
  }
});
$('f-code').addEventListener('submit', async (e) => {
  e.preventDefault();
  const r = await post({ action: 'verify', email, code: e.target.code.value.trim() });
  if (r.ok) location.reload();
  else $('msg').textContent = r.error || 'wrong code';
});
$('logout').addEventListener('click', async (e) => {
  e.preventDefault();
  await post({ action: 'logout' });
  location.reload();
});

window.statsPage.watch('private', window.statsPage.today, dash);
window.addEventListener('pageshow', (e) => {
  if (e.persisted) location.reload();
});
