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

export async function makeArtworkSea(canvas) {
  const [plate, boat, flier] = await Promise.all([
    loadArt('hero-sea'), loadArt('hero-rowboat'), loadArt('squawk-flying').catch(() => null)
  ]);
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d',{alpha:false});
  ctx.imageSmoothingEnabled = false;

  return seconds => {
    const t = seconds % SHIP_LOOP;
    const pan = Math.round(Math.sin(t * .55) * 4);
    const bob = Math.round(Math.sin(t * 3.2) * 3);
    const sink = limit((t - IMPACT) / 2.1);
    const flash = t - IMPACT;
    const shot = (t - FIRE) / (IMPACT - FIRE);
    ctx.save();
    ctx.translate(pan,0);
    ctx.drawImage(plate,-6,0,WIDTH+12,HEIGHT);

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
      ctx.fillRect(x-24,y+1,20,3);
      ctx.fillStyle = '#03091a';
      ctx.fillRect(x-4,y-5,10,10);
      ctx.fillStyle = '#ffeab1';
      ctx.fillRect(x-2,y-4,3,3);
    }
    if (flash >= 0 && flash < .27) {
      const radius = Math.round(12 + flash * 70);
      ctx.fillStyle = '#ff904e';
      ctx.fillRect(521-radius,278,radius*2,4);
      ctx.fillRect(521,278-radius,4,radius*2);
      ctx.fillStyle = '#fff4bc';
      ctx.fillRect(516,269,13,14);
    }
    if (flash > 0 && flash < 3.8) {
      for (let i=0; i<13; i++) {
        const life = (t * 1.45 + i * .17) % 1;
        const x = Math.round(480 + i*8 + Math.sin(i + life*3)*7);
        const y = Math.round(326 - life*(18 + i%5*5));
        ctx.fillStyle = i%2 ? '#adfff5' : '#439fd0';
        ctx.fillRect(x,y,i%3+3,2);
        if (i%3===0) ctx.fillRect(x,y+3,2,2);
      }
    }
    if (flier && t > 4 && t < 8.3) {
      const flight = (t-4)/4.3;
      const x = Math.round(710 - flight * 810);
      const y = Math.round(84 + Math.sin(flight*Math.PI*4)*13);
      ctx.drawImage(flier,x,y,65,Math.floor(t*9)%2 ? 61 : 65);
    }
    ctx.restore();
  };
}
