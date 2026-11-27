const faces = {
  U: [1, 1, '#fff0d6', 'boven'],
  R: [0, 1, '#ff536d', 'rechts'],
  F: [2, 1, '#68f3ae', 'voor'],
  D: [1, -1, '#f8df52', 'onder'],
  L: [0, -1, '#ff9b51', 'links'],
  B: [2, -1, '#6d9aff', 'achter'],
};
const moves = Object.keys(faces).flatMap(face => ['', "'", '2'].map(suffix => face + suffix));
const stickers = Object.entries(faces).flatMap(([face, [axis, sign, color]]) => {
  const rest = [0, 1, 2].filter(i => i !== axis);
  return Array.from({ length: 9 }, (_, index) => {
    const position = [0, 0, 0];
    const normal = [0, 0, 0];
    position[axis] = normal[axis] = sign;
    position[rest[0]] = Math.floor(index / 3) - 1;
    position[rest[1]] = index % 3 - 1;
    return { face, color, position, normal };
  });
});
const key = ({ position, normal }) => [...position, ...normal].join(',');
const solvedKey = stickers.map(key).join(';');

function turnInfo(move) {
  const [axis, sign] = faces[move[0]];
  const amount = move.endsWith('2') ? 2 : move.endsWith("'") ? -1 : 1;
  return { axis, sign, angle: -sign * amount * Math.PI / 2 };
}

function rotate(vector, axis, angle, snap = false) {
  const first = (axis + 1) % 3;
  const second = (axis + 2) % 3;
  const result = [...vector];
  const cos = Math.cos(angle), sin = Math.sin(angle);
  result[first] = vector[first] * cos - vector[second] * sin;
  result[second] = vector[first] * sin + vector[second] * cos;
  return snap ? result.map(Math.round) : result;
}

function turn(state, move, progress = 1) {
  const { axis, sign, angle } = turnInfo(move);
  return state.map(sticker => sticker.position[axis] === sign ? {
    ...sticker,
    position: rotate(sticker.position, axis, angle * progress, progress === 1),
    normal: rotate(sticker.normal, axis, angle * progress, progress === 1),
  } : sticker);
}

function inverse(move) {
  return move.endsWith('2') ? move : move.endsWith("'") ? move[0] : move + "'";
}

function updatePath(path, move) {
  const previous = path.at(-1);
  if (previous?.[0] !== move[0]) return [...path, move];
  const amount = value => value.endsWith('2') ? 2 : value.endsWith("'") ? 3 : 1;
  const sum = (amount(previous) + amount(move)) % 4;
  const prefix = path.slice(0, -1);
  return sum ? [...prefix, move[0] + ['', '', '2', "'"][sum]] : prefix;
}

export { faces, stickers, moves, turn, inverse, key, solvedKey, updatePath, turnInfo, rotate };
