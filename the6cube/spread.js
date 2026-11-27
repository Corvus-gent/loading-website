// The spread: every share is a branch, every open is a spore. Zero money, zero personal data.
//   link:  /the6cube/?key=…&r=<rank>-<id>&utm_source=<channel>&utm_medium=share&utm_campaign=realm
//   rank:  how many connections from the root (Gabe). Gabe's own links are r=gabe (or 0-xxxx seeds) → visitors are rank 1, the OGs.
//   log:   anonymous events to a public ntfy topic, mirrored to git by a GitHub Action → /the6cube/spread/ draws the mycelium.
//   kept on this device only: your rank, your branch id, who sent you (random ids, nothing else).
import { currentLang } from './polyglot.js';

export const TOPIC = 'corvus-spread-1729';
const ORIGIN = 'https://corvus.gent';
const CODE = 'gabe-maxxing';
const K = { me: 'cube_me', rank: 'cube_rank', from: 'cube_from' };
const ls = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };
const rid = () => { const a = 'abcdefghjkmnpqrstuvwxyz23456789'; let s = ''; const b = crypto.getRandomValues(new Uint8Array(4)); for (const x of b) s += a[x % a.length]; return s; };
export const rankOf = r => !r ? null : (r === 'gabe' ? 0 : (/^(\d{1,3})-[a-z0-9]{3,8}$/.test(r) ? +r.split('-')[0] : null));
const CH = ['wa', 'tg', 'li', 'sms', 'copy', 'more', 'qr'];

export function send(ev) {
  const body = JSON.stringify({ v: 1, ts: Date.now(), ...ev });
  try { fetch(`https://ntfy.sh/${TOPIC}`, { method: 'POST', body, mode: 'no-cors', keepalive: true, headers: { 'Content-Type': 'text/plain' } }).catch(() => {}); } catch {}
}

// ---- arrival: read the link once, remember the first path that reached you, tidy the address bar ----
const q = new URLSearchParams(location.search);
const r = q.get('r'), src = (q.get('utm_source') || '').slice(0, 8);
const pr = rankOf(r);
export const arrival = pr === null ? null : { from: r, rank: pr + 1, gabe: pr === 0, channel: CH.includes(src) ? src : 'link' };
if (arrival) {
  if (!ls.get(K.rank) || +ls.get(K.rank) > arrival.rank) { ls.set(K.rank, String(arrival.rank)); ls.set(K.from, r); } // keep your shortest path to the root
  if (sessionStorage.getItem('cube_seen') !== r) { sessionStorage.setItem('cube_seen', r); send({ t: 'v', p: r, c: arrival.channel, l: currentLang(), rk: arrival.rank }); }
  ['r', 'utm_source', 'utm_medium', 'utm_campaign'].forEach(k => q.delete(k));
  history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q : '') + location.hash);
}
const VISITS = (() => { const n = +(ls.get('cube_visits') || 0) + 1; ls.set('cube_visits', String(n)); return n; })();
export const myRank = () => ls.get(K.me) === 'gabe' ? 0 : (+ls.get(K.rank) || null);

// your branch: rank-id. Gabe's device can be made the root from /the6cube/spread/ (ls cube_me = 'gabe').
export function myId() {
  let me = ls.get(K.me); if (me) return me;
  const rk = myRank() ?? 1; me = `${rk}-${rid()}`; ls.set(K.me, me); return me;
}
export const linkFor = (id, ch) => `${ORIGIN}/the6cube/?key=${CODE}&r=${id}&utm_source=${ch}&utm_medium=share&utm_campaign=realm`;
export function shared(ch) { const id = myId(); send({ t: 's', id, p: ls.get(K.from) || (id === 'gabe' || id.startsWith('0-') ? '' : 'gabe'), c: ch }); return linkFor(id, ch); }
export const seed = () => `0-${rid()}`;

