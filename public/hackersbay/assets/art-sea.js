import { loadArt } from './art.js';

export const SHIP_LOOP = 13;
export const FIRE = 2.05;
export const IMPACT = 2.82;
export const IMPACT_CAPTION = 'WE BLASTED LUMA.';
export const SINK_CAPTION = 'Luma is sinking. The Hackers Bay is coming.';
const WIDTH = 672;
const HEIGHT = 384;
const WATERLINE = 333;
const HIT_X = 502;
const HIT_Y = 277;
const limit = n => Math.max(0, Math.min(1, n));
const letters = [
  ['10000','10000','10000','10000','10000','10000','11111'],
  ['10001','10001','10001','10001','10001','10001','01110'],
  ['10001','11011','10101','10101','10001','10001','10001'],
  ['01110','10001','10001','11111','10001','10001','10001']
];
const stars = [[361,37],[414,83],[507,58],[575,31],[625,59],[490,31],[636,134],[437,128],[281,28],[348,94],[592,105],[558,148],[640,42],[89,72],[323,132]];

export function battlePhase(seconds) {
  const age = seconds % SHIP_LOOP - IMPACT;
  if (age < 0) return 'aim';
  return age < 1.82 ? 'impact' : 'sink';
}

function block(ctx, color, x, y, w, h) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
}

function shape(ctx, color, points) {
  ctx.fillStyle = color;
  ctx.beginPath();
  points.forEach(([x,y], i) => i ? ctx.lineTo(x,y) : ctx.moveTo(x,y));
  ctx.closePath();
  ctx.fill();
}

function paintLuma(ctx, x, y, unit) {
  letters.forEach((letter, index) => letter.forEach((row, dy) => {
    for (let dx = 0; dx < row.length; dx++) {
      if (row[dx] === '1') block(ctx, '#f5f4ed', x + (dx + index * 6) * unit, y + dy * unit, unit, unit);
    }
  }));
}

function makeLumaBoat(canvas) {
  const boat = canvas.ownerDocument.createElement('canvas');
  boat.width = WIDTH;
  boat.height = HEIGHT;
  const ctx = boat.getContext('2d');

  // A flag, bridge and portholes make the silhouette read as a passenger boat.
  block(ctx, '#111824', 496, 36, 7, 149);
  shape(ctx, '#151d27', [[501,37],[632,37],[616,69],[634,103],[501,103]]);
  shape(ctx, '#626d78', [[505,41],[625,41],[612,69],[625,99],[505,99]]);
  block(ctx, '#818b95', 505, 41, 108, 5);
  paintLuma(ctx, 513, 55, 4);
  block(ctx, '#d0d2d2', 496, 36, 3, 146);
  block(ctx, '#aab2ba', 494, 32, 11, 6);
  block(ctx, '#101925', 470, 105, 23, 50);
  block(ctx, '#75808b', 473, 107, 17, 43);
  block(ctx, '#303e4d', 473, 108, 17, 10);

  shape(ctx, '#121b29', [[398,148],[506,148],[518,193],[582,193],[612,248],[381,248],[386,202],[397,202]]);
  shape(ctx, '#89949c', [[402,153],[501,153],[514,196],[577,196],[603,246],[386,246],[391,208],[402,208]]);
  block(ctx, '#c6cbd0', 404, 154, 97, 5);
  block(ctx, '#4a5665', 391, 213, 194, 28);
  block(ctx, '#d1d5d8', 391, 208, 194, 4);
  for (let i = 0; i < 4; i++) {
    block(ctx, '#233243', 412 + i * 20, 171, 15, 21);
    block(ctx, '#92aebd', 414 + i * 20, 173, 11, 5);
  }
  for (let i = 0; i < 8; i++) block(ctx, '#a1aab4', 401 + i * 23, 225, 12, 7);

  shape(ctx, '#101a27', [[346,243],[643,243],[668,232],[655,283],[628,319],[607,332],[391,332],[363,311],[351,282]]);
  shape(ctx, '#555f6b', [[352,248],[645,248],[659,241],[649,280],[622,314],[600,326],[394,326],[368,308],[356,279]]);
  shape(ctx, '#303b4a', [[362,300],[635,300],[622,314],[600,326],[394,326],[368,308]]);
  block(ctx, '#a7b1bb', 353, 248, 293, 5);
  block(ctx, '#697684', 373, 317, 241, 3);
  paintLuma(ctx, 410, 260, 8);
  return boat;
}

