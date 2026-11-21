export const CLASSES = {
  hacker: { name: 'Deckhand', role: 'Broke hacker', mark: '◈', pitch: 'Food, a bunk, and a prize that pays.' },
  builder: { name: 'Navigator', role: 'Busy CTO', mark: '⌁', pitch: 'A good room, a co-founder, a night worth it.' },
  connector: { name: 'Quartermaster', role: 'Organizer', mark: '✳', pitch: 'Find the best crew. Make warm intros without spam.' },
  investor: { name: 'Merchant', role: 'Investor / brand', mark: '◇', pitch: 'See if the crew and the projects are worth your gold.' }
};

export const OPTIONS = {
  skin: ['Copper', 'Mahogany', 'Porcelain', 'Umber', 'Ochre', 'Sea glass'],
  hat: ['Tricorn', 'Bandana', 'Captain hat', 'Beanie', 'Hoodie'],
  coat: ['Sonar teal', 'Cannon red', 'Night indigo', 'Ochre', 'Sea plum', 'Salt white'],
  eye: ['Eyepatch', 'Goggles', 'Monocle', 'VR visor'],
  item: ['Laptop-cutlass', 'Coffee flask', 'Spyglass', 'Treasure map', 'Wrench'],
  bird: ['Scarlet macaw', 'Blue-and-gold', 'Cockatoo', 'Grey parrot', 'Neon cyber parrot'],
  birdHat: ['Bare feathers', 'Tiny tricorn', 'Sailor cap', 'Gold crown']
};

export const PARROT_NAMES = ['Patch', 'Pebble', 'Packet', 'Sparks', 'Saffron', 'Gizmo', 'Flint', 'Biscuit', 'Loops', 'Nettle'];
export const DEFAULT_PIRATE = Object.freeze({skin:0, hat:0, coat:0, eye:0, item:0, bird:0, birdHat:1, birdName:'Patch'});

export function normalizePirate(value) {
  const pirate = {};
  for (const [key, options] of Object.entries(OPTIONS)) {
    const index = value?.[key];
    pirate[key] = Number.isInteger(index) && index >= 0 && index < options.length ? index : DEFAULT_PIRATE[key];
  }
  pirate.birdName = typeof value?.birdName === 'string' ? value.birdName.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 28) : '';
  return pirate;
}

export function seededPirate(seed) {
  let hash = 2166136261;
  for (const char of String(seed)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  const next = length => {
    hash ^= hash << 13;
    hash ^= hash >>> 17;
    hash ^= hash << 5;
    return (hash >>> 0) % length;
  };
  const pirate = Object.fromEntries(Object.entries(OPTIONS).map(([key, options]) => [key, next(options.length)]));
  pirate.birdName = PARROT_NAMES[next(PARROT_NAMES.length)];
  return pirate;
}

const INK = '#09121d';
const GOLD = '#ffc66b';
const LIGHT = '#f3e3c0';
const SKIN = [
  ['#dd966a','#a65540','#ffc498'], ['#8a563d','#563225','#c27a55'], ['#f8c7ad','#b77479','#ffe0bf'],
  ['#5a3a37','#35252c','#985d4d'], ['#b97b48','#854939','#edac6c'], ['#80b598','#467e79','#bedeb2']
];
const COAT = [
  ['#1e897d','#124e56','#44dfb3'], ['#963e4c','#59283e','#ff6c61'], ['#4d5796','#2f315d','#8497df'],
  ['#aa6135','#603d38','#f5bd67'], ['#925897','#502f66','#d58fba'], ['#aeae9c','#595d65','#f3e3c0']
];
const BIRD = [
  ['#ff5a4e','#9c374e','#32bad0','#fff3ca'], ['#29abe3','#265ba0','#ffe06f','#fff2b9'],
  ['#fff7dc','#b9b2aa','#f9c545','#ffefb2'], ['#a3b1be','#5d6582','#e94758','#e1e3d8'],
  ['#40f5b5','#226b77','#dd68ef','#efff9c']
];

export function pixelPainter(ctx) {
  function box(color, x, y, w, h) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  }
  // Scan integer rows so diagonals stay on the source pixel grid.
  function poly(color, points) {
    const rows = points.map(([, y]) => y);
    for (let y = Math.min(...rows); y < Math.max(...rows); y++) {
      const cuts = [];
      for (let i = 0; i < points.length; i++) {
        const [x1,y1] = points[i];
        const [x2,y2] = points[(i + 1) % points.length];
        if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) cuts.push(x1 + (y + .5 - y1) * (x2 - x1) / (y2 - y1));
      }
      cuts.sort((a,b) => a-b);
      for (let i = 0; i + 1 < cuts.length; i += 2) {
        const x = Math.round(cuts[i]);
        box(color, x, y, Math.round(cuts[i+1]) - x, 1);
      }
    }
  }
  return { box, poly };
}