// how many people opened through YOUR link (real count from the public log; launch line applies)
const SINCE = 1795706200;
export async function myOpens() {
  const me = ls.get(K.me); if (!me) return 0;
  try { const t = await (await fetch(`https://ntfy.sh/${TOPIC}/json?poll=1&since=all`)).text(); const seen = new Set();
    t.split('\n').filter(Boolean).forEach(l => { try { const m = JSON.parse(l); if (m.event !== 'message' || m.time < SINCE) return; const e = JSON.parse(m.message); if (e.t === 'v' && e.p === me) seen.add(m.id); } catch {} });
    let k = seen.size; try { const a = await fetch('https://cdn.jsdelivr.net/gh/gabe-maxxing/gabe-maxxing@main/spread/events.ndjson'); if (a.ok) (await a.text()).split('\n').forEach(l => { try { const e = JSON.parse(l); if (e.t === 'v' && e.p === me && !seen.has(e.k)) k++; } catch {} }); } catch {}
    return k; } catch { return 0; }
}
// second visit: one quiet line for the guide cube
export async function backLine() {
  if (arrival) return null; const n = VISITS;
  const rk = myRank(); if (n < 2 || rk === null) return null;
  const k = await myOpens(); return w('back').replace('{r}', rk === 0 ? 'root' : rk === 1 ? 'OG' : `rank ${rk}`).replace('{k}', k);
}

// ---- words, in the seven languages of the rail ----
export const W = {
  en: { back:'welcome back, {r}. {k} opened through you.',seats:'two seats are waiting for your people',seatn:'{k} opened through you', gabe: 'Hello. I see Gabe sent you here. Welcome.', friend: 'I saw somebody send you here. Interesting. Come, follow me…', og: 'rank 1 · OG · straight from the root', rn: 'rank {n} · it took {n} connections to reach you', follow: 'follow me', pass: 'pass it on', sub: 'your link carries your rank. whoever opens it lands one ring further out.', copy: 'copy link', copied: 'copied ✓', more: 'more…', you: 'you', root: 'gabe', map: 'see the mycelium ↗', text: 'join the new realm 🏛️ corvus × the 6 cube' },
  nl: { back:'welkom terug, {r}. {k} openden via jou.',seats:'twee plaatsen wachten op jouw mensen',seatn:'{k} openden via jou', gabe: 'Hallo. Ik zie dat Gabe je hierheen stuurde. Welkom.', friend: 'Ik zag dat iemand je hierheen stuurde. Interessant. Kom, volg mij…', og: 'rang 1 · OG · rechtstreeks van de wortel', rn: 'rang {n} · er waren {n} connecties nodig om bij jou te komen', follow: 'volg mij', pass: 'geef het door', sub: 'jouw link draagt jouw rang. wie hem opent, landt één ring verder.', copy: 'kopieer link', copied: 'gekopieerd ✓', more: 'meer…', you: 'jij', root: 'gabe', map: 'bekijk het mycelium ↗', text: 'join the new realm 🏛️ corvus × the 6 cube' },
  es: { back:'bienvenido de nuevo, {r}. {k} abrieron gracias a ti.',seats:'dos sitios esperan a tu gente',seatn:'{k} abrieron gracias a ti', gabe: 'Hola. Veo que Gabe te ha enviado aquí. Bienvenido.', friend: 'Vi que alguien te envió aquí. Interesante. Ven, sígueme…', og: 'rango 1 · OG · directo desde la raíz', rn: 'rango {n} · hicieron falta {n} conexiones para llegar a ti', follow: 'sígueme', pass: 'pásalo', sub: 'tu enlace lleva tu rango. quien lo abra cae un anillo más afuera.', copy: 'copiar enlace', copied: 'copiado ✓', more: 'más…', you: 'tú', root: 'gabe', map: 'ver el micelio ↗', text: 'join the new realm 🏛️ corvus × the 6 cube' },
  fr: { back:'bon retour, {r}. {k} ont ouvert grâce à toi.',seats:'deux places attendent tes gens',seatn:'{k} ont ouvert grâce à toi', gabe: 'Bonjour. Je vois que Gabe t’a envoyé ici. Bienvenue.', friend: 'J’ai vu que quelqu’un t’a envoyé ici. Intéressant. Viens, suis-moi…', og: 'rang 1 · OG · tout droit de la racine', rn: 'rang {n} · il a fallu {n} connexions pour arriver jusqu’à toi', follow: 'suis-moi', pass: 'fais passer', sub: 'ton lien porte ton rang. qui l’ouvre atterrit un anneau plus loin.', copy: 'copier le lien', copied: 'copié ✓', more: 'plus…', you: 'toi', root: 'gabe', map: 'voir le mycélium ↗', text: 'join the new realm 🏛️ corvus × the 6 cube' },
  pt: { back:'bem-vindo de volta, {r}. {k} abriram por ti.',seats:'dois lugares esperam pela tua gente',seatn:'{k} abriram por ti', gabe: 'Olá. Vejo que o Gabe te mandou para aqui. Bem-vindo.', friend: 'Vi que alguém te mandou para aqui. Interessante. Vem, segue-me…', og: 'nível 1 · OG · direto da raiz', rn: 'nível {n} · foram precisas {n} ligações para chegar a ti', follow: 'segue-me', pass: 'passa a outros', sub: 'o teu link leva o teu nível. quem o abrir cai um anel mais longe.', copy: 'copiar link', copied: 'copiado ✓', more: 'mais…', you: 'tu', root: 'gabe', map: 'ver o micélio ↗', text: 'join the new realm 🏛️ corvus × the 6 cube' },
  de: { back:'willkommen zurück, {r}. {k} haben über dich geöffnet.',seats:'zwei Plätze warten auf deine Leute',seatn:'{k} haben über dich geöffnet', gabe: 'Hallo. Ich sehe, Gabe hat dich hergeschickt. Willkommen.', friend: 'Ich habe gesehen, dass dich jemand hergeschickt hat. Interessant. Komm, folge mir…', og: 'Rang 1 · OG · direkt von der Wurzel', rn: 'Rang {n} · es brauchte {n} Verbindungen, um dich zu erreichen', follow: 'folge mir', pass: 'weitergeben', sub: 'dein Link trägt deinen Rang. wer ihn öffnet, landet einen Ring weiter draußen.', copy: 'Link kopieren', copied: 'kopiert ✓', more: 'mehr…', you: 'du', root: 'gabe', map: 'das Myzel ansehen ↗', text: 'join the new realm 🏛️ corvus × the 6 cube' },
  zh: { back:'欢迎回来，{r}。{k} 人通过你打开。',seats:'两个位子在等你的人',seatn:'{k} 人通过你打开', gabe: '你好。我看到是 Gabe 把你带来的。欢迎。', friend: '我看到有人把你带到了这里。有意思。来，跟我走……', og: '第 1 环 · 元老 · 直接来自根', rn: '第 {n} 环 · 经过 {n} 次连接才找到你', follow: '跟我走', pass: '传下去', sub: '你的链接带着你的环数。打开它的人会落在更外一环。', copy: '复制链接', copied: '已复制 ✓', more: '更多……', you: '你', root: 'gabe', map: '看菌丝网络 ↗', text: 'join the new realm 🏛️ corvus × the 6 cube' },
};
const w = k => (W[currentLang()] || W.en)[k] || W.en[k];

