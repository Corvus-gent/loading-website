import { paintParrot, DEFAULT_PIRATE, pixelPainter } from './pirate.js';

export const SEA_WIDTH = 208;
export const SEA_HEIGHT = 120;
export const SEA_LOOP = 16;
export const CANNON_BEAT = 3.9;
const WATER = 73;
const clamp = n => Math.max(0, Math.min(1, n));
const cells = (count, seed) => Array.from({length: count}, (_, i) => {
  const value = Math.sin(i * 128.12 + seed) * 43758.545;
  return value - Math.floor(value);
});
const stars = cells(220, 82);
const wakes = cells(360, 17);
const luma = [
  ['100','100','100','100','111'],
  ['101','101','101','101','111'],
  ['10001','11011','10101','10001','10001'],
  ['010','101','111','101','101']
].reduce((rows, letter) => rows.map((row, i) => row + '0' + letter[i]), ['', '', '', '', '']);
const braces = ['010010','100001','110011','100001','010010'];

function letters(box, pixels, color, x, y) {
  pixels.forEach((row, j) => [...row].forEach((bit, i) => { if (bit === '1') box(color,x+i,y+j,1,1); }));
}

function backdrop(canvas, dusk) {
  const ctx = canvas.getContext('2d');
  const { box, poly } = pixelPainter(ctx);
  const sky = dusk ? ['#161a3a','#2c2548','#4a3655','#74465c','#b76562'] : ['#091629','#112341','#183354','#225072','#457587'];
  const water = dusk ? ['#243959','#183752','#123149','#102c42','#0b2135'] : ['#17485a','#133f56','#10364d','#0e2d43','#0a2337'];
  sky.forEach((color, i) => box(color, 0, i * 15, SEA_WIDTH, 15));
  water.forEach((color, i) => box(color, 0, WATER + i * 10, SEA_WIDTH, 10));
  for (let i = 0; i < stars.length; i += 3) {
    const x = Math.floor(stars[i] * SEA_WIDTH);
    const y = Math.floor(stars[i+1] * 65);
    const intensity = stars[i+2];
    box(intensity > .7 ? '#f3dab4' : sky[Math.min(4, Math.floor(y / 15) + 1)], x, y, intensity > .91 ? 2 : 1, 1);
    if (intensity > .91) box('#a5909c', x, y-1, 1, 3);
  }
  poly(dusk ? '#f5a776' : '#eed3a2', [[151,14],[166,14],[166,16],[171,16],[171,19],[175,19],[175,24],[177,24],[177,42],[174,42],[174,48],[170,48],[170,51],[165,51],[165,53],[151,53],[151,51],[146,51],[146,48],[142,48],[142,43],[139,43],[139,24],[142,24],[142,19],[146,19],[146,16],[151,16]]);
  box(dusk ? '#f9ca95' : '#ffe5b3', 147, 23, 25, 2);
  box(dusk ? '#d68170' : '#b3a397', 140, 41, 36, 2);
  box(dusk ? '#d98976' : '#ccb48e', 144, 46, 28, 1);
  for (const [x,y,w] of [[5,36,25],[42,53,48],[133,57,39],[166,32,44],[118,40,32],[177,61,30]]) {
    box(sky[3], x+5, y, w-9, 1); box(sky[2], x, y+2, w, 2);
    box(sky[3], x+1, y+4, w-13, 1); box(sky[4], x+12, y+7, Math.round(w/3), 1);
  }
  poly(dusk ? '#4c4160' : '#26465e', [[0,68],[8,68],[8,64],[14,64],[14,60],[21,60],[23,63],[34,63],[36,67],[42,67],[43,70],[70,70],[72,74],[0,74]]);
  poly(dusk ? '#5c4763' : '#325775', [[137,73],[144,69],[153,69],[156,65],[164,65],[168,62],[176,62],[177,65],[183,65],[183,67],[195,67],[197,68],[208,68],[208,74]]);
  box(dusk ? '#bf806d' : '#668b90', 109, WATER, 99, 1);
}