export function paintParrot(ctx, pirate, x = 0, y = 0, flight = false) {
  const [feather, shadow, wing, cheek] = BIRD[pirate.bird];
  ctx.save();
  ctx.translate(x, y);
  const { box, poly } = pixelPainter(ctx);
  poly(INK, [[3,4],[9,4],[12,7],[15,7],[16,11],[12,12],[11,16],[7,18],[3,21],[1,20],[3,15],[2,10],[1,8]]);
  poly(shadow, [[4,12],[10,12],[8,16],[4,19],[3,18]]);
  poly(feather, [[4,5],[9,5],[12,8],[12,11],[10,12],[10,15],[7,17],[4,16],[3,10]]);
  poly(wing, flight ? [[7,11],[5,12],[1,10],[0,13],[4,16],[8,15]] : [[4,10],[8,11],[8,14],[5,16],[3,14]]);
  box(cheek, 8, 7, 3, 4);
  box(INK, 9, 7, 1, 2);
  box(GOLD, 12, 8, 3, 2);
  box('#cc863d', 12, 10, 2, 1);
  box(GOLD, 7, 17, 2, 1);
  if (pirate.bird === 2) box(GOLD, 5, 3, 2, 3);
  if (pirate.birdHat === 1) {
    poly(INK, [[1,3],[4,3],[5,1],[9,1],[10,3],[13,3],[11,6],[3,6]]);
    box(GOLD, 5, 4, 5, 1);
  } else if (pirate.birdHat === 2) {
    box(INK, 3, 2, 8, 4); box(LIGHT, 4, 2, 6, 2); box('#2a78ad', 3, 4, 9, 1);
  } else if (pirate.birdHat === 3) {
    poly(GOLD, [[3,1],[5,3],[7,0],[9,3],[11,1],[10,5],[4,5]]);
    box('#ff5a4e', 7, 3, 1, 1);
  }
  ctx.restore();
}

