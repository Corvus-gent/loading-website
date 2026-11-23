// A little magic: drifting motes of gold and plum light, a glimmer that
// follows the cursor, and a sprinkle when you open a door. Off with reduced motion.
const context2d = canvas => { try { return canvas.getContext('2d'); } catch { return null; } };
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
function mountMagic() {
  if (reduce.matches || document.querySelector('canvas.magic')) return;
  const canvas = document.createElement('canvas');
  canvas.className = 'magic'; canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:35;mix-blend-mode:screen';
  document.body.append(canvas);
  const ctx = context2d(canvas);
  if (!ctx) { canvas.remove(); return; }
  const COLORS = ['255,215,106', '255,236,170', '201,182,255', '170,140,255', '255,255,255'];
  const sprites = COLORS.map(c => {
    const s = document.createElement('canvas'); s.width = s.height = 32;
    const g = context2d(s);
    if (!g) return null;
    const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, `rgba(${c},1)`); grad.addColorStop(.25, `rgba(${c},.55)`); grad.addColorStop(1, `rgba(${c},0)`);
    g.fillStyle = grad; g.fillRect(0, 0, 32, 32); return s;
  });
  if (sprites.some(sprite => !sprite)) { canvas.remove(); return; }
  let w = 0, h = 0, dpr = 1;
  const size = () => { dpr = Math.min(2, devicePixelRatio || 1); w = innerWidth; h = innerHeight; canvas.width = w * dpr; canvas.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
  size(); addEventListener('resize', size);
  const rand = (a, b) => a + Math.random() * (b - a);
  const motes = [], sparks = [];
  const mote = (y = rand(0, h)) => ({x: rand(0, w), y, r: rand(2, 6), vy: rand(-.12, -.35), phase: rand(0, 6.28), sway: rand(.2, .7), sprite: Math.floor(Math.random() * 4), tw: rand(.6, 1.6)});
  const count = innerWidth < 700 ? 14 : 30;
  for (let i = 0; i < count; i++) motes.push(mote());
  const spark = (x, y, burst) => sparks.push({x, y, vx: burst ? rand(-2.4, 2.4) : rand(-.4, .4), vy: burst ? rand(-3, -.6) : rand(-.2, .6), life: 1, decay: burst ? rand(.018, .03) : rand(.025, .045), r: burst ? rand(3, 7) : rand(2, 5), sprite: Math.floor(Math.random() * COLORS.length)});
  if (matchMedia('(pointer: fine)').matches) {
    let last = 0;
    addEventListener('pointermove', e => { const t = performance.now(); if (t - last > 45) { last = t; spark(e.clientX, e.clientY, false); } }, {passive: true});
  }
  addEventListener('click', e => { if (e.target.closest('a,button')) for (let i = 0; i < 12; i++) spark(e.clientX, e.clientY, true); }, {passive: true});
  let raf = 0, t = 0;
  function frame() {
    t += 1;
    ctx.clearRect(0, 0, w, h);
    for (const m of motes) {
      m.y += m.vy; m.x += Math.sin(t * .01 + m.phase) * m.sway * .3;
      if (m.y < -20) Object.assign(m, mote(h + 20));
      const a = .25 + .35 * (0.5 + 0.5 * Math.sin(t * .02 * m.tw + m.phase));
      ctx.globalAlpha = a; ctx.drawImage(sprites[m.sprite], m.x - m.r * 2, m.y - m.r * 2, m.r * 4, m.r * 4);
    }
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i]; s.x += s.vx; s.y += s.vy; s.vy += .02; s.life -= s.decay;
      if (s.life <= 0) { sparks.splice(i, 1); continue; }
      ctx.globalAlpha = s.life * .9; const r = s.r * (0.6 + s.life * .6);
      ctx.drawImage(sprites[s.sprite], s.x - r * 2, s.y - r * 2, r * 4, r * 4);
    }
    ctx.globalAlpha = 1;
    raf = requestAnimationFrame(frame);
  }
  const run = () => { cancelAnimationFrame(raf); if (canvas.isConnected && !document.hidden && !reduce.matches && document.body.dataset.entry !== 'sun') raf = requestAnimationFrame(frame); };
  document.addEventListener('visibilitychange', run);
  document.addEventListener('entrydaychange', run); run();
  reduce.addEventListener?.('change', () => { if (reduce.matches) { cancelAnimationFrame(raf); canvas.remove(); } });
}

mountMagic();