function paintShip({box, poly}, x, y, flash) {
  const fill = (color, px, py, w, h) => box(color, x+px, y+py,w,h);
  const hull = (color, points) => poly(color, points.map(([px,py])=>[x+px,y+py]));
  fill('#372b32', 47, -59, 3, 62); fill('#c38f5a', 48, -60, 1, 63);
  fill('#54433f', 16, -39, 2, 42); fill('#8f7556', 76, -47, 2, 49);
  // Sails use opposing planes, stitched edges and a sonar badge.
  hull('#123347', [[16,-37],[38,-34],[43,-14],[12,-12],[8,-16],[13,-25]]);
  hull('#219787', [[17,-35],[37,-32],[39,-17],[15,-15],[11,-17]]);
  hull('#246166', [[22,-34],[37,-32],[39,-17],[20,-16],[24,-24]]);
  hull('#43e4ba', [[17,-35],[37,-32],[36,-30],[17,-32],[13,-22],[11,-22]]);
  hull('#142a3d', [[46,-48],[78,-44],[81,-35],[84,-26],[75,-20],[41,-24],[38,-29],[42,-35]]);
  hull('#226c68', [[47,-45],[77,-42],[79,-34],[82,-27],[75,-23],[42,-26],[40,-29]]);
  hull('#31b5a0', [[48,-45],[73,-42],[73,-36],[70,-25],[43,-26],[43,-29]]);
  hull('#45efc7', [[48,-45],[77,-42],[79,-38],[76,-38],[75,-40],[50,-42],[45,-33],[43,-33]]);
  hull('#678f82', [[75,-39],[79,-34],[82,-27],[76,-23],[70,-24],[76,-29]]);
  fill('#23595d', 55,-37,13,10); fill('#49d7b9',57,-35,9,6); fill('#226c68',58,-34,7,4);
  fill('#eff6bb',61,-32,2,1); fill('#44e7c4',59,-36,5,1); fill('#90e6a6',65,-31,2,1);
  hull('#226b70', [[80,-40],[92,-32],[93,-25],[89,-20],[82,-21],[86,-28]]);
  hull('#35c8ad', [[81,-40],[92,-32],[93,-28],[90,-28],[88,-33]]);
  fill('#a58762', 8,-37,38,1); fill('#a58762', 38,-46,42,1); fill('#c38f5a', 41,-24,43,1);
  fill('#7e6a56', 17,-12,1,13); fill('#7e6a56', 71,-23,1,23);
  hull('#0a182a', [[47,-62],[57,-61],[57,-60],[66,-60],[64,-55],[64,-52],[47,-53]]);
  letters(fill, braces, '#ffc66b', 51, -60);
  hull('#081323', [[0,-7],[9,-9],[10,-14],[22,-14],[24,-8],[77,-8],[78,-11],[89,-11],[91,-6],[103,-8],[96,7],[86,13],[18,13],[8,7]]);
  hull('#132638', [[4,-6],[23,-5],[79,-5],[97,-6],[92,5],[82,10],[19,10],[10,4]]);
  fill('#a17554', 10,-10,12,1); fill('#bc8e5d', 12,-5,81,2);
  fill('#35625e', 12,3,78,1); fill('#244252', 21,8,59,1);
  for (const px of [24,36,48,60,72,84]) {
    fill('#090f1c', px,-1,5,4); fill('#b27b47', px+1,0,3,2); fill('#ffc66b',px+1,0,2,1);
  }
  fill('#142635',84,-9,11,5); fill('#72807c',88,-9,11,2); fill('#090f1c',97,-8,3,3);
  fill('#ffc66b',10,-9,2,2); fill('#46dcb6',81,-8,2,2);
  if (flash) hull('#ffce78', [[99,-10],[103,-14],[104,-10],[111,-11],[107,-7],[111,-5],[103,-5],[102,-2],[99,-5]]);
}

function paintRowboat({box,poly}, x, y, submerged, time) {
  if (submerged < 1) {
    const drift = Math.floor(submerged * 6);
    const sink = Math.round(submerged * 15);
    const top = y + sink;
    poly('#252d40', [[x,top],[x+5,top+2],[x+27+drift,top+2],[x+33+drift,top-1],[x+31+drift,top+5],[x+26+drift,top+8],[x+7,top+8],[x+3,top+5]]);
    box('#7c8591',x+5,top+3,23+drift,2);
    box('#a8a8a5',x+7,top+4,19,1);
    box('#555c67', x+15, top-7, 1, 8);
    box('#c4c6c0', x+16, top-9, 6, 4);
    box('#62676f', x+11, top+7, 16, 1);
    if (submerged < .24) letters(box, luma, '#d2d2cd', x+8, y-18);
  }
  if (submerged > 0) {
    for (let i = 0; i < 12; i++) {
      const t = (time * 2.2 + i * .13) % 1;
      const bx = Math.round(x + 5 + i * 2.1 + Math.sin(i + t * 4) * 4);
      const by = Math.round(y + 8 - t * (8 + i % 6));
      if (submerged === 1 && t < .4) continue;
      box(i % 3 === 0 ? '#fff2c5' : '#6ccfce', bx, by, 2, 1);
      if (i % 3 === 0) box('#8be1d6',bx,by+1,1,1);
    }
  }
}