const crack = [[500,116],[494,175],[505,215],[493,242],[501,258],[494,273],[506,288],[495,313],[503,332]];
function half(ctx, boat, side, age) {
  const spread = Math.min(1, age / .75);
  const fall = limit((age - (side < 0 ? .5 : .2)) / (side < 0 ? 3.15 : 2.7));
  ctx.save();
  ctx.beginPath();
  ctx.rect(300, 0, WIDTH - 300, WATERLINE);
  ctx.clip();
  const travel = side < 0 ? 33 : 11;
  const lean = side < 0 ? .13 : .068;
  ctx.translate(HIT_X + side * (4 + travel * spread), WATERLINE + Math.round(fall ** 1.36 * 309));
  ctx.rotate(side * spread * (lean + fall * .32));
  ctx.translate(-HIT_X, -WATERLINE);
  ctx.beginPath();
  ctx.moveTo(side < 0 ? 320 : WIDTH, 0);
  ctx.lineTo(500, 0);
  crack.forEach(([x,y]) => ctx.lineTo(x,y));
  ctx.lineTo(side < 0 ? 320 : WIDTH, 346);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(boat,0,0);
  if (age < 1.1) {
    ctx.beginPath();
    crack.slice(3).forEach(([x,y],i) => i ? ctx.lineTo(x,y) : ctx.moveTo(x,y));
    ctx.lineWidth = 5;
    ctx.strokeStyle = age < .45 ? '#ffbd6b' : '#22252f';
    ctx.stroke();
  }
  ctx.restore();
}

function cannonShot(ctx, t) {
  const shot = (t - FIRE) / (IMPACT - FIRE);
  if (shot < 0 || shot >= 1) return;
  const x = Math.round(350 + shot * (HIT_X - 350));
  const y = Math.round(226 + shot * (HIT_Y - 226) - Math.sin(shot * Math.PI) * 28);
  if (shot < .23) {
    shape(ctx,'#ff993d',[[319,222],[341,215],[367,226],[341,236],[319,230]]);
    block(ctx,'#fff5c2',330,222,25,8);
  }
  for (let i = 1; i < 6; i++) block(ctx, i < 3 ? '#ffb763' : '#7e7775', x - i * 12, y + i % 2 * 6, 10, 5);
  block(ctx, '#100e18', x - 11, y - 9, 22, 18);
  block(ctx, '#100e18', x - 7, y - 12, 15, 24);
  block(ctx, '#ffdf9d', x - 6, y - 7, 7, 5);
}

function explosion(ctx, age) {
  if (age < 0 || age > 2.4) return;
  if (age < .56) {
    const radius = 34 + age * 122;
    const colors = ['#ef5838','#ff9b46','#ffdf78','#fff6d5'];
    ctx.globalAlpha = Math.min(1, (.56 - age) * 7);
    colors.forEach((color,i) => {
      const size = radius * (1 - i * .21);
      const points = Array.from({length:24},(_,j) => {
        const a = j * Math.PI / 12;
        const r = size * (j % 2 ? .48 : 1);
        return [Math.round(HIT_X + Math.cos(a) * r), Math.round(HIT_Y + Math.sin(a) * r * .83)];
      });
      shape(ctx,color,points);
    });
    ctx.globalAlpha = 1;
  }
  for (let i = 0; i < 27; i++) {
    const step = age - i % 5 * .023;
    if (step < 0) continue;
    const x = HIT_X + ((i * 53) % 193 - 96) * step * 1.7;
    const y = HIT_Y - (75 + i * 43 % 186) * step + 136 * step ** 2;
    if (y > WATERLINE + 5 || x < 0 || x > WIDTH) continue;
    ctx.save();
    ctx.translate(Math.round(x),Math.round(y));
    ctx.rotate((i%2 ? 1 : -1) * step * (2 + i % 4));
    block(ctx, ['#b6bec6','#f0b77c','#74655b','#3d4755'][i % 4],-4,-2,14 + i % 4 * 5,4 + i % 3);
    block(ctx, '#f7d8a7',-4,-2,4,2);
    ctx.restore();
  }
  if (age < 1.45) {
    for (let i = 0; i < 36; i++) {
      const x = HIT_X + ((i * 67) % 224 - 112) * age * 1.4;
      const y = WATERLINE - (65 + i * 29 % 151) * age + 140 * age ** 2;
      if (y <= WATERLINE) block(ctx, ['#3ee6c4','#c5fff2','#79d0ed','#fff1a4'][i % 4], x, y, 4 + i % 5, 5 + i % 8);
    }
  }
}

