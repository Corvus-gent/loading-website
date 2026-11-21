import { loadArt } from './art.js';

export const SHIP_LOOP = 13;
export const FIRE = 2.05;
export const IMPACT = 2.82;
const WIDTH = 672;
const HEIGHT = 384;
const WATERLINE = 333;
const limit = n => Math.max(0, Math.min(1, n));
const stars = [
  [361,37],[414,83],[507,58],[575,31],[625,59],[490,31],[636,134],[437,128],
  [281,28],[348,94],[592,105],[558,148],[640,42],[89,72],[323,132]
];
const label = [
  ['100','100','100','100','111'],
  ['101','101','101','101','111'],
  ['10001','11011','10101','10001','10001'],
  ['010','101','111','101','101']
].reduce((rows,letter) => rows.map((row,i) => row + '0' + letter[i]), ['','','','','']);

function rowboatLabel(ctx, atX, atY) {
  ctx.fillStyle = '#071320';
  ctx.fillRect(atX - 3, atY - 3, 54, 20);
  ctx.fillStyle = '#f3e3c0';
  for (const [y,row] of label.entries()) for (let x=0; x<row.length; x++) {
    if (row[x] === '1') ctx.fillRect(atX + x * 3, atY + y * 3, 3, 3);
  }
}

export async function makeArtworkSea(canvas, load = loadArt) {
  const [plate, boat, flier, ship, clear] = await Promise.all([
    load('hero-sea'), load('hero-rowboat'), load('squawk-flying').catch(() => null),
    load('black-commit-passing').catch(() => null), load('hero-sea-clear').catch(() => null)
  ]);
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d',{alpha:false});
  ctx.imageSmoothingEnabled = false;

  return seconds => {
    const t = seconds % SHIP_LOOP;
    const flash = t - IMPACT;
    const shake = flash >= 0 && flash < .23 ? Math.round(Math.sin(flash * 120) * 10 * (1 - flash / .23)) : 0;
    const pan = Math.round(Math.sin(t * .55) * 4) + shake;
    const bob = Math.round(Math.sin(t * 3.2) * 3);
    const sink = limit((t - IMPACT) / 2.1);
    const shot = (t - FIRE) / (IMPACT - FIRE);
    ctx.save();
    ctx.translate(pan,0);
    ctx.drawImage(plate,-14,0,WIDTH+28,HEIGHT);
    const passage = ship && clear ? limit((flash - .65) / 7.4) : 0;
    if (passage > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, passage * 9);
      ctx.drawImage(clear,-14,0,WIDTH+28,HEIGHT);
      ctx.drawImage(ship,Math.round(-1 + 555 * passage),Math.round(Math.sin(t * 3) * 2),WIDTH,HEIGHT);
      ctx.restore();
    }

    for (const [i,[x,y]] of stars.entries()) {
      const flicker = (Math.floor(t * 4 + i * 1.6) % 8);
      if (flicker > 3) continue;
      ctx.fillStyle = flicker === 3 ? '#9bd7f6' : '#ffe2a1';
      ctx.fillRect(x + Math.round(pan * .5), y, flicker < 1 ? 3 : 2, 2);
    }

    if (sink < 1) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(424,0,WIDTH-424,WATERLINE);
      ctx.clip();
      ctx.translate(454 + Math.round(sink * 31),220 + bob + Math.round(sink * 146));
      ctx.rotate(sink * .26);
      ctx.drawImage(boat,0,0);
      ctx.restore();
      if (sink < .25) rowboatLabel(ctx,515,234 + bob);
    }
    for (let i=0; i<16; i++) {
      const x = Math.round((i*49 + t*(8+i%4*2))%WIDTH);
      const y = 316 + i%5*13;
      ctx.fillStyle = i%3 ? '#32dcca88' : '#ffe4a8a0';
      ctx.fillRect(x,y,8+i%4*6,2);
    }
    if (shot >= 0 && shot < 1) {
      const x = Math.round(398 + shot * 123);
      const y = Math.round(200 + shot * 82 - Math.sin(shot * Math.PI) * 45);
      ctx.fillStyle = '#ffce79';
      ctx.fillRect(x-40,y+1,34,5);
      ctx.fillStyle = '#03091a';
      ctx.fillRect(x-9,y-9,19,19);
      ctx.fillStyle = '#ffeab1';
      ctx.fillRect(x-5,y-7,5,5);
    }
    if (flash >= 0 && flash < .27) {
      const radius = Math.round(12 + flash * 70);
      ctx.fillStyle = '#ff904e';
      ctx.fillRect(521-radius,278,radius*2,4);
      ctx.fillRect(521,278-radius,4,radius*2);
      ctx.fillStyle = '#fff4bc';
      ctx.fillRect(516,269,13,14);
    }
    if (flash > 0 && flash < 1.3) {
      for (let i = 0; i < 39; i++) {
        const x = Math.round(523 + ((i * 67) % 186 - 93) * flash * 1.65);
        const y = Math.round(292 - (60 + i * 29 % 155) * flash + 150 * flash ** 2);
        if (y > 335) continue;
        ctx.fillStyle = ['#3ee6c4','#cdfffa','#79d0ed','#fff1a4'][i % 4];
        ctx.fillRect(x, y, 4 + i % 6, 5 + i % 8);
      }
    }
    if (flash > 0 && flash < 8) {
      ctx.globalAlpha = Math.min(1, (8 - flash) / 1.2);
      for (let i = 0; i < 18; i++) {
        const life = (flash * 1.35 + i * .17) % 1;
        const x = Math.round(445 + i * 10 + Math.sin(i + life * 3) * 9);
        const y = Math.round(330 - life * (20 + i % 7 * 9));
        const size = i % 4 * 2 + 3;
        ctx.strokeStyle = i % 2 ? '#adfff5' : '#439fd0';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, size, size);
      }
      for (let i = 0; i < 12; i++) {
        const pace = Math.max(0, flash - i * .037);
        const x = Math.round(520 + (i % 2 ? 1 : -1) * (i * 6 + pace * (8 + i * 3)));
        const y = Math.round(Math.max(258 - i % 4 * 12, 313 - pace * 125) + Math.sin(pace * 4 + i) * 4);
        const size = 10 + i % 4 * 3;
        ctx.fillStyle = i % 2 ? '#7c8695' : '#a2a8b1';
        ctx.fillRect(x + 3, y, size - 6, size);
        ctx.fillRect(x, y + 3, size, size - 6);
      }
      ctx.globalAlpha = 1;
    }
    if (flier && t > 4 && t < 8.3) {
      const flight = (t-4)/4.3;
      const x = Math.round(710 - flight * 810);
      const y = Math.round(84 + Math.sin(flight*Math.PI*4)*13);
      ctx.drawImage(flier,x,y,65,Math.floor(t*9)%2 ? 61 : 65);
    }
    ctx.restore();
    return passage * 555 / WIDTH;
  };
}