export function makeSea(canvas) {
  canvas.width = SEA_WIDTH;
  canvas.height = SEA_HEIGHT;
  const ctx = canvas.getContext('2d', {alpha:false});
  const paint = pixelPainter(ctx);
  const plates = [false, true].map(dusk => {
    const plate = document.createElement('canvas');
    plate.width = SEA_WIDTH;
    plate.height = SEA_HEIGHT;
    backdrop(plate, dusk);
    return plate;
  });

  return (seconds = 0, duskOnly = false) => {
    const t = seconds % SEA_LOOP;
    ctx.globalAlpha = 1;
    ctx.drawImage(plates[0], 0, 0);
    const dusk = duskOnly ? 1 : Math.max(0, Math.sin(t / SEA_LOOP * Math.PI) - .3);
    ctx.globalAlpha = dusk;
    ctx.drawImage(plates[1], 0, 0);
    ctx.globalAlpha = 1;

    const { box } = paint;
    for (let i = 0; i < wakes.length; i += 3) {
      const y = 76 + Math.floor(wakes[i+1] * 44);
      const x = Math.floor((wakes[i] * 208 + t * (1.4 + y/30)) % 211) - 3;
      const width = Math.floor(2 + wakes[i+2] * (y-65) * .32);
      const bright = (i + Math.floor(t * 4)) % 13;
      box(bright < 2 ? '#649c97' : bright < 6 ? '#326375' : '#21465e', x, y, width, 1);
    }

    const shipX = 12 + Math.round(t * 3.5);
    const shipY = 72 + Math.round(Math.sin(t * 2.4) * 2);
    const shot = (t - CANNON_BEAT) / .83;
    const contact = CANNON_BEAT + .83;
    const underwater = clamp((t - contact) / 1.65);
    const showBubbles = t < 9 ? underwater : 0;
    const rowX = 163 + Math.round(Math.sin(t * 2) * 2);
    const rowY = 76 + Math.round(Math.cos(t * 2) * 2);
    paintShip(paint, shipX, shipY, shot >= 0 && shot < .23);
    box('#407976',shipX+4,shipY+13,105,1);
    box('#698c87',shipX+18,shipY+15,44,1);
    if (underwater < 1 || showBubbles) paintRowboat(paint, rowX, rowY, underwater, t);
    if (shot >= 0 && shot < 1) {
      const x = Math.round(shipX + 102 + (rowX + 10 - shipX - 102) * shot);
      const y = Math.round(shipY - 8 - 54 * shot * (1-shot) + 12 * shot);
      box('#b66b42',x-8,y+2,6,1); box('#ffdf9b',x-6,y+1,5,2);
      box('#101923',x-1,y-1,4,4); box('#99a3a1',x,y-1,2,1);
    }
    if (t >= contact && t < contact + .36) {
      const d = Math.round((t - contact) * 16);
      box('#ffc66b',rowX+13-d,rowY-4,9+d*2,2);
      box('#fc9661',rowX+18,rowY-11-d,2,12+d*2);
      box('#ffeb9a',rowX+17,rowY-5,5,5);
    }

    for (const [offset, altitude, palette] of [[9,22,0],[111,43,1],[154,17,4]]) {
      const x = Math.floor(((offset + t * 11) % 240) - 16);
      const y = Math.round(altitude + Math.sin(t * 2.3 + offset) * 3);
      ctx.save();
      ctx.translate(x,y);
      ctx.scale(.55,.55);
      paintParrot(ctx, {...DEFAULT_PIRATE, bird:palette, birdHat:0}, 0, 0, Math.floor(t*7+offset)%2===0);
      ctx.restore();
    }
  };
}
