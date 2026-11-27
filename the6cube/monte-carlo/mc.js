// Monte Carlo × Corvus — a casino whose odds are exact, and a house that proves the law of large numbers.
import { mountPolyglot, currentLang } from '../polyglot.js';
import { MC_I18N } from './i18n-mc.js';
import { stickers, moves, turn, turnInfo, rotate, key } from '../model.js';
import { buildBall, exactDistribution, applyMove, identity, distanceOf, mulberry32, SLOT, LAB_VERSION } from '../lab.js';

const $ = id => document.getElementById(id);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const T = {
  nl: { portal: '← 🏛️ portaal', title: 'Het huis speelt <em>eerlijk.</em>',
    lead: 'De Monte Carlo-methode is vernoemd naar een casino. Dus bouwden we er een. Elke spin draait de kubus een paar willekeurige keren; je wedt op hoe ver hij daarna van opgelost ligt. De odds zijn exact uitgerekend: verwachte winst nul. Speel lang genoeg en de wiskunde wint altijd.',
    turns: 'draaien per spin', stake: 'inzet', bankroll: 'fiches', spin: 'Spin', reset: 'Opnieuw',
    odds_exact: 'Exacte odds: alle {n} reeksen van {k} draaien zijn in je browser opgesomd ({ms} ms).',
    odds_est: 'Geschatte odds: {n} gesimuleerde reeksen van {k} draaien, seed 1729 (versie {v}). Afstanden boven 4 zijn een ondergrens.',
    bin: 'd = {d}', bin_out: 'd ≥ 5', p: 'kans {p}', nomarket: 'geen markt',
    win: 'Gewonnen: {seq} → d = {d}. +{x} fiches.', lose: 'Verloren: {seq} → d = {d}. −{x} fiches.', pick: 'Kies eerst een vak op het tapijt.', broke: 'Bankroet. Opnieuw?',
    plaque: '{k} draaien · uitkomst <b>{d}</b>', plaque0: 'kies een vak · draai',
    house_title: 'Laat het huis <em>10 000 keer</em> spelen.', house_lead: 'Dezelfde inzet, hand na hand, met een vaste seed. Links zie je de geschatte kans convergeren naar de exacte waarde; rechts het saldo van het huis: een random walk rond nul.',
    hands: 'handen', house_play: 'Speel', c1: 'Geschatte kans vs. exacte kans', c1cap: 'Band = 95 %-betrouwbaarheidsinterval (Wilson). Stippellijn = exacte kans.',
    c2: 'Saldo van de speler', c2cap: 'Verwachting 0. Trechter = ±2σ·√n. Het saldo blijft er bijna altijd binnen.',
    st_n: 'handen', st_p: 'geschat', st_true: 'exact', st_z: 'z-score', st_bank: 'eindsaldo',
    s1t: 'Ulam, 1946', s1: 'Stanisław Ulam lag ziek in bed en speelde patience. In plaats van de winkans uit te rekenen, besloot hij gewoon te tellen hoe vaak hij won. Met Von Neumann en Metropolis werd dat een methode.',
    s2t: 'Waarom een casino', s2: 'Metropolis noemde de methode naar het casino van Monte Carlo, waar Ulams oom geld leende om te gokken. Toeval als rekenmachine.',
    s3t: 'Waarom 17 : 1', s3: 'Na twee willekeurige draaien is de kubus opgelost als de tweede draai de eerste ongedaan maakt: 1 kans op 18. Een eerlijk huis betaalt dan 17 : 1. Een echt casino betaalt minder; daar zit de winst.',
    foot: 'Monte Carlo × Corvus · {v} · alle odds komen uit de zettencode van /the6cube, niet uit een tabel.' },
  en: { portal: '← 🏛️ portal', title: 'The house plays <em>fair.</em>',
    lead: 'The Monte Carlo method was named after a casino. So we built one. Every spin turns the cube a few random times; you bet on how far from solved it ends. The odds are computed exactly: expected profit zero. Play long enough and the mathematics always wins.',
    turns: 'turns per spin', stake: 'stake', bankroll: 'chips', spin: 'Spin', reset: 'Reset',
    odds_exact: 'Exact odds: all {n} sequences of {k} turns enumerated in your browser ({ms} ms).',
    odds_est: 'Estimated odds: {n} simulated sequences of {k} turns, seed 1729 (version {v}). Distances above 4 are a lower bound.',
    bin: 'd = {d}', bin_out: 'd ≥ 5', p: 'p {p}', nomarket: 'no market',
    win: 'Won: {seq} → d = {d}. +{x} chips.', lose: 'Lost: {seq} → d = {d}. −{x} chips.', pick: 'Pick a square on the felt first.', broke: 'Bankrupt. Again?',
    plaque: '{k} turns · outcome <b>{d}</b>', plaque0: 'pick a square · spin',
    house_title: 'Let the house play <em>10,000 times.</em>', house_lead: 'Same bet, hand after hand, fixed seed. Left: the estimated probability converging to the exact value. Right: the player\'s balance, a random walk around zero.',
    hands: 'hands', house_play: 'Play', c1: 'Estimated vs. exact probability', c1cap: 'Band = 95% confidence interval (Wilson). Dashed = exact probability.',
    c2: 'Player balance', c2cap: 'Expectation 0. Funnel = ±2σ·√n. The balance almost always stays inside.',
    st_n: 'hands', st_p: 'estimated', st_true: 'exact', st_z: 'z-score', st_bank: 'final balance',
    s1t: 'Ulam, 1946', s1: 'Stanisław Ulam was ill in bed playing solitaire. Instead of computing his chance of winning, he decided to simply count how often he won. With von Neumann and Metropolis it became a method.',
    s2t: 'Why a casino', s2: 'Metropolis named the method after the Monte Carlo casino, where Ulam\'s uncle borrowed money to gamble. Chance as a computer.',
    s3t: 'Why 17 : 1', s3: 'After two random turns the cube is solved if the second turn undoes the first: 1 chance in 18. A fair house pays 17 : 1. A real casino pays less; that is where the profit lives.',
    foot: 'Monte Carlo × Corvus · {v} · every odd comes from the /the6cube move code, not from a table.' },
};
Object.assign(T, MC_I18N);
let lang = currentLang(Object.keys(T), 'en');
const t = (k, v = {}) => (T[lang][k] ?? T.en[k] ?? T.nl[k]).replace(/\{(\w+)\}/g, (_, n) => v[n] ?? '');
const fmt = (n, d = 0) => Number(n).toLocaleString({ nl: 'nl-BE', en: 'en-GB', es: 'es-ES', fr: 'fr-FR', pt: 'pt-PT', de: 'de-DE', zh: 'zh-CN' }[lang] || 'en-GB', { minimumFractionDigits: d, maximumFractionDigits: d });
const lbl = m => m.replace("'", '′');

