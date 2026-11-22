import { classArt, loadArt } from './art.js';

const W = 672;
const H = 350;
const floor = n => Math.round(n);
const masts = [66, 238, 410, 578];
const monkey = [
  '       bbbb    ', '     bbtttbb   ', '    btootttb   ', '    btttttbb   ',
  '    bbttbbb    ', '   bbbbb       ', ' bbbttbbb      ', 'bb bttb bb    b',
  '   bbbbtb bbbbb', '    bbbbbb     ', '    bb bb      ', '   bb   bb     ',
  '   tt   tt     '
];
const fur = {b:'#93604d',t:'#ffd090',o:'#151e22'};

function box(ctx,color,x,y,w,h) {
  ctx.fillStyle=color;
  ctx.fillRect(floor(x),floor(y),w,h);
}
function polygon(ctx,color,points) {
  ctx.fillStyle=color;
  ctx.beginPath();
  points.forEach(([x,y],i) => i ? ctx.lineTo(x,y) : ctx.moveTo(x,y));
  ctx.closePath();
  ctx.fill();
}
function cloud(ctx,x,y,scale) {
  const d=scale;
  box(ctx,'#234356',x,y,60*d,15*d);
  box(ctx,'#385b6e',x+10*d,y-8*d,38*d,11*d);
  box(ctx,'#598094',x+21*d,y-16*d,22*d,10*d);
}
function ship(ctx,x,y,i) {
  box(ctx,'#dcb88b',x,y-126,4,129);
  polygon(ctx,['#287c7c','#665287','#8a4a4c','#947044'][i],[[x+4,y-126],[x+43,y-115],[x+4,y-103]]);
  polygon(ctx,'#25384b',[[x-44,y],[x+50,y],[x+39,y+24],[x-30,y+24]]);
  box(ctx,'#a36747',x-44,y,94,5);
  box(ctx,'#d39f62',x-30,y+13,50,3);
  for(let j=0;j<3;j++) box(ctx,'#e0b464',x-20+j*17,y+7,3,5);
}

export async function startRaceScene(canvas, racers, onBeat) {
  const sprites = await Promise.all(racers.map(racer => loadArt(classArt(racer.type)).catch(() => null)));
  canvas.width=W;
  canvas.height=H;
  const ctx=canvas.getContext('2d');
  ctx.imageSmoothingEnabled=false;
  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  let frame;
  let stopped=false;
  const start=performance.now();
  const beats=[
    [0.2,'The four scouts hop aboard. Altitude shows their confidence.'],
    [1.3,'Gust off Pier 9 · the scouts dive to keep their balance.'],
    [2.35,'Cannonball to port · all four scouts dodge.'],
    [3.35,'An original pirate monkey swipes Navigator’s lead coin!'],
    [5.45,'Navigator gets the coin back. The finish is in sight.']
  ];
  let beat=0;
  let painted=-1;

  function draw(t) {
    const sky=ctx.createLinearGradient(0,0,0,H);
    sky.addColorStop(0,'#071522'); sky.addColorStop(.75,'#173f56'); sky.addColorStop(.76,'#198095'); sky.addColorStop(1,'#071e35');
    ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);
    for(let i=0;i<31;i++) box(ctx,i%4 ? '#466480' : '#ffd58b', (i*89+33)%W, (i*53+18)%182,2,2);
    for(let i=0;i<6;i++) cloud(ctx,((i*131+54-t*14)%(W+90)+W+90)%(W+90)-45,37+i%3*35,.65+i%2*.34);
    for(let i=0;i<22;i++) box(ctx,i%4 ? '#3695a6' : '#7abaaf',(i*89+t*(7+i%4*6))%W,270+i%7*11,18+i%5*6,2);
    masts.forEach((x,i) => ship(ctx,x,267+Math.sin(t*2+i)*3,i));

    if(t>2.25&&t<3.18) {
      const span=(t-2.25)/.93;
      const x=220+span*350, y=229-Math.sin(span*Math.PI)*120;
      box(ctx,'#ffc66b',x-19,y,16,4);
      box(ctx,'#141321',x-6,y-5,13,12);
    }
    const gust=t>1.15&&t<2.1;
    if(gust) for(let i=0;i<9;i++) box(ctx,'#c8faff', (i*83+t*91)%W,95+i%5*22,11+i%3*6,1);

    racers.forEach((racer,i) => {
      const lost=i===1&&t>3.29&&t<5.45 ? .14*Math.min(1,(t-3.29)*3,(5.45-t)*3) : 0;
      const p=Math.max(0,Math.min(1,t / racer.demoSeconds) - lost);
      const hops=p*3;
      const bounce=Math.abs(Math.sin(hops*Math.PI));
      const dive=gust ? 40*Math.sin((t-1.15)*Math.PI) : 0;
      const dodge=t>2.45&&t<3.15 ? -36*Math.sin((t-2.45)*Math.PI/.7) : 0;
      const x=45+578*p;
      const y=204-bounce*(26+racer.confidence*92)+dive+dodge+i%2*11;
      box(ctx,racer.color,x-9,y+42,16,2);
      if (sprites[i]) ctx.drawImage(sprites[i],floor(x-20),floor(y),42,46);
      else polygon(ctx,racer.color,[[x-10,y+16],[x+4,y],[x+16,y+12],[x+8,y+22]]);
    });

    if(t>2.8&&t<5.6) {
      const jump=(t-2.8)/2.8;
      const x=244+jump*163,y=139-Math.sin(jump*Math.PI)*58;
      ctx.strokeStyle='#b18e70';ctx.lineWidth=2;
      ctx.beginPath();ctx.moveTo(321,40);ctx.lineTo(x+15,y+8);ctx.stroke();
      monkey.forEach((row,j) => [...row].forEach((c,i) => {
        if(fur[c]) box(ctx,fur[c],x+i*2,y+j*2,2,2);
      }));
      if(t>3.3&&t<5.45) {
        box(ctx,'#c7914b',x+32,y+13,10,9); box(ctx,'#ffe797',x+34,y+14,5,5);
      }
    }
  }

  function play(now) {
    if(stopped)return;
    const t=(now-start)/1000;
    while(beat<beats.length&&t>=beats[beat][0]) onBeat(beats[beat++][1]);
    const sample=reduce ? Math.min(6.7,Math.floor(t)) : Math.min(8.3,t);
    if(sample!==painted) {
      draw(sample);
      painted=sample;
    }
    if(t<8.3) frame=requestAnimationFrame(play);
  }
  frame=requestAnimationFrame(play);
  return () => { stopped=true; cancelAnimationFrame(frame); };
}
