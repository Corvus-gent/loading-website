import { mountPolyglot, currentLang } from './polyglot.js';
import { LAB_I18N } from './i18n-lab.js';
import { faces, stickers, moves, turn, inverse, key, solvedKey, updatePath, turnInfo, rotate } from './model.js';
import { LAB_VERSION, RADIUS, GENERATORS, buildBall, distanceOf, applySequence, applyMove, identity, stateKey, posFromStickers,
  signature, runExperiment, exactDistribution, validateParams, toCSV } from './lab.js';

const $ = id => document.getElementById(id);
const label = move => move.replace("'", '′');
const seqLabel = seq => seq.length ? seq.map(label).join(' ') : '·';
const isSolved = state => state.map(key).join(';') === solvedKey;
const apply = (state, path) => path.reduce((current, move) => turn(current, move), state);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const ease = x => x < .5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
const smallBall = buildBall(2);                    // instant exact distances up to 2 on the main thread

/* ---------------- i18n: the seven languages of the polyglot rail ---------------- */
const T = {
  nl: {
    intro: 'Een speelbare kubus als onderzoeksinstrument. Twee verschillende paden, één eindstand. Daarna een experiment dat je in dezelfde visit kunt reproduceren.',
    proof_title: 'Twee paden, één eindstand', compare: 'Vergelijk twee paden', lane_a: 'Pad A', lane_b: 'Pad B',
    v_turns: 'geschreven draaien', v_dist: 'exacte afstand tot opgelost', v_sig: 'eindstand-handtekening',
    replay: 'Opnieuw', step: 'Stap', scrub: 'Tijdlijn', take: 'Neem deze stand over', in_tree: 'Toon in de beslisboom',
    at: 'stap {s} van 3', why: 'Waarom is R L R′ hetzelfde als L?',
    why_body: 'R draait de rechterlaag, L de linkerlaag. Die lagen delen geen enkele sticker, dus de volgorde maakt niet uit: R L = L R. Daarom is R L R′ = L R R′ = L. Drie geschreven draaien, maar de eindstand ligt exact één draai van opgelost. De lengte van een geschiedenis is dus geen afstand.',
    sig_wait: 'nog onderweg…', sig_same: '#{a} = #{b}',
    exp_title: 'Scramble-experiment',
    exp_lede: 'Intuïtie: meer willekeurige draaien = verder van opgelost, en een regel die herhaling verbiedt verandert daar weinig aan. Meet het. Twee generators met dezelfde seed, exacte afstanden tot straal 4.',
    steps: 'stappen', samples: 'stalen per generator', run: 'Voer uit', cancel: 'Annuleer', csv: 'Download CSV', share: 'Kopieer deellink',
    rules: 'Procesregels en reproductie',
    rule_uniform: '<b>Uniform</b>: elke stap is één van de 18 draaien, onafhankelijk van de vorige.',
    rule_distinct: '<b>Verschillende vlakken</b>: de eerste stap is één van 18, elke volgende één van de 15 draaien op een ander vlak.',
    rule_radius: '<b>Afstand</b>: exact via breedte-eerst zoeken vanaf opgelost tot straal 4 (halvedraaimetriek, 46 741 standen). Stalen daarbuiten tellen apart als <i>afstand ≥ 5</i>: een ondergrens, geen gok.',
    rule_seed: '<b>Seed</b>: mulberry32. Beide generators starten met dezelfde seed. Zelfde versie + seed = identieke tellingen.',
    why_further: 'Waarom lijkt de beperkte wandeling op lage diepte verder van opgelost? Uniforme stappen mogen op hetzelfde vlak vallen: R R′ heft zich op, R R wordt R2. Die botsingen trekken de verdeling naar kleine afstanden. De regel verbiedt precies die botsingen. Bij 2 stappen: uniform eindigt in 1/18 van de gevallen opgelost, verschillende vlakken nooit. Op grotere diepte kunnen andere botsingen (R L R′ L′) wel nog.',
    gen_uniform: 'Uniform', gen_distinct: 'Verschillende vlakken', gen_uniform_sub: '18 keuzes per stap', gen_distinct_sub: '15 keuzes na stap 1',
    bin: 'd = {d}', bin_out: 'd ≥ {d}', exact: 'exact', count: 'aantal', share_col: 'aandeel',
    meta_snapshot: '{v} · seed {seed} · n = {n} per generator · straal {r} · bron: gepubliceerde snapshot (direct getoond)',
    meta_live: '{v} · seed {seed} · n = {n} per generator · straal {r} · live in je browser: zoektabel {ball} + run {run}',
    meta_main: ' · zonder worker', meta_running: 'Bezig… {done} / {total} stalen', meta_cancel: 'Geannuleerd. De laatste volledige run blijft staan.',
    meta_error: 'Fout in de worker: {m}. De snapshot blijft staan.',
    sum_2: 'Na 2 stappen eindigt uniform in {u0} van de gevallen opgelost (exact 1/18 ≈ 5,56 %). Verschillende vlakken: {d0} (exact 0). Eén regel, en een hele uitkomst verdwijnt.',
    sum_n: 'Na {s} stappen: opgelost uniform {u0}, verschillende vlakken {d0}. Binnen afstand 2: {u2} tegenover {d2}. Buiten straal 4 (afstand ≥ 5): {uo} tegenover {do} van {n}.',
    inspect: 'Voorbeeld uit {bin} · {gen} · trial #{trial}: ', open_sim: 'Open in de simulator', none: 'Geen stalen in deze bak.',
    repro: 'Reproduceer: node tools/cube/experiment.mjs --steps {s} --seed {seed} --samples {n}',
    copied: 'Deellink gekopieerd', copy_fail: 'Kopiëren kon niet; selecteer de link:',
    cube: 'Kubus', play: 'Spelen', scramble_len: 'Scramblelengte', scramble: '↻ Scramble', reset: 'Reset',
    hint: 'Letters kiezen een vlak. <kbd>′</kbd> draait tegen de klok in, <kbd>2</kbd> draait 180°. Toetsenbord: <kbd>U</kbd> <kbd>R</kbd> <kbd>F</kbd> <kbd>D</kbd> <kbd>L</kbd> <kbd>B</kbd>, met <kbd>Shift</kbd> voor de omgekeerde draai.',
    history_title: 'Geschiedenis terugspelen', history_note: 'Draait jouw geschiedenis in omgekeerde volgorde terug. Dit is geen solver: de lengte is de geschiedenis, niet de kortste afstand.',
    next_step: 'Volgende stap', play_hist: 'Speel geschiedenis terug', pause: 'Pauzeer',
    status_solved: 'Opgelost ✓', status_mixed: 'Door elkaar', last: 'Laatste draai · {m}',
    instr_idle: 'Elk vlak heeft één kleur. Start een scramble of probeer zelf een draai.',
    instr_move: '{m} · Draai het vlak {f} {dir}', cw: 'met de klok mee.', ccw: 'tegen de klok in.', half: '180°.',
    face_U: 'boven', face_R: 'rechts', face_F: 'voor', face_D: 'onder', face_L: 'links', face_B: 'achter',
    f_scr: 'scramblelengte', f_hist: 'geschiedenis', f_dist: 'kortste afstand', exact_d: 'exact {d}', at_least: '≥ {d} (buiten straal {r})', pending: 'zoekt…',
    view: 'Kijkhoek {n}/4', net: 'Stickeroverzicht per vlak', sticker_of: 'Sticker van vlak {f}',
    tree: 'Beslisboom', tree_body: 'Elke stand heeft 18 legale draaien. Open een tak om verder te gaan; elke knoop toont zijn pad. Een paarse ≡ betekent: deze stand bestaat al met een korter pad.',
    animate: '↻ Animeer takken', back: '← Vorige vertakking', load: 'Speel deze stand', as_list: 'Draaien als lijst', current: 'Huidige stand',
    open_after: 'Open stand na {m}', solved_short: 'opgelost', same_as: '≡ {p}', root: 'wortel',
    graph: '<strong>Begrensde graaf</strong> vanaf deze wortel · diepte ≤ 2 · budget 18 + 324 = <strong>342</strong> paden → <strong>{u}</strong> nieuwe unieke standen; <strong>{c}</strong> paden komen uit op een stand die al bestond.',
    graph_ex: 'Voorbeelden van convergentie:',
    credit: 'Ringvisualisatie geïnspireerd door Math Visualizations ↗', back_exp: '← Terug naar het experiment', back_proof: '← Terug naar het bewijs',
  },
  en: {
    intro: 'A playable cube as a research instrument. Two different paths, one endpoint. Then an experiment you can reproduce in the same visit.',
    proof_title: 'Two paths, one endpoint', compare: 'Compare two paths', lane_a: 'Path A', lane_b: 'Path B',
    v_turns: 'scripted turns', v_dist: 'exact distance to solved', v_sig: 'endpoint signature',
    replay: 'Replay', step: 'Step', scrub: 'Timeline', take: 'Take over this state', in_tree: 'Show in decision tree',
    at: 'step {s} of 3', why: 'Why is R L R′ the same as L?',
    why_body: 'R turns the right layer, L the left layer. Those layers share no sticker, so order does not matter: R L = L R. Hence R L R′ = L R R′ = L. Three scripted turns, yet the endpoint is exactly one turn from solved. History length is not distance.',
    sig_wait: 'in progress…', sig_same: '#{a} = #{b}',
    exp_title: 'Scramble experiment',
    exp_lede: 'Intuition: more random turns = further from solved, and a rule that forbids repeats changes little. Measure it. Two generators, same seed, exact distances up to radius 4.',
    steps: 'steps', samples: 'samples per generator', run: 'Run', cancel: 'Cancel', csv: 'Download CSV', share: 'Copy share link',
    rules: 'Process rules and reproduction',
    rule_uniform: '<b>Uniform</b>: every step is one of the 18 turns, independent of the previous one.',
    rule_distinct: '<b>Distinct faces</b>: the first step is one of 18; every later step is one of the 15 turns on a different face.',
    rule_radius: '<b>Distance</b>: exact via breadth-first search from solved up to radius 4 (half-turn metric, 46,741 states). Samples beyond it are counted separately as <i>distance ≥ 5</i>: a lower bound, not a guess.',
    rule_seed: '<b>Seed</b>: mulberry32. Both generators start from the same seed. Same version + seed = identical counts.',
    why_further: 'Why does the constrained walk look further from solved at low depth? Uniform steps may land on the same face: R R′ cancels, R R becomes R2. Those collisions pull the distribution toward small distances. The rule forbids exactly those collisions. At 2 steps uniform ends solved 1 in 18 times, distinct faces never. At larger depth other collisions (R L R′ L′) still can.',
    gen_uniform: 'Uniform', gen_distinct: 'Distinct faces', gen_uniform_sub: '18 choices per step', gen_distinct_sub: '15 choices after step 1',
    bin: 'd = {d}', bin_out: 'd ≥ {d}', exact: 'exact', count: 'count', share_col: 'share',
    meta_snapshot: '{v} · seed {seed} · n = {n} per generator · radius {r} · source: published snapshot (shown immediately)',
    meta_live: '{v} · seed {seed} · n = {n} per generator · radius {r} · live in your browser: search table {ball} + run {run}',
    meta_main: ' · without worker', meta_running: 'Running… {done} / {total} samples', meta_cancel: 'Cancelled. The last complete run stays on screen.',
    meta_error: 'Worker error: {m}. The snapshot stays on screen.',
    sum_2: 'After 2 steps uniform ends solved in {u0} of cases (exact 1/18 ≈ 5.56%). Distinct faces: {d0} (exact 0). One rule, and a whole outcome disappears.',
    sum_n: 'After {s} steps: solved uniform {u0}, distinct faces {d0}. Within distance 2: {u2} versus {d2}. Outside radius 4 (distance ≥ 5): {uo} versus {do} of {n}.',
    inspect: 'Example from {bin} · {gen} · trial #{trial}: ', open_sim: 'Open in the simulator', none: 'No samples in this bin.',
    repro: 'Reproduce: node tools/cube/experiment.mjs --steps {s} --seed {seed} --samples {n}',
    copied: 'Share link copied', copy_fail: 'Could not copy; select the link:',
    cube: 'Cube', play: 'Play', scramble_len: 'Scramble length', scramble: '↻ Scramble', reset: 'Reset',
    hint: 'Letters pick a face. <kbd>′</kbd> turns counter-clockwise, <kbd>2</kbd> turns 180°. Keyboard: <kbd>U</kbd> <kbd>R</kbd> <kbd>F</kbd> <kbd>D</kbd> <kbd>L</kbd> <kbd>B</kbd>, with <kbd>Shift</kbd> for the inverse.',
    history_title: 'Play history backwards', history_note: 'Undoes your history in reverse order. This is not a solver: its length is the history, not the shortest distance.',
    next_step: 'Next step', play_hist: 'Play history backwards', pause: 'Pause',
    status_solved: 'Solved ✓', status_mixed: 'Scrambled', last: 'Last turn · {m}',
    instr_idle: 'Every face has one colour. Start a scramble or try a turn.',
    instr_move: '{m} · Turn the {f} face {dir}', cw: 'clockwise.', ccw: 'counter-clockwise.', half: '180°.',
    face_U: 'up', face_R: 'right', face_F: 'front', face_D: 'down', face_L: 'left', face_B: 'back',
    f_scr: 'scramble length', f_hist: 'history', f_dist: 'shortest distance', exact_d: 'exact {d}', at_least: '≥ {d} (beyond radius {r})', pending: 'searching…',
    view: 'View {n}/4', net: 'Sticker net per face', sticker_of: 'Sticker of face {f}',
    tree: 'Decision tree', tree_body: 'Every state has 18 legal turns. Open a branch to go deeper; every node shows its path. A violet ≡ means: this state already exists with a shorter path.',
    animate: '↻ Animate branches', back: '← Previous branch', load: 'Play this state', as_list: 'Turns as a list', current: 'Current state',
    open_after: 'Open state after {m}', solved_short: 'solved', same_as: '≡ {p}', root: 'root',
    graph: '<strong>Bounded graph</strong> from this root · depth ≤ 2 · budget 18 + 324 = <strong>342</strong> paths → <strong>{u}</strong> new unique states; <strong>{c}</strong> paths land on a state that already existed.',
    graph_ex: 'Examples of convergence:',
    credit: 'Ring visualisation inspired by Math Visualizations ↗', back_exp: '← Back to the experiment', back_proof: '← Back to the proof',
  },
};
Object.assign(T, LAB_I18N);
let lang = currentLang(Object.keys(T), 'en');
const t = (k, vars = {}) => (T[lang][k] ?? T.en[k] ?? T.nl[k] ?? k).replace(/\{(\w+)\}/g, (_, name) => vars[name] ?? '');
const fmt = (n, digits = 0) => Number(n).toLocaleString({ nl: 'nl-BE', en: 'en-GB', es: 'es-ES', fr: 'fr-FR', pt: 'pt-PT', de: 'de-DE', zh: 'zh-CN' }[lang] || 'en-GB', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const pct = (count, total) => fmt(100 * count / total, 2) + ' %';

/* ---------------- drawing: the nine-ring view ---------------- */
const VIEWS = [.61, 2.18, 3.72, 5.27];
let R3 = null;
import('./render3d.js').then(m => { if (m.ready()) { R3 = m; try { refresh(); renderProof(); } catch {} } }).catch(() => {});
function draw(canvas, configuration, highlighted, view = 0, zoom = 1) {
  // The 18 small tree previews already have a 2D renderer. Avoid 18 GPU readbacks per turn.
  if (canvas.width > 120 && R3 && R3.draw3d(canvas, configuration, highlighted, view, zoom)) return;
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  const scale = Math.min(width, height) * .165 * zoom;
  const project = vector => {
    const [x, y, z] = rotate(rotate(vector, 1, VIEWS[view]), 0, -.56);
    return [width / 2 + x * scale, height / 2 - y * scale, z];
  };
  ctx.clearRect(0, 0, width, height);
  for (let axis = 0; axis < 3; axis++) for (const layer of [-1, 0, 1]) {
    const active = highlighted?.axis === axis && highlighted.sign === layer;
    ctx.beginPath();
    for (let i = 0; i <= 72; i++) {
      const angle = i * Math.PI / 36, point = [0, 0, 0];
      point[axis] = layer * .83; point[(axis + 1) % 3] = 1.55 * Math.cos(angle); point[(axis + 2) % 3] = 1.55 * Math.sin(angle);
      const [x, y] = project(point);
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.strokeStyle = active ? '#ffd76a' : ['#7a5cb070', '#b4a0d655', '#5b3e8c80'][axis];
    ctx.lineWidth = Math.max(.65, scale / (active ? 26 : 72));
    ctx.stroke();
  }
  const dots = configuration.map(sticker => ({ ...sticker,
    projected: project(sticker.position.map((value, axis) => value * .83 + sticker.normal[axis] * .48)) }))
    .sort((a, b) => a.projected[2] - b.projected[2]);
  for (const { projected: [x, y, depth], color, face, position } of dots) {
    const r = scale * (.055 + .009 * depth);
    ctx.beginPath(); ctx.arc(x, y, r, 0, 2 * Math.PI);
    ctx.fillStyle = color; ctx.strokeStyle = '#0d0a12'; ctx.globalAlpha = depth < -.3 ? .6 : 1;
    ctx.lineWidth = Math.max(.55, scale * .022); ctx.fill(); ctx.stroke();
    // Labels alongside colour: centre stickers carry their face letter.
    if (r > 5 && depth > -.3 && position.filter(Boolean).length === 1) {
      ctx.fillStyle = '#0d0a12'; ctx.font = `600 ${Math.round(r * 1.1)}px ui-monospace,monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(face, x, y + .5);
    }
  }
  ctx.globalAlpha = 1;
}

/* ---------------- §1 proof: one playback state drives everything ---------------- */
const LANES = { a: ['R', 'L', "R'"], b: [null, 'L', null] };
const END = 3;
const pb = { t: 0, token: 0, raf: 0 };
function laneAt(slots, time) {
  let state = stickers;
  for (let i = 0; i < slots.length; i++) {
    const move = slots[i];
    if (!move) continue;
    if (time >= i + 1) { state = turn(state, move); continue; }
    if (time > i) return { state: turn(state, move, ease(time - i)), active: turnInfo(move) };
    break;
  }
  return { state, active: null };
}
const committed = slots => slots.filter(Boolean);
function renderProof() {
  const time = pb.t;
  for (const id of ['a', 'b']) {
    const { state, active } = laneAt(LANES[id], time);
    draw($('lane-' + id), state, active ? { axis: active.axis, sign: active.sign } : undefined, 0, 1.55);
    const chips = $('chips-' + id);
    chips.replaceChildren(...LANES[id].map((move, i) => {
      if (!move) return null;
      const li = document.createElement('li'); li.textContent = label(move);
      if (time >= i + 1) li.className = 'done'; else if (time > i) li.className = 'now';
      return li;
    }).filter(Boolean));
  }
  const done = time >= END - 1e-9;
  const posA = applySequence(committed(LANES.a)), posB = applySequence(committed(LANES.b));
  const sa = signature(posA), sb = signature(posB);
  $('sum-a').textContent = done ? `${seqLabel(committed(LANES.a))} → #${sa}` : t('sig_wait');
  $('sum-b').textContent = done ? `${seqLabel(committed(LANES.b))} → #${sb}` : t('sig_wait');
  $('lanes').classList.toggle('united', done && stateKey(posA) === stateKey(posB));
  $('proof').classList.toggle('united', done);
  $('v-dist').textContent = done ? String(distanceOf(smallBall, posA)) : '—';
  $('v-sig').textContent = done ? t('sig_same', { a: sa.slice(0, 6), b: sb.slice(0, 6) }) : '—';
  $('p-scrub').value = Math.round(time * 100);
  $('p-scrub').setAttribute('aria-valuetext', t('at', { s: fmt(time, 2) }));
  $('p-at').textContent = t('at', { s: Math.min(END, Math.ceil(time - 1e-9)) || 0 });
  $('p-step').disabled = done;
}
function playTo(target) {
  const token = ++pb.token;
  cancelAnimationFrame(pb.raf);
  if (reducedMotion.matches) { pb.t = target; renderProof(); return; }
  const from = pb.t, duration = Math.abs(target - from) * 900, start = performance.now();
  const tick = now => {
    if (token !== pb.token) return;                        // a newer command owns playback
    const k = duration ? Math.min(1, (now - start) / duration) : 1;
    pb.t = from + (target - from) * k; renderProof();
    if (k < 1) pb.raf = requestAnimationFrame(tick);       // stops once the proof is visible
  };
  pb.raf = requestAnimationFrame(tick);
}
$('compare').onclick = () => { pb.t = 0; playTo(END); };
$('p-replay').onclick = () => { pb.t = 0; playTo(END); };
$('p-step').onclick = () => playTo(Math.min(END, Math.floor(pb.t + 1e-6) + 1));
$('p-scrub').oninput = event => { pb.token++; cancelAnimationFrame(pb.raf); pb.t = event.target.value / 100; renderProof(); };
$('p-take').onclick = () => { load(committed(LANES.a), { scramble: 0, from: 'proof' }); $('simulator').scrollIntoView({ block: 'start' }); $('scramble').focus({ preventScroll: true }); };
$('p-tree').onclick = () => { load([], { scramble: 0 }); setBranch(committed(LANES.a)); $('boom').scrollIntoView({ block: 'start' }); };

/* ---------------- §2 experiment: worker, job ids, snapshot ---------------- */
let snapshot = null, current = null, worker = null, workerFailed = false, jobSeq = 0, activeRun = 0, selectedBin = null;
const params = validateParams(Object.fromEntries(new URLSearchParams(location.search)));
$('e-steps').value = String(params.steps); $('e-seed').value = String(params.seed);
if (![...$('e-n').options].some(o => o.value === String(params.samples))) $('e-n').append(new Option(String(params.samples)));
$('e-n').value = String(params.samples);
const formParams = () => validateParams({ steps: $('e-steps').value, seed: $('e-seed').value, n: $('e-n').value });

function getWorker() {
  if (worker || workerFailed) return worker;
  try {
    worker = new Worker(new URL('./lab-worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = onWorkerMessage;
    worker.onerror = event => {                         // startup or runtime failure: fall back to the main thread
      event.preventDefault(); worker = null; workerFailed = true;
      for (const cb of distanceCallbacks.values()) cb(null);
      distanceCallbacks.clear();
      if (activeRun) runLive(); else refreshDistance();
    };
  } catch { worker = null; workerFailed = true; }
  return worker;
}
function setRunning(on) { $('e-run').disabled = on; $('e-cancel').disabled = !on; }
function runLive() {
  const p = formParams();
  const job = activeRun = ++jobSeq;
  selectedBin = null; $('inspect').hidden = true;
  setRunning(true); $('e-meta').textContent = t('meta_running', { done: 0, total: fmt(2 * p.samples) });
  const w = getWorker();
  if (w) { w.postMessage({ job, type: 'run', params: p, keepTrials: true }); return; }
  setTimeout(() => {                                   // fallback: same pure code on the main thread
    if (job !== activeRun) return;
    const t0 = performance.now(); const ball = mainBall(); const tb = performance.now() - t0; const t1 = performance.now();
    const results = GENERATORS.map(generator => runExperiment({ generator, ...p, ball, keepTrials: true }));
    const exact = p.steps === 2 ? GENERATORS.map(generator => exactDistribution(generator, 2, ball)) : null;
    onRunDone({ job, params: p, radius: ball.radius, results, exact, timing: { ballMs: tb, runMs: performance.now() - t1, includesTable: tb > 1 }, mainThread: true });
  }, 30);
}
let mainBallCache = null;
const mainBall = () => (mainBallCache ||= buildBall());
function onWorkerMessage({ data }) {
  if (data.type === 'distances') return onDistances(data);
  if (data.job !== activeRun) return;                  // stale: rerun, cancel or teardown happened
  if (data.type === 'progress') $('e-meta').textContent = t('meta_running', { done: fmt(data.done), total: fmt(data.total) });
  if (data.type === 'done') onRunDone(data);
  if (data.type === 'error') { $('e-meta').textContent = t('meta_error', { m: data.message }); setRunning(false); }
}
function onRunDone(data) {
  setRunning(false); activeRun = 0;
  current = { source: 'live', ...data };
  renderExperiment();
  history.replaceState(null, '', shareURL(data.params, false));
}
$('e-cancel').onclick = () => {
  activeRun = 0;
  if (worker) { worker.terminate(); worker = null; }      // hard stop; next run starts a fresh worker
  setRunning(false); $('e-meta').textContent = t('meta_cancel');
};
$('exp-form').onsubmit = event => {
  event.preventDefault();
  if (/^(0x)?c0ffee$/i.test($('e-seed').value.trim())) { $('e-seed').value = String(0xC0FFEE); window.cubeCoffee?.open('seed'); }   // bean: seed c0ffee
  runLive();
};
function shareURL(p, absolute = true) {
  const q = new URLSearchParams({ exp: 'scramble', steps: p.steps, seed: p.seed, n: p.samples, v: LAB_VERSION });
  if (lang !== 'nl') q.set('lang', lang);
  return (absolute ? location.origin : '') + location.pathname + '?' + q + '#experiment';
}
$('e-share').onclick = async () => {
  const url = shareURL(current?.params || formParams());
  try { await navigator.clipboard.writeText(url); $('e-meta').textContent = t('copied') + ' · ' + url; }
  catch { $('e-meta').textContent = t('copy_fail') + ' ' + url; }
};
$('e-csv').onclick = () => {
  if (!current) return;
  const p = current.params;
  const results = current.results.map(r => ({ ...r, samples: p.samples, generator: r.generator }));
  const csv = toCSV(results, { ...p, radius: current.radius });
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = `cube-${LAB_VERSION.replace('/', '-')}-s${p.steps}-seed${p.seed}-n${p.samples}.csv`;
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
};

function renderExperiment() {
  if (!current) return;
  const { params: p, results, exact, radius } = current;
  const out = radius + 1;
  const binLabel = bin => bin > radius ? t('bin_out', { d: out }) : t('bin', { d: bin });
  const ms = v => fmt(v, 0) + ' ms';
  $('e-meta').textContent = current.source === 'snapshot'
    ? t('meta_snapshot', { v: LAB_VERSION, seed: p.seed, n: fmt(p.samples), r: radius })
    : t('meta_live', { v: LAB_VERSION, seed: p.seed, n: fmt(p.samples), r: radius, ball: current.timing.includesTable ? ms(current.timing.ballMs) : '0 ms (cached)', run: ms(current.timing.runMs) }) + (current.mainThread ? t('meta_main') : '') + (current.engine === 'rust-wasm' ? ' · engine: Rust → WebAssembly' : '');
  $('hists').replaceChildren(...results.map((result, g) => {
    const box = document.createElement('div'); box.className = 'hist';
    const h = document.createElement('h3');
    h.innerHTML = `${t('gen_' + result.generator)} <small>· ${t('gen_' + result.generator + '_sub')}</small>`;
    box.append(h);
    result.bins.forEach((count, bin) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'bin' + (bin > radius ? ' out' : '');
      const share = count / p.samples, ex = exact?.[g];
      const label = document.createElement('span');
      label.textContent = binLabel(bin);
      const track = document.createElement('span');
      track.className = 'track';
      const fill = document.createElement('span');
      fill.className = 'fill';
      fill.style.width = (share * 100).toFixed(3) + '%';
      track.append(fill);
      if (ex) {
        const marker = document.createElement('span');
        marker.className = 'exact';
        marker.style.left = 'calc(' + (100 * ex.bins[bin] / ex.denominator).toFixed(3) + '% - 1px)';
        track.append(marker);
      }
      const total = document.createElement('span');
      total.className = 'n';
      total.textContent = fmt(count) + ' · ' + fmt(100 * share, 1) + '%';
      b.append(label, track, total);
      b.setAttribute('aria-label', `${t('gen_' + result.generator)}, ${binLabel(bin)}: ${fmt(count)} / ${fmt(p.samples)}${ex ? `, ${t('exact')} ${ex.bins[bin]}/${ex.denominator}` : ''}`);
      b.setAttribute('aria-pressed', String(selectedBin?.g === g && selectedBin?.bin === bin));
      b.onclick = () => { selectedBin = { g, bin }; renderExperiment(); inspect(result, bin, binLabel(bin)); };
      box.append(b);
    });
    return box;
  }));
  const [u, d] = results, P = (r, bin) => pct(r.bins[bin], p.samples);
  const within2 = r => pct(r.bins[0] + r.bins[1] + r.bins[2], p.samples);
  $('e-summary').textContent = p.steps === 2
    ? t('sum_2', { u0: P(u, 0), d0: P(d, 0) })
    : t('sum_n', { s: p.steps, u0: P(u, 0), d0: P(d, 0), u2: within2(u), d2: within2(d), uo: fmt(u.bins[out]), do: fmt(d.bins[out]), n: fmt(p.samples) });
  const head = `<tr><th>${t('bin', { d: '' }).replace(' = ', '')}</th>` + results.map((r, g) =>
    `<th>${t('gen_' + r.generator)} · ${t('count')}</th><th>${t('share_col')}</th>${exact ? `<th>${t('exact')}</th>` : ''}`).join('') + '</tr>';
  const rows = u.bins.map((_, bin) => `<tr><td>${binLabel(bin)}</td>` + results.map((r, g) =>
    `<td>${fmt(r.bins[bin])}</td><td>${pct(r.bins[bin], p.samples)}</td>${exact ? `<td>${exact[g].bins[bin]}/${exact[g].denominator} = ${pct(exact[g].bins[bin], exact[g].denominator)}</td>` : ''}`).join('') + '</tr>').join('');
  const totals = `<tr><td>Σ</td>` + results.map(r => `<td>${fmt(r.bins.reduce((a, b) => a + b, 0))}</td><td>100 %</td>${exact ? '<td></td>' : ''}`).join('') + '</tr>';
  $('e-table').innerHTML = `<thead>${head}</thead><tbody>${rows}${totals}</tbody>`;
  $('e-repro').textContent = t('repro', { s: p.steps, seed: p.seed, n: p.samples });
}
function inspect(result, bin, binText) {
  const box = $('inspect'); box.hidden = false;
  const example = result.examples[bin];
  if (!example) { box.textContent = t('none'); return; }
  box.innerHTML = '';
  box.append(t('inspect', { bin: binText, gen: t('gen_' + result.generator), trial: example.trial }));
  const code = document.createElement('code'); code.textContent = seqLabel(example.sequence); box.append(code, ' ');
  const open = document.createElement('button'); open.type = 'button'; open.textContent = t('open_sim');
  open.onclick = () => { load(example.sequence, { scramble: example.sequence.length, from: 'experiment' }); $('simulator').scrollIntoView({ block: 'start' }); };
  box.append(open);
}
async function loadSnapshot() {
  try {
    snapshot = await (await fetch(new URL('./lab-snapshot.json', import.meta.url))).json();
    const p = formParams();
    const run = snapshot.version === LAB_VERSION && snapshot.runs.find(r => r.steps === p.steps && r.seed === p.seed && r.samples === p.samples);
    if (run) { current = { source: 'snapshot', params: p, radius: snapshot.radius, results: run.results.map(r => ({ ...r, samples: p.samples })), exact: run.exact }; renderExperiment(); }
    if (!run) runLive();
  } catch { runLive(); }
}
$('e-steps').onchange = () => { const p = formParams(); const run = snapshot?.runs.find(r => r.steps === p.steps && r.seed === p.seed && r.samples === p.samples); if (run) { current = { source: 'snapshot', params: p, radius: snapshot.radius, results: run.results.map(r => ({ ...r, samples: p.samples })), exact: run.exact }; selectedBin = null; $('inspect').hidden = true; renderExperiment(); } else runLive(); };

/* ---------------- simulator (baseline behaviour, honest labels) ---------------- */
let state = stickers, path = [], branch = [], camera = 0, last = '', busy = false, playing = false, previewFrame, scrambleLength = 0, distanceText = '';
function solution() { return isSolved(state) ? [] : path.slice().reverse().map(inverse); }
function directionText(move) { return move.endsWith('2') ? t('half') : move.endsWith("'") ? t('ccw') : t('cw'); }
function update() {
  const pending = solution(), move = pending[0], canTurn = !busy && !playing;
  $('status').textContent = move ? t('status_mixed') : t('status_solved');
  $('last').textContent = last ? t('last', { m: label(last) }) : '—';
  $('instruction').textContent = move ? t('instr_move', { m: label(move), f: t('face_' + move[0]), dir: directionText(move) }) : t('instr_idle');
  $('solution').replaceChildren(...pending.map(value => { const item = document.createElement('li'); item.textContent = label(value); return item; }));
  $('step').disabled = !move || !canTurn;
  $('auto').disabled = !playing && (!move || busy);
  $('auto').textContent = playing ? t('pause') : t('play_hist');
  for (const control of $('moves').children) control.disabled = !canTurn;
  for (const id of ['scramble', 'reset', 'load', 'view']) $(id).disabled = busy;
  $('view').textContent = t('view', { n: camera + 1 });
  $('facts').innerHTML = `<div><dt>${t('f_scr')}</dt><dd>${scrambleLength}</dd></div><div><dt>${t('f_hist')}</dt><dd>${path.length}</dd></div><div><dt>${t('f_dist')}</dt><dd id="f-dist">${distanceText}</dd></div>`;
  const colors = new Map(state.map(sticker => [key(sticker), sticker]));
  $('net').replaceChildren(...Object.keys(faces).map(face => {
    const block = document.createElement('div'); block.className = 'net-face';
    const title = document.createElement('strong'); title.textContent = face; block.append(title);
    for (const position of stickers.filter(sticker => sticker.face === face)) {
      const sticker = colors.get(key(position));
      const tile = document.createElement('span'); tile.style.background = sticker.color; tile.textContent = sticker.face;
      tile.setAttribute('role', 'img'); tile.setAttribute('aria-label', t('sticker_of', { f: sticker.face })); block.append(tile);
    }
    return block;
  }));
}
// Shortest distance: exact up to 2 immediately, then exact up to 4 (or a lower bound) from the worker.
let distJob = 0;
const distanceCallbacks = new Map();
function requestDistances(sequences, callback) {
  const job = ++jobSeq; distanceCallbacks.set(job, callback);
  const w = getWorker();
  if (w) w.postMessage({ job, type: 'distances', sequences });
  else { const ball = mainBall(); callback(sequences.map(s => distanceOf(ball, applySequence(s))), ball.radius); distanceCallbacks.delete(job); }
}
function onDistances({ job, distances, radius }) { const cb = distanceCallbacks.get(job); distanceCallbacks.delete(job); cb?.(distances, radius); }
function refreshDistance() {
  const local = distanceOf(smallBall, applySequence(path));
  if (local !== null) { distanceText = t('exact_d', { d: local }); update(); return; }
  distanceText = t('pending'); update();
  const mine = ++distJob, snapshotPath = path.slice();
  requestDistances([snapshotPath], (result, radius) => {
    if (mine !== distJob || !result) return;
    const [d] = result;
    distanceText = d === null ? t('at_least', { d: radius + 1, r: radius }) : t('exact_d', { d });
    update();
  });
}
function animate(move) {
  const start = performance.now(), duration = reducedMotion.matches ? 0 : move.endsWith('2') ? 420 : 310;
  return new Promise(resolve => {
    function frame(now) {
      const progress = duration ? Math.min(1, (now - start) / duration) : 1;
      draw($('cube'), turn(state, move, 1 - (1 - progress) ** 3), turnInfo(move), camera);
      progress < 1 ? requestAnimationFrame(frame) : resolve();
    }
    requestAnimationFrame(frame);
  });
}
function button(name, action) { const element = document.createElement('button'); element.type = 'button'; element.textContent = name; element.addEventListener('click', action); return element; }
async function perform(move) {
  if (busy) return;
  busy = true; update();
  await animate(move);
  state = turn(state, move);
  path = isSolved(state) ? [] : updatePath(path, move);
  last = move; branch = []; busy = false;
  refresh();
}
function refresh() { draw($('cube'), state, last ? turnInfo(last) : undefined, camera); refreshDistance(); renderTree(); }
function load(nextPath, { scramble = scrambleLength, from = null } = {}) {
  if (busy) return;
  playing = false; path = nextPath; state = apply(stickers, path);
  if (isSolved(state)) path = [];
  last = nextPath.at(-1) || ''; branch = []; scrambleLength = scramble;
  const back = $('backlink'); back.hidden = !from;
  if (from) {
    back.textContent = from === 'proof' ? t('back_proof') : t('back_exp'); back.href = '#' + (from === 'proof' ? 'proof' : 'experiment');
    history.pushState({ cubeFrom: from }, '', location.pathname + location.search + '#simulator');   // browser Back returns to the source
  }
  refresh();
}
$('backlink').onclick = event => { if (history.state?.cubeFrom) { event.preventDefault(); history.back(); } };
addEventListener('popstate', () => { const target = document.getElementById(location.hash.slice(1)); if (target && location.hash !== '#simulator') { $('backlink').hidden = true; target.scrollIntoView({ block: 'start' }); } });
for (const suffix of ['', "'", '2']) for (const face of Object.keys(faces)) {
  const move = face + suffix, control = button(label(move), () => perform(move));
  control.style.setProperty('--face', faces[face][2]); $('moves').append(control);
}
$('scramble').onclick = () => {
  const scramble = [], n = Number($('length').value);
  do { scramble.length = 0; for (let i = 0; i < n; i++) { const options = moves.filter(move => move[0] !== scramble.at(-1)?.[0]); scramble.push(options[Math.floor(Math.random() * options.length)]); } }
  while (isSolved(apply(stickers, scramble)));
  load(scramble, { scramble: n });
};
$('reset').onclick = () => load([], { scramble: 0 });
// optimal solve with the C → WebAssembly solver (meet in the middle, ≤ 8 moves); plays the shortest path
let C_SOLVER = null; const solverButton = $('csolve'); solverButton.disabled = true;
import('./solver.js').then(m => m.loadSolver()).then(s => { C_SOLVER = s; solverButton.disabled = false; }).catch(() => { $('csolve').hidden = true; });
$('csolve').onclick = async () => {
  if (!C_SOLVER || busy || playing) return; const b = solverButton, label = '⚡ optimal · C';
  const t0 = performance.now(), sol = C_SOLVER.solve(posFromStickers(state)), ms = (performance.now() - t0).toFixed(0);
  if (sol === null) { b.textContent = '> 8 · C'; setTimeout(() => b.textContent = label, 2200); return; }
  b.textContent = `${sol.length} · ${ms} ms · C`; playing = true; update();
  for (const m of sol) { if (!playing) break; await perform(m); }
  playing = false; update(); setTimeout(() => b.textContent = label, 2600);
};
$('step').onclick = () => { const [move] = solution(); if (move) perform(move); };
$('auto').onclick = async () => {
  if (playing) { playing = false; update(); return; }
  playing = true; update();
  while (playing && solution().length) await perform(solution()[0]);
  playing = false; update();
};
$('view').onclick = () => { camera = (camera + 1) % 4; refresh(); };
document.addEventListener('keydown', event => {
  if (event.repeat || event.altKey || event.ctrlKey || event.metaKey || playing || busy || event.target.closest('select, input, textarea, [contenteditable], summary')) return;   // buttons do not consume letters
  const face = event.key.toUpperCase();
  if (Object.hasOwn(faces, face)) perform(face + (event.shiftKey ? "'" : ''));
});

/* ---------------- decision tree: 18 legal actions, bounded graph annotation ---------------- */
function setBranch(next) { branch = next; renderTree(); $('trail').lastElementChild?.focus({ preventScroll: true }); }
function treeNode(name, configuration, action, note) {
  const node = action ? button('', action) : document.createElement('div');
  node.className = 'tree-node';
  const canvas = document.createElement('canvas'); canvas.width = 120; canvas.height = 100; canvas.setAttribute('aria-hidden', 'true');
  const title = document.createElement('strong'); title.textContent = name;
  node.append(canvas, title);
  if (note) { const small = document.createElement('small'); small.className = 'conv'; small.textContent = note; node.append(small); }
  draw(canvas, configuration, undefined, camera, 1.45);
  return { node, canvas };
}
// From the tree root: every path of length <= 2 (18 + 324 = 342), deduplicated by canonical state key.
function boundedGraph(rootPos) {
  const first = new Map([[stateKey(rootPos), []]]);
  const convergent = [];
  let paths = 0;
  for (const m1 of moves) {
    const p1 = applyMove(rootPos, m1), k1 = stateKey(p1); paths++;
    if (first.has(k1)) convergent.push([[m1], first.get(k1)]); else first.set(k1, [m1]);
  }
  for (const m1 of moves) {
    const p1 = applyMove(rootPos, m1);
    for (const m2 of moves) {
      const k2 = stateKey(applyMove(p1, m2)); paths++;
      if (first.has(k2)) convergent.push([[m1, m2], first.get(k2)]); else first.set(k2, [m1, m2]);
    }
  }
  return { first, paths, unique: first.size - 1, convergent };
}
function renderTree() {
  cancelAnimationFrame(previewFrame);
  const rootPos = posFromStickers(state);
  const graph = boundedGraph(rootPos);
  const note = seq => {                                  // ≡ shorter path to the same state, if the bounded graph knows one
    let pos = rootPos; for (const m of seq) pos = applyMove(pos, m);
    const shorter = graph.first.get(stateKey(pos));
    if (shorter && shorter.length < seq.length) return t('same_as', { p: shorter.length ? seqLabel(shorter) : t('root') });
    if (seq.length > 2) {                                 // beyond the budget: compare against depth <= 2 only
      for (const [k, p] of graph.first) if (k === stateKey(pos) && p.length < seq.length) return t('same_as', { p: p.length ? seqLabel(p) : t('root') });
    }
    return null;
  };
  const prefixes = [t('current'), ...branch.map(label)];
  let current = state;
  $('trail').replaceChildren(...prefixes.map((name, index) => {
    const control = button(name, () => setBranch(branch.slice(0, index)));
    if (index === branch.length) control.setAttribute('aria-current', 'step');
    return control;
  }));
  $('root').replaceChildren(...prefixes.map((name, index) => {
    if (index) current = turn(current, branch[index - 1]);
    const solved = isSolved(current);
    return treeNode(solved ? name + ' ✓' : name, current, index < branch.length ? () => setBranch(branch.slice(0, index)) : undefined, index ? note(branch.slice(0, index)) : null).node;
  }));
  const previews = moves.map(move => {
    const name = label(move), open = () => setBranch([...branch, move]), configuration = turn(current, move);
    const n = note([...branch, move]);
    const { node, canvas } = treeNode(name, configuration, open, n);
    node.setAttribute('aria-label', t('open_after', { m: name }) + (isSolved(configuration) ? ', ' + t('solved_short') : '') + (n ? ', ' + n : ''));
    const entry = document.createElement('li');
    entry.append(button(name + (isSolved(configuration) ? ' · ' + t('solved_short') : '') + (n ? ' ' + n : ''), open));
    return { node, canvas, move, entry };
  });
  $('branches').replaceChildren(...previews.map(preview => preview.node));
  $('permutations').replaceChildren(...previews.map(preview => preview.entry));
  $('back').disabled = !branch.length;
  const examples = graph.convergent.filter(([a, b]) => b.length === a.length).slice(0, 3)
    .concat(graph.convergent.filter(([a, b]) => b.length < a.length).slice(0, 5));
  $('graph').innerHTML = t('graph', { u: fmt(graph.unique), c: fmt(graph.convergent.length) }) +
    `<div>${t('graph_ex')}</div><ul>${examples.map(([a, b]) => `<li>${seqLabel(a)} ≡ ${b.length ? seqLabel(b) : t('root')}</li>`).join('')}</ul>`;
  $('replay').onclick = () => {
    cancelAnimationFrame(previewFrame);
    const start = performance.now();
    function frame(now) {
      const progress = reducedMotion.matches ? 1 : Math.min(1, (now - start) / 650);
      for (const { canvas, move } of previews) draw(canvas, turn(current, move, progress), turnInfo(move), camera, 1.45);
      if (progress < 1) previewFrame = requestAnimationFrame(frame);
    }
    previewFrame = requestAnimationFrame(frame);
  };
}
$('back').onclick = () => setBranch(branch.slice(0, -1));
$('load').onclick = () => { load(branch.reduce(updatePath, path)); $('scramble').focus(); $('cube-label').scrollIntoView({ block: 'start' }); };

/* ---------------- language + boot ---------------- */
function applyLang() {
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-html]').forEach(el => { el.innerHTML = t(el.dataset.i18nHtml); });
  $('cube').setAttribute('aria-label', t('cube'));
  renderProof(); update(); refresh(); renderExperiment();
}
$('version').textContent = LAB_VERSION;
addEventListener('pagehide', () => { worker?.terminate(); worker = null; activeRun = 0; });
applyLang();
mountPolyglot(code => { lang = code; applyLang(); });
loadSnapshot();
if (new URLSearchParams(location.search).get('exp') === 'scramble') requestAnimationFrame(() => $('experiment').scrollIntoView({ block: 'start' }));
if (new URLSearchParams(location.search).has('demo')) setTimeout(() => $('compare').click(), 600);