function aftermath(ctx, age) {
  if (age <= .26 || age > 7.9) return;
  ctx.globalAlpha = Math.min(1, (7.9 - age) / 1.4);
  for (let i = 0; i < 16; i++) {
    const life = (age * 1.25 + i * .17) % 1;
    const x = Math.round(405 + i * 14 + Math.sin(i + life * 3) * 9);
    const y = Math.round(337 - life * (22 + i % 7 * 11));
    const size = i % 4 * 2 + 4;
    ctx.strokeStyle = i % 2 ? '#b4fff6' : '#64c2e7';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, size, size);
  }
  for (let i = 0; i < 7; i++) {
    const float = Math.max(0, age - .32 - i * .055);
    if (!float) continue;
    const x = HIT_X + (i % 2 ? 1 : -1) * (i * 9 + float * (17 + i * 4));
    const y = Math.max(204 - i % 4 * 17, 304 - float * (85 + i * 6)) + Math.sin(float * 4 + i) * 5;
    const size = 14 + i % 3 * 4;
    block(ctx, '#373f4b',x - 1,y + 3,size + 2,size - 4);
    block(ctx, '#b4bac2',x + 4,y,size - 8,size);
    block(ctx, '#b4bac2',x,y + 4,size,size - 8);
    block(ctx, '#e0e3e8',x + 4,y + 3,5,3);
  }
  ctx.globalAlpha = 1;
}

export async function makeArtworkSea(canvas, load = loadArt) {
  const [clear, ship, flier] = await Promise.all([
    load('hero-sea-clear'), load('black-commit-passing'), load('squawk-flying').catch(() => null)
  ]);
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d',{alpha:false});
  ctx.imageSmoothingEnabled = false;
  const boat = makeLumaBoat(canvas);

  return seconds => {
    const t = seconds % SHIP_LOOP;
    const age = t - IMPACT;
    const pan = age >= 0 && age < .23 ? Math.round(Math.sin(age * 120) * 8 * (1 - age / .23)) : 0;
    const passage = limit((age - 1) / 8.4);
    ctx.drawImage(clear,0,0);
    ctx.save();
    ctx.translate(pan,0);
    for (const [i,[x,y]] of stars.entries()) {
      const flicker = Math.floor(t * 4 + i * 1.6) % 8;
      if (flicker <= 3) block(ctx, flicker === 3 ? '#9bd7f6' : '#ffe2a1', x,y,flicker < 1 ? 3 : 2,2);
    }
    const shipShift = Math.round(555 * passage);
    if (age < 1.2) ctx.drawImage(ship,-20+shipShift,46+Math.round(Math.sin(t*3)*2),650,354);
    if (age < 0) ctx.drawImage(boat,0,Math.round(Math.sin(t*3.2)*2));
    else if (age < 4) {
      half(ctx,boat,-1,age);
      half(ctx,boat,1,age);
    }
    if (age >= 1.2) ctx.drawImage(ship,-20+shipShift,46+Math.round(Math.sin(t*3)*2),650,354);
    for (let i=0; i<16; i++) block(ctx, i%3 ? '#32dcca88' : '#ffe4a8a0', (i*49 + t*(8+i%4*2))%WIDTH, 334+i%4*12, 8+i%4*6, 2);
    cannonShot(ctx,t);
    explosion(ctx,age);
    aftermath(ctx,age);
    if (flier && t > 5.2 && t < 9.5) {
      const flight = (t-5.2)/4.3;
      ctx.drawImage(flier,Math.round(710-flight*810),Math.round(84+Math.sin(flight*Math.PI*4)*13),65,Math.floor(t*9)%2 ? 61 : 65);
    }
    ctx.restore();
    return shipShift / WIDTH;
  };
}