/* ---------- odds: exact by enumeration (2, 4), estimated by simulation (8) ---------- */
const ball = buildBall();
// 8 turns cannot be enumerated (18^8 ≈ 1.1e10): estimate once, seeded, in the page.
function estimate(k, n, seed) { const rng = mulberry32(seed); const bins = new Array(6).fill(0);
  for (let i = 0; i < n; i++) { let pos = identity(); for (let j = 0; j < k; j++) pos = applyMove(pos, moves[Math.floor(rng() * 18)]); const d = distanceOf(ball, pos); bins[d === null ? 5 : d]++; } return { bins, denominator: n }; }
// Precomputed with the same code path (node tools/cube/test.mjs asserts it): uniform, 8 turns, n = 100 000, seed 1729.
const EST8 = { bins: [32, 236, 1109, 3244, 8323, 87056], denominator: 100000 };
const MARKETS = { 8: { ...EST8, exact: false, ms: 0, k: 8 } };
function market(k) {
  if (MARKETS[k]) return MARKETS[k];
  const t0 = performance.now();
  const m = k <= 4 ? { ...exactDistribution('uniform', k, ball), exact: true } : { ...estimate(k, 100000, 1729), exact: false };
  m.ms = performance.now() - t0; m.k = k;
  return (MARKETS[k] = m);
}
const prob = (m, bin) => m.bins[bin] / m.denominator;
const oddsText = p => { if (!p) return t('nomarket'); const x = 1 / p - 1; return x >= 1 ? `${fmt(x, x < 10 ? 2 : 1)} : 1` : `1 : ${fmt(1 / x, 2)}`; };