// ---- UI: the arrival card and the pass-it-on sheet (portal only) ----
const CSS = `
.sp-veil{position:fixed;inset:0;z-index:80;display:grid;place-items:center;background:rgba(6,5,9,.72);backdrop-filter:blur(6px);opacity:0;transition:opacity .6s}
.sp-veil.on{opacity:1}
.sp-card{width:min(420px,calc(100% - 32px));background:linear-gradient(160deg,rgba(26,18,42,.96),rgba(10,8,16,.97));border:1px solid #2c1f45;border-radius:18px;padding:26px 24px 22px;text-align:center;box-shadow:0 0 80px rgba(122,92,176,.35);color:#efe7d2;transform:translateY(12px) scale(.98);transition:transform .7s cubic-bezier(.2,.8,.2,1)}
.sp-veil.on .sp-card{transform:none}
.sp-card canvas{width:100%;height:150px;display:block;margin:0 0 14px}
.sp-rank{font:11px ui-monospace,Menlo,monospace;letter-spacing:.22em;text-transform:uppercase;color:#ffd76a;margin:0 0 12px}
.sp-hi{font:italic 400 clamp(21px,3vw,26px)/1.3 'Bodoni Moda',Georgia,serif;margin:0 0 20px;text-wrap:balance}
.sp-btn{all:unset;cursor:pointer;display:inline-block;background:#ffd76a;color:#1a1206;border-radius:999px;padding:11px 22px;font:600 14px system-ui,sans-serif}
.sp-btn:focus-visible{outline:2px solid #efe7d2;outline-offset:3px}
.sp-sheet .row{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:0 0 10px}
.sp-sheet .wa{grid-column:1/-1;background:#3fae7a;color:#04140c;border-radius:12px;padding:14px;font:600 15px system-ui;text-decoration:none;display:block}
.sp-sheet .o{border:1px solid #2c1f45;border-radius:12px;padding:11px 6px;font:12.5px system-ui;color:#efe7d2;text-decoration:none;background:rgba(122,92,176,.12);cursor:pointer}
.sp-sheet .o:hover,.sp-sheet .wa:hover{filter:brightness(1.12)}
.sp-sub{font:12px/1.5 ui-monospace,Menlo,monospace;color:rgba(239,231,210,.55);margin:6px 0 14px}
.sp-x{all:unset;position:absolute;top:10px;right:14px;cursor:pointer;color:rgba(239,231,210,.5);font:18px system-ui}
.sp-seats{display:flex;align-items:center;justify-content:center;gap:8px;margin:0 0 14px;font:11.5px ui-monospace,Menlo,monospace;color:#b4a0d6}.sp-seats i{width:12px;height:12px;border-radius:50%;border:1px dashed #b4a0d6}.sp-seats i.on{border:0;background:#ffd76a;box-shadow:0 0 10px #ffd76a}
.sp-badge{margin-left:8px;color:#b4a0d6;font:inherit}
@media(prefers-reduced-motion:reduce){.sp-veil,.sp-card{transition:none}}`;
function css() { if (document.getElementById('sp-css')) return; const s = document.createElement('style'); s.id = 'sp-css'; s.textContent = CSS; document.head.append(s); }
function veil(inner) {
  css(); const v = document.createElement('div'); v.className = 'sp-veil'; v.setAttribute('role', 'dialog'); v.setAttribute('aria-modal', 'true');
  v.innerHTML = `<div class="sp-card" style="position:relative">${inner}</div>`; document.body.append(v);
  void v.offsetWidth; setTimeout(() => v.classList.add('on'), 20);
  const close = () => { v.classList.remove('on'); setTimeout(() => v.remove(), 600); removeEventListener('keydown', esc); };
  const esc = e => e.key === 'Escape' && close(); addEventListener('keydown', esc);
  v.addEventListener('click', e => e.target === v && close()); return { v, close };
}

