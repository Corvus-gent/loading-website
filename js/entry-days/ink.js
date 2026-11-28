import {canvasScene, image, offscreen, NIGHT, RAMP, glow} from './runtime.js';
const seed = i => { const n = Math.sin(i * 127.1 + 31.7) * 43758.5453; return n - Math.floor(n); };
export async function mount(api) {
  const wing = await image('/assets/site/wing-still-kgvvou5x.png', api.signal);
  if (api.signal.aborted) return;
  let cells, box, cw, ch;
  return canvasScene(api, ctx => ({
    resize(w, h) {
      const size = Math.min(w * 0.78, h * 0.48);
      box = {x: (w - size) / 2, y: h * 0.29, size};
      cw = w < 700 ? 7 : 9; ch = Math.round(cw * 1.6);
      const cols = Math.floor(size / cw), rows = Math.floor(size / ch), sample = offscreen(cols, rows);
      sample.ctx.drawImage(wing, 0, 0, cols, rows);
      const data = sample.ctx.getImageData(0, 0, cols, rows).data;
      cells = [];
      for (let i = 0; i < cols * rows; i++) {
        const a = data[i * 4 + 3] / 255;
        if (a < 0.15) continue;
        const brightness = (data[i * 4] * 0.3 + data[i * 4 + 1] * 0.59 + data[i * 4 + 2] * 0.11) / 255;
        cells.push({x: box.x + (i % cols) * cw, y: box.y + Math.floor(i / cols) * ch,
          glyph: Math.max(1, Math.round((1 - brightness * 0.6) * (RAMP.length - 1) * a)),
          colour: `rgb(${data[i * 4]},${data[i * 4 + 1]},${data[i * 4 + 2]})`, threshold: seed(i) * 0.85, seed: seed(i + 92)});
      }
      ctx.font = `${cw}px ui-monospace, monospace`; ctx.textBaseline = 'top';
    },
    draw(t, w, h) {
      const progress = api.still ? 3 : t;
      ctx.fillStyle = NIGHT; ctx.fillRect(0, 0, w, h);
      glow(ctx, w / 2, box.y + box.size * 0.78, box.size * 0.7);
      const assemble = Math.min(1, progress / 1.6), fade = Math.min(1, Math.max(0, (progress - 1.6) / 0.6));
      if (fade < 1) {
        ctx.globalAlpha = 1 - fade;
        for (const cell of cells) {
          if (assemble < cell.threshold) continue;
          const settled = assemble >= cell.threshold + 0.15;
          ctx.fillStyle = settled ? cell.colour : '#7a5cb0';
          const glyph = settled ? cell.glyph : 1 + Math.floor(seed(cell.seed * 100 + Math.floor(t * 8)) * 6);
          ctx.fillText(RAMP[glyph], cell.x, cell.y, cw);
        }
        ctx.globalAlpha = 1;
      }
      if (fade > 0) {
        ctx.globalAlpha = fade; ctx.imageSmoothingEnabled = false;
        ctx.drawImage(wing, box.x, box.y, box.size, box.size); ctx.globalAlpha = 1;
      }
      return progress < 2.2;
    },
  }));
}