/* ---------- state ---------- */
let k = 2, stake = 10, bet = null, bank = 1000, state = stickers, spinning = false, last = null, wheelAngle = 0, spinV = 0, lastSeq = [];
const history = [];

/* ---------- the wheel: 54 pockets = sticker slots ---------- */
const cv = $('wheel'), g = cv.getContext('2d');
function fit() { const r = cv.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1); const w = Math.round(r.width * d); if (cv.width !== w) { cv.width = w; cv.height = w; } return d; }
let anim = null;                                     // { move, p }
function drawWheel() {
  const d = fit(), W = cv.width, c = W / 2, R = W * .46;
  g.clearRect(0, 0, W, W);
  // rim
  const rim = g.createRadialGradient(c, c, R * .7, c, c, R); rim.addColorStop(0, '#24183d'); rim.addColorStop(.85, '#120b1e'); rim.addColorStop(1, '#2c1f45');
  g.fillStyle = rim; g.beginPath(); g.arc(c, c, R, 0, 7); g.fill();
  g.strokeStyle = '#c9a54a'; g.lineWidth = 2 * d; g.beginPath(); g.arc(c, c, R, 0, 7); g.stroke();
  // pockets: colour = the sticker that currently occupies that slot
  const occupant = new Array(54); state.forEach((s, j) => { occupant[SLOT.get(key(s))] = [s, j]; });
  const r0 = R * .64, r1 = R * .9, step = 2 * Math.PI / 54;
  for (let i = 0; i < 54; i++) {
    const a0 = wheelAngle + i * step, a1 = a0 + step, [s, j] = occupant[i], home = i === j;
    g.beginPath(); g.arc(c, c, r1, a0, a1); g.arc(c, c, r0, a1, a0, true); g.closePath();
    g.fillStyle = s.color; g.globalAlpha = home ? .78 : 1; g.fill(); g.globalAlpha = 1;
    g.strokeStyle = '#c9a54a'; g.lineWidth = 1 * d; g.stroke();
    if (!home) { g.strokeStyle = '#ffd76a'; g.lineWidth = 2.4 * d; g.beginPath(); g.arc(c, c, r1 + 3 * d, a0 + .01, a1 - .01); g.stroke(); }
    // face letter on every pocket (labels alongside colour)
    const am = a0 + step / 2; g.save(); g.translate(c + Math.cos(am) * (r0 + r1) / 2, c + Math.sin(am) * (r0 + r1) / 2); g.rotate(am + Math.PI / 2);
    g.fillStyle = '#08060c'; g.font = `600 ${Math.round(R * .045)}px ui-monospace,monospace`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(s.face, 0, 0); g.restore();
  }
  // cone + cube in the centre
  const cone = g.createRadialGradient(c, c, 0, c, c, r0); cone.addColorStop(0, '#2c1f45'); cone.addColorStop(1, '#0d0a12');
  g.fillStyle = cone; g.beginPath(); g.arc(c, c, r0 - 2 * d, 0, 7); g.fill();
  for (let i = 0; i < 8; i++) { const a = wheelAngle * 1.6 + i * Math.PI / 4; g.strokeStyle = 'rgba(201,165,74,.35)'; g.lineWidth = d; g.beginPath(); g.moveTo(c + Math.cos(a) * r0 * .55, c + Math.sin(a) * r0 * .55); g.lineTo(c + Math.cos(a) * (r0 - 4 * d), c + Math.sin(a) * (r0 - 4 * d)); g.stroke(); }
  drawCube(g, c, c, r0 * .5, anim);
}
function drawCube(ctx, cx, cy, size, a) {
  const shown = a ? turn(state, a.move, 1 - (1 - a.p) ** 3) : state;
  const proj = v => { const [x, y, z] = rotate(rotate(v, 1, .61 + wheelAngle * .25), 0, -.56); return [cx + x * size * .5, cy - y * size * .5, z]; };
  const active = a ? turnInfo(a.move) : null;
  for (let axis = 0; axis < 3; axis++) for (const layer of [-1, 0, 1]) {
    const on = active && active.axis === axis && active.sign === layer;
    ctx.beginPath(); for (let i = 0; i <= 48; i++) { const an = i * Math.PI / 24, p = [0, 0, 0]; p[axis] = layer * .83; p[(axis + 1) % 3] = 1.55 * Math.cos(an); p[(axis + 2) % 3] = 1.55 * Math.sin(an); const [x, y] = proj(p); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.strokeStyle = on ? '#ffd76a' : 'rgba(122,92,176,.35)'; ctx.lineWidth = on ? 2 : 1; ctx.stroke();
  }
  shown.map(s => ({ s, q: proj(s.position.map((v, i) => v * .83 + s.normal[i] * .48)) })).sort((p, q) => p.q[2] - q.q[2]).forEach(({ s, q }) => {
    ctx.globalAlpha = q[2] < -.3 ? .55 : 1; ctx.fillStyle = s.color; ctx.beginPath(); ctx.arc(q[0], q[1], size * (.045 + .007 * q[2]), 0, 7); ctx.fill(); });
  ctx.globalAlpha = 1;
}
function loop() { if (spinV) { wheelAngle += spinV; spinV *= .985; if (Math.abs(spinV) < .0005) spinV = 0; } else if (!reduced) wheelAngle += .0009; drawWheel(); requestAnimationFrame(loop); }

/* ---------- the felt ---------- */
function renderTable() {
  const m = market(k);
  $('ksel').replaceChildren(...[2, 4, 8].map(v => { const b = document.createElement('button'); b.textContent = v; b.setAttribute('aria-pressed', v === k); b.onclick = () => { if (spinning) return; k = v; bet = null; renderTable(); }; return b; }));
  $('ssel').replaceChildren(...[10, 50, 100].map(v => { const b = document.createElement('button'); b.textContent = v; b.setAttribute('aria-pressed', v === stake); b.onclick = () => { stake = v; renderTable(); }; return b; }));
  $('bets').replaceChildren(...[0, 1, 2, 3, 4, 5].map(bin => {
    const p = prob(m, bin), b = document.createElement('button');
    b.className = 'bet'; b.disabled = !p; b.setAttribute('aria-pressed', bet === bin);
    b.innerHTML = `<span class="d">${bin === 5 ? '≥ 5' : bin}</span><span class="o">${oddsText(p)}</span><span class="p">${p ? t('p', { p: fmt(100 * p, p < .01 ? 3 : 2) + ' %' }) : '—'}</span><span class="chipbet">${stake}</span>`;
    b.setAttribute('aria-label', `${bin === 5 ? t('bin_out') : t('bin', { d: bin })}, ${oddsText(p)}`);
    b.onclick = () => { bet = bin; renderTable(); };
    return b;
  }));
  $('oddsnote').textContent = m.exact ? t('odds_exact', { n: fmt(m.denominator), k, ms: fmt(m.ms) }) : t('odds_est', { n: fmt(m.denominator), k, v: LAB_VERSION });
  $('bank').textContent = fmt(bank);
  $('plaque').innerHTML = last ? t('plaque', { k: last.k, d: last.d === null ? '≥ 5' : last.d }) : t('plaque0');
  $('log').replaceChildren(...history.slice(-24).map(h => { const i = document.createElement('i'); i.textContent = h.d === null ? '5+' : h.d; if (h.win) i.className = 'w'; return i; }));
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function spin() {
  if (spinning) return;
  if (bet === null) { $('msg').textContent = t('pick'); return; }
  if (bank < stake) { $('msg').textContent = t('broke'); window.cubeCoffee?.open('broke'); return; }   // bean: going broke
  spinning = true; $('spin').disabled = true; state = stickers; last = null; renderTable();
  const seq = Array.from({ length: k }, () => moves[Math.floor(Math.random() * 18)]);
  spinV = reduced ? 0 : .22;
  for (const move of seq) {
    if (!reduced) { const t0 = performance.now(), dur = 230; while (true) { const p = Math.min(1, (performance.now() - t0) / dur); anim = { move, p }; if (p >= 1) break; await new Promise(requestAnimationFrame); } }
    anim = null; state = turn(state, move);
  }
  let pos = identity(); for (const mv of seq) pos = applyMove(pos, mv);
  const d = distanceOf(ball, pos), bin = d === null ? 5 : d, p = prob(market(k), bet), win = bin === bet;
  const delta = win ? Math.round(stake * (1 / p - 1)) : -stake;
  bank += delta; last = { k, d }; history.push({ d, win });
  $('msg').textContent = (win ? t('win', { seq: seq.map(lbl).join(' '), d: d ?? '≥ 5', x: fmt(delta) }) : t('lose', { seq: seq.map(lbl).join(' '), d: d ?? '≥ 5', x: fmt(stake) }));
  renderTable();
  if (win) $('bets').children[bet].classList.add('win');
  spinning = false; $('spin').disabled = false;
}
$('spin').onclick = spin;
$('bean').onclick = () => window.cubeCoffee?.open('casino');   // bean: the × in the sign
$('reset').onclick = () => { bank = 1000; history.length = 0; state = stickers; last = null; $('msg').textContent = ''; renderTable(); };

/* ---------- the house: seeded Monte Carlo, convergence + random walk ---------- */
let houseJob = 0, houseData = null;
function wilson(x, n, z = 1.96) { if (!n) return [0, 1]; const ph = x / n, den = 1 + z * z / n, c = (ph + z * z / (2 * n)) / den, h = z * Math.sqrt(ph * (1 - ph) / n + z * z / (4 * n * n)) / den; return [Math.max(0, c - h), Math.min(1, c + h)]; }
function playHouse() {
  const job = ++houseJob, m = market(k), target = bet ?? 0, p = prob(m, target) || 1e-9, N = Number($('hands').value);
  const seed = Math.max(0, Math.min(0xffffffff, parseInt($('seed').value, 10) || 1729)); $('seed').value = seed;
  const rng = mulberry32(seed), payout = 1 / p - 1;
  const conv = [], walk = []; let wins = 0, bal = 0, i = 0;
  houseData = { conv, walk, p, N, k, target, exact: m.exact, seed };
  const every = Math.max(1, Math.floor(N / 400));
  function chunk() {
    if (job !== houseJob) return;
    const end = Math.min(N, i + Math.max(200, N / 60));
    for (; i < end; i++) {
      let pos = identity(); for (let j = 0; j < k; j++) pos = applyMove(pos, moves[Math.floor(rng() * 18)]);
      const d = distanceOf(ball, pos), bin = d === null ? 5 : d;
      if (bin === target) { wins++; bal += payout; } else bal -= 1;
      if ((i + 1) % every === 0 || i === N - 1) { conv.push([i + 1, wins]); walk.push([i + 1, bal]); }
    }
    houseData.wins = wins; houseData.n = i; houseData.bal = bal;
    drawHouse();
    if (i < N) requestAnimationFrame(chunk);
  }
  chunk();
}
function svgChart(svg, draw) { const W = svg.clientWidth, H = svg.clientHeight; if (!W) return; svg.innerHTML = draw(W, H); }
function drawHouse() {
  const h = houseData; if (!h) return;
  const mono = 'font-family="ui-monospace,monospace" font-size="11" fill="rgba(239,231,210,.55)"';
  svgChart($('conv'), (W, H) => {
    const m = { l: 46, r: 10, t: 10, b: 26 }, X = n => m.l + (W - m.l - m.r) * Math.log10(n) / Math.log10(h.N), ymax = Math.min(1, h.p * 3.2 + .01), Y = v => m.t + (H - m.t - m.b) * (1 - Math.min(ymax, v) / ymax);
    const pts = h.conv.filter(([n]) => n >= 10);
    const band = pts.map(([n, x]) => wilson(x, n));
    let o = `<polygon points="${pts.map(([n], i) => `${X(n)},${Y(band[i][1])}`).concat(pts.map(([n], i) => `${X(n)},${Y(band[i][0])}`).reverse()).join(' ')}" fill="rgba(122,92,176,.28)"/>`;
    o += `<polyline points="${pts.map(([n, x]) => `${X(n)},${Y(x / n)}`).join(' ')}" fill="none" stroke="#b4a0d6" stroke-width="2"/>`;
    o += `<line x1="${m.l}" x2="${W - m.r}" y1="${Y(h.p)}" y2="${Y(h.p)}" stroke="#ffd76a" stroke-dasharray="4 5"/><text x="${W - m.r}" y="${Y(h.p) - 6}" text-anchor="end" font-family="ui-monospace,monospace" font-size="12" fill="#ffd76a">p = ${fmt(h.p, 4)}</text>`;
    [10, 100, 1000, 10000, 50000].filter(n => n <= h.N).forEach(n => { o += `<text x="${X(n)}" y="${H - 6}" text-anchor="middle" ${mono}>${fmt(n)}</text>`; });
    [0, ymax / 2, ymax].forEach(v => { o += `<text x="${m.l - 6}" y="${Y(v) + 4}" text-anchor="end" ${mono}>${fmt(v, 3)}</text>`; });
    return o;
  });
  svgChart($('walk'), (W, H) => {
    const m = { l: 52, r: 10, t: 10, b: 26 }, sd = Math.sqrt((1 / h.p - 1)), lim = Math.max(2 * sd * Math.sqrt(h.N), ...h.walk.map(([, b]) => Math.abs(b))) * 1.05;
    const X = n => m.l + (W - m.l - m.r) * n / h.N, Y = v => m.t + (H - m.t - m.b) * (.5 - v / (2 * lim));
    const funnel = Array.from({ length: 60 }, (_, i) => (i + 1) / 60 * h.N);
    let o = `<polygon points="${funnel.map(n => `${X(n)},${Y(2 * sd * Math.sqrt(n))}`).concat(funnel.map(n => `${X(n)},${Y(-2 * sd * Math.sqrt(n))}`).reverse()).join(' ')} ${X(0)},${Y(0)}" fill="rgba(122,92,176,.18)"/>`;
    o += `<line x1="${m.l}" x2="${W - m.r}" y1="${Y(0)}" y2="${Y(0)}" stroke="#ffd76a" stroke-dasharray="4 5"/>`;
    o += `<polyline points="${X(0)},${Y(0)} ${h.walk.map(([n, b]) => `${X(n)},${Y(b)}`).join(' ')}" fill="none" stroke="#efe7d2" stroke-width="1.4"/>`;
    [-lim * .8, 0, lim * .8].forEach(v => { o += `<text x="${m.l - 6}" y="${Y(v) + 4}" text-anchor="end" ${mono}>${fmt(v)}</text>`; });
    [0, h.N / 2, h.N].forEach(n => { o += `<text x="${X(n)}" y="${H - 6}" text-anchor="middle" ${mono}>${fmt(n)}</text>`; });
    return o;
  });
  const ph = h.wins / Math.max(1, h.n), z = (ph - h.p) / Math.sqrt(h.p * (1 - h.p) / Math.max(1, h.n));
  $('stats').innerHTML = [[t('st_n'), fmt(h.n)], [t('st_p'), fmt(ph, 4)], [t('st_true') + (h.exact ? '' : ' (≈)'), fmt(h.p, 4)], [t('st_z'), fmt(z, 2)], [t('st_bank'), (h.bal >= 0 ? '+' : '') + fmt(h.bal, 1)]]
    .map(([a, b]) => `<div><dt>${a}</dt><dd>${b}</dd></div>`).join('');
}
$('play').onclick = playHouse;
new ResizeObserver(drawHouse).observe($('conv'));

/* ---------- language + boot ---------- */
function applyLang() {
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-i18n]').forEach(e => e.textContent = t(e.dataset.i18n));
  document.querySelectorAll('[data-i18n-html]').forEach(e => e.innerHTML = t(e.dataset.i18nHtml));
  $('foot').textContent = t('foot', { v: LAB_VERSION });
  renderTable(); drawHouse();
}
bet = 0;
applyLang();
mountPolyglot(code => { lang = code; applyLang(); });
requestAnimationFrame(loop);
playHouse();
