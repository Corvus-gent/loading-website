import { faces, stickers, moves, turn, inverse, key, solvedKey, updatePath, turnInfo, rotate } from './model.js';

const $ = id => document.getElementById(id);
const label = move => move.replace("'", '′');
const isSolved = state => state.map(key).join(';') === solvedKey;
const apply = (state, path) => path.reduce((current, move) => turn(current, move), state);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let state = stickers;
let path = [];
let branch = [];
let camera = 0;
let last = '';
let busy = false;
let playing = false;
let previewFrame;

function draw(canvas, configuration, highlighted) {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  const scale = Math.min(width, height) * .165;
  const project = vector => {
    const [x, y, z] = rotate(rotate(vector, 1, [.61, 2.18, 3.72, 5.27][camera]), 0, -.56);
    return [width / 2 + x * scale, height / 2 - y * scale, z];
  };
  ctx.clearRect(0, 0, width, height);
  for (let axis = 0; axis < 3; axis++) {
    for (const layer of [-1, 0, 1]) {
      const active = highlighted?.axis === axis && highlighted.sign === layer;
      ctx.beginPath();
      for (let i = 0; i <= 72; i++) {
        const angle = i * Math.PI / 36;
        const point = [0, 0, 0];
        point[axis] = layer * .83;
        point[(axis + 1) % 3] = 1.55 * Math.cos(angle);
        point[(axis + 2) % 3] = 1.55 * Math.sin(angle);
        const [x, y] = project(point);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = active ? '#c9ff6b' : ['#a986e66b', '#82bbce6b', '#df9f726b'][axis];
      ctx.lineWidth = Math.max(.65, scale / (active ? 32 : 72));
      ctx.stroke();
    }
  }
  const dots = configuration.map(sticker => ({
    ...sticker,
    projected: project(sticker.position.map((value, axis) => value * .83 + sticker.normal[axis] * .48)),
  })).sort((a, b) => a.projected[2] - b.projected[2]);

  for (const { projected: [x, y, depth], color } of dots) {
    ctx.beginPath();
    ctx.arc(x, y, scale * (.055 + .009 * depth), 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.strokeStyle = '#111719';
    ctx.globalAlpha = depth < -.3 ? .68 : 1;
    ctx.lineWidth = Math.max(.55, scale * .022);
    ctx.fill();
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function animate(move) {
  const start = performance.now();
  const duration = reducedMotion.matches ? 0 : move.endsWith('2') ? 420 : 310;
  return new Promise(resolve => {
    function frame(now) {
      const progress = duration ? Math.min(1, (now - start) / duration) : 1;
      draw($('cube'), turn(state, move, 1 - (1 - progress) ** 3), turnInfo(move));
      if (progress < 1) requestAnimationFrame(frame);
      else resolve();
    }
    requestAnimationFrame(frame);
  });
}

function button(name, action) {
  const element = document.createElement('button');
  element.type = 'button';
  element.textContent = name;
  element.addEventListener('click', action);
  return element;
}

function solution() {
  return isSolved(state) ? [] : path.slice().reverse().map(inverse);
}

function update() {
  const pending = solution();
  const move = pending[0];
  const canTurn = !busy && !playing;
  $('status').textContent = move ? 'Door elkaar' : 'Opgelost ✓';
  $('last').textContent = last ? 'Laatste draai · ' + label(last) : '—';
  $('instruction').textContent = move
    ? label(move) + ' · Draai het vlak ' + faces[move[0]][3] + (move.endsWith('2') ? ' 180°.' : move.endsWith("'") ? ' tegen de klok in.' : ' met de klok mee.')
    : 'Elk vlak heeft één kleur. Start een scramble of probeer zelf een draai.';
  $('solution').replaceChildren(...pending.map(value => {
    const item = document.createElement('li');
    item.textContent = label(value);
    return item;
  }));
  $('step').disabled = !move || !canTurn;
  $('auto').disabled = !playing && (!move || busy);
  $('auto').textContent = playing ? 'Pauzeer' : 'Speel oplossing';
  for (const control of $('moves').children) control.disabled = !canTurn;
  for (const id of ['scramble', 'reset', 'load', 'view']) $(id).disabled = busy;
  const colors = new Map(state.map(sticker => [key(sticker), sticker]));
  $('net').replaceChildren(...Object.keys(faces).map(face => {
    const block = document.createElement('div');
    block.className = 'net-face';
    const title = document.createElement('strong');
    title.textContent = face;
    block.append(title);
    for (const position of stickers.filter(sticker => sticker.face === face)) {
      const sticker = colors.get(key(position));
      const tile = document.createElement('span');
      tile.style.background = sticker.color;
      tile.setAttribute('role', 'img');
      tile.setAttribute('aria-label', 'Sticker van vlak ' + sticker.face);
      block.append(tile);
    }
    return block;
  }));
}

async function perform(move) {
  if (busy) return;
  busy = true;
  update();
  await animate(move);
  state = turn(state, move);
  path = isSolved(state) ? [] : updatePath(path, move);
  last = move;
  branch = [];
  busy = false;
  refresh();
}

function refresh() {
  draw($('cube'), state, last ? turnInfo(last) : undefined);
  update();
  renderTree();
}

function load(nextPath) {
  if (busy) return;
  playing = false;
  path = nextPath;
  state = apply(stickers, path);
  if (isSolved(state)) path = [];
  last = nextPath.at(-1) || '';
  branch = [];
  refresh();
}

for (const suffix of ['', "'", '2']) {
  for (const face of Object.keys(faces)) {
    const move = face + suffix;
    const control = button(label(move), () => perform(move));
    control.style.setProperty('--face', faces[face][2]);
    $('moves').append(control);
  }
}

$('scramble').onclick = () => {
  const scramble = [];
  do {
    scramble.length = 0;
    for (let i = 0; i < Number($('length').value); i++) {
      const options = moves.filter(move => move[0] !== scramble.at(-1)?.[0]);
      scramble.push(options[Math.floor(Math.random() * options.length)]);
    }
  } while (isSolved(apply(stickers, scramble)));
  load(scramble);
};
$('reset').onclick = () => load([]);
$('step').onclick = () => {
  const [move] = solution();
  if (move) perform(move);
};
$('auto').onclick = async () => {
  if (playing) {
    playing = false;
    update();
    return;
  }
  playing = true;
  update();
  while (playing && solution().length) await perform(solution()[0]);
  playing = false;
  update();
};
$('view').onclick = () => {
  camera = (camera + 1) % 4;
  refresh();
};
document.addEventListener('keydown', event => {
  if (event.repeat || event.altKey || event.ctrlKey || event.metaKey || playing || busy ||
      event.target.closest('button, select, input, textarea, [contenteditable]')) return;
  const face = event.key.toUpperCase();
  if (Object.hasOwn(faces, face)) perform(face + (event.shiftKey ? "'" : ''));
});

function setBranch(next) {
  branch = next;
  renderTree();
  $('trail').lastElementChild?.focus();
}

function treeNode(name, configuration, action) {
  const node = action ? button('', action) : document.createElement('div');
  node.className = 'tree-node';
  const canvas = document.createElement('canvas');
  canvas.width = 120;
  canvas.height = 100;
  canvas.setAttribute('aria-hidden', 'true');
  const title = document.createElement('strong');
  title.textContent = name;
  node.append(canvas, title);
  draw(canvas, configuration);
  return { node, canvas };
}

function renderTree() {
  cancelAnimationFrame(previewFrame);
  const prefixes = ['Huidige stand', ...branch.map(label)];
  let current = state;
  $('trail').replaceChildren(...prefixes.map((name, index) => {
    const control = button(name, () => setBranch(branch.slice(0, index)));
    if (index === branch.length) control.setAttribute('aria-current', 'step');
    return control;
  }));
  const lineage = prefixes.map((name, index) => {
    if (index) current = turn(current, branch[index - 1]);
    const solved = isSolved(current);
    return treeNode(solved ? name + ' ✓' : name, current,
      index < branch.length ? () => setBranch(branch.slice(0, index)) : undefined).node;
  });
  $('root').replaceChildren(...lineage);
  const previews = moves.map(move => {
    const name = label(move);
    const open = () => setBranch([...branch, move]);
    const configuration = turn(current, move);
    const { node, canvas } = treeNode(name, configuration, open);
    node.setAttribute('aria-label', 'Open stand na ' + name + (isSolved(configuration) ? ', opgelost' : ''));
    const entry = document.createElement('li');
    entry.append(button(name + (isSolved(configuration) ? ' · opgelost' : ''), open));
    return { node, canvas, move, entry };
  });
  $('branches').replaceChildren(...previews.map(preview => preview.node));
  $('permutations').replaceChildren(...previews.map(preview => preview.entry));
  $('back').disabled = !branch.length;
  $('replay').onclick = () => {
    cancelAnimationFrame(previewFrame);
    const start = performance.now();
    function frame(now) {
      const progress = reducedMotion.matches ? 1 : Math.min(1, (now - start) / 650);
      for (const { canvas, move } of previews) draw(canvas, turn(current, move, progress), turnInfo(move));
      if (progress < 1) previewFrame = requestAnimationFrame(frame);
    }
    previewFrame = requestAnimationFrame(frame);
  };
}
$('back').onclick = () => setBranch(branch.slice(0, -1));
$('load').onclick = () => {
  load(branch.reduce(updatePath, path));
  $('scramble').focus();
  $('cube-label').scrollIntoView({ block: 'start' });
};
refresh();