// the chain from the root to you, drawn as a hypha: gold root, violet knots, you glowing at the end
function chain(cv, n) {
  const dpr = Math.min(devicePixelRatio || 1, 2), W = cv.clientWidth, H = cv.clientHeight; cv.width = W * dpr; cv.height = H * dpr;
  const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
  const shown = Math.min(n, 9), pts = []; for (let i = 0; i <= shown; i++) { const x = 24 + (W - 48) * i / shown; pts.push([x, H / 2 + Math.sin(i * 1.7) * 18 * (i && i < shown ? 1 : 0)]); }
  const t0 = performance.now(), reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  (function f(t) {
    const k = reduce ? 1 : Math.min(1, (t - t0) / 1600); c.clearRect(0, 0, W, H);
    for (let s = 0; s < 3; s++) { c.beginPath(); c.strokeStyle = `rgba(180,160,214,${.18 + s * .12})`; c.lineWidth = .6 + s * .4;
      for (let i = 0; i < pts.length - 1; i++) { const [x0, y0] = pts[i], [x1, y1] = pts[i + 1]; const seg = Math.max(0, Math.min(1, k * shown - i)); if (!seg) break;
        const mx = (x0 + x1) / 2, my = (y0 + y1) / 2 + (s - 1) * 7 + Math.sin(t / 900 + i + s) * 3; if (!i) c.moveTo(x0, y0);
        const ex = x0 + (x1 - x0) * seg, ey = y0 + (y1 - y0) * seg; c.quadraticCurveTo(x0 + (mx - x0) * seg * 2 > ex ? ex : mx, my, ex, ey); } c.stroke(); }
    pts.forEach(([x, y], i) => { if (i > k * shown + .01) return; const root = !i, you = i === shown;
      const g = c.createRadialGradient(x, y, 0, x, y, you ? 22 : 12); g.addColorStop(0, root ? 'rgba(255,215,106,.9)' : you ? 'rgba(239,231,210,.95)' : 'rgba(180,160,214,.8)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.beginPath(); c.arc(x, y, you ? 22 + Math.sin(t / 300) * 3 : 12, 0, 7); c.fill();
      c.fillStyle = root ? '#ffd76a' : you ? '#efe7d2' : '#b4a0d6'; c.beginPath(); c.arc(x, y, root || you ? 4.5 : 3, 0, 7); c.fill(); });
    c.font = '10px ui-monospace,Menlo,monospace'; c.fillStyle = 'rgba(255,215,106,.8)'; c.textAlign = 'center'; c.fillText(w('root'), pts[0][0], pts[0][1] + 26);
    if (k === 1) { c.fillStyle = 'rgba(239,231,210,.85)'; c.fillText(w('you'), pts[shown][0], pts[shown][1] + 32); if (n > shown) { c.fillStyle = 'rgba(180,160,214,.7)'; c.fillText(`… +${n - shown}`, (pts[shown - 1][0] + pts[shown][0]) / 2, H / 2 - 26); } }
    if (!reduce && cv.isConnected) requestAnimationFrame(f);
  })(t0);
}

export function greet(onFollow) {
  if (!arrival || sessionStorage.getItem('cube_greeted') === arrival.from) return false;
  sessionStorage.setItem('cube_greeted', arrival.from);
  const n = arrival.rank, hi = arrival.gabe ? w('gabe') : w('friend'), rank = n === 1 ? w('og') : w('rn').replaceAll('{n}', n);
  const { v, close } = veil(`<canvas aria-hidden="true"></canvas><p class="sp-rank">${rank}</p><p class="sp-hi">${hi}</p><button class="sp-btn">${w('follow')} →</button><p style="margin:12px 0 0"><button class="sp-pass" style="all:unset;cursor:pointer;color:#b4a0d6;font:12px ui-monospace,Menlo,monospace">${w('pass')} ↗</button></p>`);
  setTimeout(() => chain(v.querySelector('canvas'), n), 120);
  const b = v.querySelector('.sp-btn'); b.focus(); b.addEventListener('click', () => { close(); onFollow && onFollow(hi); });
  v.querySelector('.sp-pass').addEventListener('click', () => { close(); onFollow && onFollow(hi); setTimeout(sheet, 650); });
  return hi;
}

export function sheet() {
  myId(); const rk = myRank() ?? 1, msg = w('text');
  const { v, close } = veil(`<button class="sp-x" aria-label="close">×</button><p class="sp-rank">${rk === 0 ? 'root' : `${w('you')} · ${rk === 1 ? w('og') : w('rn').replaceAll('{n}', rk).split('·')[0]}`}</p><p class="sp-hi" style="margin-bottom:8px">${w('pass')}</p><p class="sp-sub">${w('sub')}</p><div class="sp-seats" aria-live="polite"><i></i><i></i><span>${w('seats')}</span></div>
  <div class="sp-sheet"><div class="row"><a class="wa" data-c="wa" target="_blank" rel="noopener">WhatsApp</a></div>
  <div class="row"><a class="o" data-c="tg" target="_blank" rel="noopener">Telegram</a><a class="o" data-c="sms">SMS</a><a class="o" data-c="li" target="_blank" rel="noopener">LinkedIn</a></div>
  <div class="row"><button class="o" data-c="copy">${w('copy')}</button><button class="o" data-c="more" style="grid-column:span 2">${w('more')}</button></div></div>
  <p class="sp-sub" style="margin:8px 0 0"><a href="/the6cube/spread/" style="color:#b4a0d6">${w('map')}</a></p>`);
  v.querySelector('.sp-x').onclick = close;
  myOpens().then(k => { const seats = v.querySelector('.sp-seats'); if (!seats) return; seats.querySelectorAll('i').forEach((i, n) => n < k && i.classList.add('on')); if (k) seats.querySelector('span').textContent = w('seatn').replace('{k}', k); });
  v.querySelectorAll('[data-c]').forEach(el => el.addEventListener('click', async e => {
    const ch = el.dataset.c, url = shared(ch), text = `${msg}\n${url}`;
    if (ch === 'wa') el.href = `https://wa.me/?text=${encodeURIComponent(text)}`;
    else if (ch === 'tg') el.href = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(msg)}`;
    else if (ch === 'li') el.href = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
    else if (ch === 'sms') el.href = `sms:?&body=${encodeURIComponent(text)}`;
    else { e.preventDefault();
      if (ch === 'more' && navigator.share) { try { await navigator.share({ title: 'The 6 Cube · Corvus', text: msg, url }); } catch {} return; }
      try { await navigator.clipboard.writeText(text); el.textContent = w('copied'); } catch { prompt('copy:', url); } }
  }));
}
