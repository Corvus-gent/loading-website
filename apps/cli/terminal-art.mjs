export const TAGLINE = 'Luma is sinking. The Hackers Bay is coming.';
export const TYPES = ['hacker', 'builder', 'connector', 'investor'];
export const CLASSES = ['Deckhand', 'Navigator', 'Quartermaster', 'Merchant'];
export const KITS = {
  hat: ['Tricorn', 'Captain hat', 'Bandana', 'Beanie', 'Crown'],
  eyes: ['Amber shades', 'Eyepatch', 'Goggles', 'Teal shades', 'Visor'],
  coat: ['Hoodie', 'Two-tone coat', 'Vest', 'Captain coat', 'Sonar jacket'],
  item: ['Laptop', 'Cutlass', 'Spyglass', 'Coffee flask', 'Treasure map']
};

const names = ['Tide Byte','Cinder Voss','Patch Reed','Salt Shard','Brass Wake','Bit Marlow','Copper Byte','Keel Finn'];
const random = max => Math.floor(Math.random() * max);
const calm = '\x1b[0m';

export function cleanName(value) {
  return typeof value === 'string'
    ? value.replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, '').trim().slice(0, 48)
    : '';
}

export function classIndex(value) {
  const query = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return CLASSES.findIndex((label, i) => label.toLowerCase() === query || TYPES[i] === query);
}

export function randomPirate(index = random(CLASSES.length), name = '') {
  return {
    name: cleanName(name) || names[random(names.length)],
    type: TYPES[index], class: CLASSES[index],
    kit: Object.fromEntries(Object.entries(KITS).map(([key, options]) => [key, random(options.length)]))
  };
}

function pixels(rows, palette, ansi) {
  return rows.map(row => Array.from(row, code => {
    if (!palette[code]) return '  ';
    return ansi ? '\x1b[48;5;' + palette[code] + 'm  ' + calm : code === 'o' ? '░░' : '██';
  }).join('')).join('\n');
}

export function pirateArt(pirate, ansi = true) {
  const hat = [
    ['   hhhhhh    ', ' hhhtthhhhhh ', 'hhhhhhhhhhhh '],
    ['  hhhhhhhh   ', '  hhhtthhh   ', ' hhhhhhhhhhh '],
    ['             ', '  bbbbbbbb   ', ' bbbbbbbbbbo '],
    ['   hhhhhh    ', '  hhhhhhhh   ', '  hhtthhhh   '],
    ['  t t  t t   ', '  tttttttt   ', '  tttttttt   ']
  ][pirate.kit.hat];
  const eyeRow = ['bfyyfyfb','bhooffbb','bttyttbb','btttttbb','bttttthb'][pirate.kit.eyes];
  return pixels([
    ...hat, '  bbbbbbbb   ', '  ' + eyeRow + 'yy ', '  bbffbbbbbyh',
    '  bbbbbbbbby ', '   bbbbbbh   ', '  cccbbccc   ', ' cccccccccii ', ' cccccccciii ',
    '  c  o  c    ', ' bb     bb   ', ' oo     oo   '
  ], {
    h: 17, t: 49, b: [42,33,196,230][TYPES.indexOf(pirate.type)], f: 255, y: 220,
    c: [26,33,44,172,43][pirate.kit.coat], i: [117,250,136,166,223][pirate.kit.item], o: 243
  }, ansi);
}

export function shipArt(ansi = true) {
  return pixels([
    '           rrrr            ',
    '           htt              ',
    '           h                ',
    '          tttt              ',
    '        ttttttt             ',
    '       ttttttt              ',
    '        tttt h              ',
    '    h       tttttt          ',
    '   ttt    ttttttt           ',
    '  tttt    tttttt            ',
    ' o    o    h        o       ',
    '  ooooooooohhhhhhhhhhh      ',
    '   htyhhhhhhhhhhhhh         ',
    '    hhhhhhhhhhhhhh    www   ',
    ' wwwwww      www       wwww '
  ], {r:196,t:43,h:17,o:94,y:221,w:31}, ansi);
}

export function welcome(ansi = true) {
  const captain = pirateArt({ type:'connector', kit:{hat:0,eyes:3,coat:0,item:0} },ansi).split('\n');
  const ship = shipArt(ansi).split('\n');
  return ship.map((row,i) => (captain[i] || ' '.repeat(26)) + '  ' + row).join('\n') + '\n' +
    (ansi ? '\x1b[1;38;5;49m' : '') + TAGLINE + (ansi ? calm : '') + '\n' +
    'Captain Squawk aboard The Black Commit\n\n' +
    'Build a pirate     /hackersbay/api/pirate?class=deckhand\n' +
    'Find three mates   /hackersbay/api/match?me=deckhand\n' +
    'Count the crew     /hackersbay/api/crew\n' +
    'Open the logbook   /hackersbay/squawk\n' +
    'Sink the rowboat   /hackersbay/sink/luma\n' +
    'See Demo Day       https://corvus.gent/hackersbay/cuts\n';
}

export function sinkFrame(frame, ansi = true) {
  const width = 57;
  const height = 12;
  const grid = Array.from({length:height}, () => Array(width).fill(' '));
  function put(x,y,text) {
    for (const [i,char] of Array.from(text).entries()) if (grid[y] && x+i >= 0 && x+i < width) grid[y][x+i] = char;
  }
  const passage = Math.max(0, frame - 7) * 3;
  put(8+passage,0, '⚑');
  put(8+passage,1,'|');
  put(7+passage,2,'/|');
  put(6+passage,3,'/▓|');
  put(5+passage,4,'/▓▓|');
  put(4+passage,5,'/▓▓▓|');
  put(2+passage,6,'\u005c██████████>');
  put(3+passage,7,'█████████');
  put(0,9, '~ '.repeat(29));
  put(0,10, ' ~'.repeat(29));
  put(0,11, '~ '.repeat(29));
  if (frame < 12) {
    const y = Math.min(9, 6 + Math.max(frame - 6, 0));
    put(41,y,'L U M A');
    put(39,y+1,'\u005c________/');
  }
  if (frame < 6) put(14 + frame*5, 5 - Math.round(Math.sin(frame/5*Math.PI)*3), '━●');
  if (frame >= 5 && frame <= 10) {
    const open = frame - 5;
    for (let i=0; i<14; i++) put(43 + (i%2?1:-1)*(1+i%7)*open, Math.max(2,7-(i%4)*open), i%3?'·':'✦');
  }
  if (frame >= 8) {
    for (let i=0; i<8; i++) put(34 + (i*5+(frame-8)*2)%19, 6+(i+frame)%4, i%2?'○':'•');
  }
  const palette = {'⚑':203,'▓':49,'█':25,'~':31,'✦':227,'·':117,'●':221,'━':221,'○':117,'•':245};
  const rows = grid.map(row => row.map(char => ansi && palette[char] ? '\x1b[38;5;' + palette[char] + 'm' + char + calm : char).join(''));
  return rows.join('\n') + '\n' + TAGLINE + '\n';
}