export function paintPirate(ctx, value, {parrot = true} = {}) {
  const pirate = normalizePirate(value);
  const { box, poly } = pixelPainter(ctx);
  const [skin, skinShade, blush] = SKIN[pirate.skin];
  const [coat, coatShade, trim] = COAT[pirate.coat];
  ctx.clearRect(0, 0, 48, 48);
  poly(INK, [[8,43],[8,36],[12,30],[17,27],[17,23],[13,22],[13,13],[16,8],[26,7],[33,11],[35,19],[33,25],[30,28],[35,29],[40,34],[42,40],[40,46],[9,46]]);
  poly(coatShade, [[9,42],[11,35],[15,30],[21,27],[29,28],[36,31],[40,36],[40,45],[10,45]]);
  poly(coat, [[11,38],[14,32],[20,30],[27,31],[33,30],[37,34],[39,40],[37,43],[12,43]]);
  poly(trim, [[16,30],[20,29],[22,32],[20,40],[18,41],[19,34]]);
  poly(trim, [[31,29],[34,31],[29,34],[30,40],[28,43],[26,36]]);
  poly('#c8c7a9', [[20,27],[29,27],[28,35],[25,39],[22,34]]);
  box(GOLD, 25, 38, 2, 2); box(GOLD, 25, 42, 2, 2);
  box(trim, 12, 39, 3, 2); box(INK, 18, 44, 3, 2); box(INK, 31, 43, 3, 3);
  poly(skinShade, [[15,14],[20,11],[29,11],[33,15],[34,21],[31,26],[28,29],[21,29],[16,24],[14,20]]);
  poly(skin, [[17,13],[28,12],[32,15],[32,21],[30,25],[27,27],[21,27],[17,23]]);
  box(blush, 18, 20, 3, 2); box(blush, 29, 20, 2, 2); box(skinShade, 24, 18, 2, 4);
  box(INK, 20, 16, 2, 3); box(INK, 28, 16, 2, 3); box(INK, 23, 24, 5, 1);
  box(LIGHT, 25, 23, 2, 1); box(GOLD, 15, 22, 2, 3);
  if (pirate.eye === 0) {
    poly(INK, [[15,14],[28,18],[30,20],[27,22],[24,21],[23,18],[15,16]]);
  } else if (pirate.eye === 1) {
    box(INK, 17, 16, 15, 5); box(trim, 19, 16, 4, 3); box(trim, 27, 16, 4, 3); box(LIGHT, 19, 16, 2, 1); box(LIGHT, 27, 16, 2, 1);
  } else if (pirate.eye === 2) {
    box(GOLD, 26, 15, 6, 5); box('#2b5968', 27, 16, 4, 3); box(LIGHT, 27, 16, 1, 1); box(GOLD, 31, 20, 1, 5);
  } else {
    box(INK, 16, 15, 17, 6); box('#405987', 17, 16, 15, 4); box('#74ffe2', 18, 16, 11, 1); box('#e28bfa', 30, 17, 2, 2);
  }
  if (pirate.hat === 0) {
    poly(INK, [[6,7],[11,7],[14,10],[17,5],[21,3],[29,3],[35,9],[40,6],[42,6],[41,12],[35,16],[13,17],[7,13]]);
    poly('#2b3142', [[8,8],[14,12],[20,5],[28,5],[35,11],[40,8],[39,12],[34,14],[13,15],[8,12]]);
    poly(GOLD, [[7,8],[13,13],[34,13],[41,8],[40,11],[35,15],[13,16],[8,12]]);
    box(LIGHT, 23, 7, 4, 3); box(INK, 24, 8, 1, 1); box(GOLD, 27, 8, 2, 1);
  } else if (pirate.hat === 1) {
    poly(INK, [[13,10],[18,5],[29,5],[35,10],[34,17],[16,17],[13,22],[9,22],[12,17]]);
    poly('#bd4655', [[14,10],[19,6],[28,6],[34,10],[33,15],[15,15],[13,20],[11,20]]);
    box('#ff7c6c', 18, 8, 12, 2); box(GOLD, 21, 11, 2, 2); box(GOLD, 28, 10, 2, 1);
  } else if (pirate.hat === 2) {
    poly(INK, [[12,10],[15,7],[16,5],[32,5],[36,8],[36,12],[39,14],[35,17],[14,17],[11,15]]);
    poly(LIGHT, [[14,10],[17,7],[32,7],[35,9],[34,13],[15,13]]);
    box('#32556b', 14, 12, 21, 3); box(GOLD, 21, 10, 6, 3); box(INK, 23, 10, 2, 2); box('#d39d61', 15, 15, 20, 1);
  } else if (pirate.hat === 3) {
    poly(INK, [[13,13],[13,9],[16,6],[19,4],[30,4],[34,8],[36,15],[34,17],[14,17]]);
    poly(coat, [[14,12],[17,7],[20,5],[29,5],[33,8],[35,14],[14,14]]);
    box(trim, 15, 13, 19, 3); box(coatShade, 19, 8, 2, 3); box(coatShade, 26, 7, 2, 4);
  } else {
    poly(INK, [[11,29],[10,16],[13,10],[17,6],[22,4],[31,4],[36,10],[38,18],[36,28],[31,28],[34,21],[31,12],[20,11],[15,18],[17,26],[20,29]]);
    poly(coat, [[12,27],[12,16],[15,10],[22,6],[31,6],[35,11],[36,18],[34,26],[33,26],[35,20],[32,11],[21,9],[15,15],[14,20],[16,26]]);
    box(trim, 17, 26, 1, 5); box(trim, 33, 26, 1, 4);
  }
  if (pirate.item === 0) {
    poly(INK, [[2,33],[11,33],[17,41],[15,45],[4,45],[1,41]]);
    poly('#394268', [[3,34],[11,34],[15,41],[5,41]]);
    box('#173f4c', 4, 36, 8, 4); box('#71ffe3', 6, 37, 4, 1); box(GOLD, 5, 42, 9, 1); box('#8b704a', 13, 43, 4, 2);
  } else if (pirate.item === 1) {
    box(INK, 4, 32, 9, 12); box('#67989e', 6, 34, 5, 8);
    box(LIGHT, 5, 36, 7, 3); box(GOLD, 6, 32, 5, 2);
  } else if (pirate.item === 2) {
    poly(INK, [[1,36],[4,31],[17,37],[16,42],[13,44]]);
    poly(GOLD, [[3,36],[5,33],[16,38],[14,42]]); box('#4de0c3', 2, 33, 3, 2); box('#6b4426', 7, 36, 4, 3);
  } else if (pirate.item === 3) {
    poly(INK, [[2,33],[9,32],[12,34],[17,33],[17,43],[11,45],[8,43],[3,44]]);
    poly(LIGHT, [[3,34],[9,33],[12,35],[16,34],[16,42],[11,44],[8,42],[4,43]]);
    box('#a4614d', 8, 36, 1, 5); box('#bd4655', 12, 38, 3, 1); box('#bd4655', 13, 37, 1, 3);
  } else {
    poly(INK, [[2,32],[4,30],[5,34],[8,34],[10,30],[13,33],[12,37],[10,39],[10,44],[5,45],[5,38],[2,36]]);
    poly('#91b4c2', [[3,32],[4,35],[9,35],[11,32],[12,34],[11,37],[9,38],[9,43],[6,43],[6,38],[3,36]]);
    box(trim, 6, 41, 3, 2);
  }
  box(skin, 13, 40, 3, 2); box(blush, 14, 40, 1, 1);
  if (parrot) paintParrot(ctx, pirate, 32, 15);
}

export function pixelCanvas(size, className) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  canvas.className = className;
  canvas.setAttribute('aria-hidden', 'true');
  return canvas;
}

export function crewSprite(pirate) {
  const canvas = pixelCanvas(48, 'crew-sprite');
  paintPirate(canvas.getContext('2d'), pirate);
  return canvas;
}

export function parrotSprite(pirate, flight = false) {
  const canvas = pixelCanvas(22, 'parrot-sprite');
  paintParrot(canvas.getContext('2d'), normalizePirate(pirate), 3, 0, flight);
  return canvas;
}
