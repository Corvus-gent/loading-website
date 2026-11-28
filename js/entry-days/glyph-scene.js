import {canvasScene, image, offscreen, NIGHT, PLUM, RAMP} from './runtime.js';

export async function glyphScene(api, room = false) {
  const [dio, wing] = await Promise.all([
    room ? null : image('/assets/court/diogenes-lbe9g6zf.webp', api.signal),
    image('/assets/site/wing-still-kgvvou5x.png', api.signal),
  ]);
  if (api.signal.aborted) return;
  let cols, rows, cw, ch, lum, previousGlyph, previousColour;
  const colours = [...PLUM, '#8a6a2a', '#c99a3e', '#ffd76a', '#fff1c4'];
  return canvasScene(api, ctx => ({
    resize(w, h) {
      cw = w < 700 ? 11 : 9; ch = Math.round(cw * 1.6);
      cols = Math.ceil(w / cw); rows = Math.ceil(h / ch);
      const source = offscreen(w, h), g = source.ctx;
      g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#555'; g.lineWidth = 2;
      for (let angle = -70; angle <= 70; angle += 10) {
        const a = angle * Math.PI / 180;
        g.beginPath(); g.moveTo(w / 2, -h * 0.5);
        g.lineTo(w / 2 + Math.sin(a) * w * 1.2, -h * 0.5 + Math.cos(a) * h * 1.2); g.stroke();
      }
      g.strokeStyle = '#bbb'; g.lineWidth = 3;
      g.beginPath(); g.ellipse(w / 2, h * 0.77, w * 0.43, h * 0.07, 0, 0, Math.PI * 2); g.stroke();
      if (!room) {
        const dw = Math.min(w * (w < 700 ? 0.9 : 0.55), h * 0.85), dh = dw * 555 / 768;
        g.save(); g.filter = 'grayscale(1) contrast(1.25)';
        g.drawImage(dio, w * 0.03, h * 0.27, dw, dh); g.restore();
      } else {
        // Door outlines align with the ordinary HTML links, not canvas text.
        g.strokeStyle = '#aaa'; g.lineWidth = 3;
        for (const p of [0.22, 0.5, 0.78]) {
          g.beginPath(); g.roundRect(w * p - w * 0.1, h * 0.42, w * 0.2, h * 0.23, [w * 0.07, w * 0.07, 0, 0]); g.stroke();
        }
      }
      const sx = w * 0.56, sy = h * 0.72, sw = Math.max(32, w * 0.045);
      g.fillStyle = '#aaa'; g.fillRect(sx - sw / 2, sy - sw * 1.5, sw, sw);
      g.fillRect(sx - sw * 0.62, sy - sw * 0.48, sw * 1.24, sw * 0.3);
      g.fillRect(sx - sw * 0.5, sy - sw * 0.2, sw * 0.12, sw * 0.55);
      g.fillRect(sx + sw * 0.38, sy - sw * 0.2, sw * 0.12, sw * 0.55);
      const ww = Math.min(w * 0.26, h * 0.25);
      g.drawImage(wing, w * 0.72, h * 0.29, ww, ww);
      const sample = offscreen(cols, rows);
      sample.ctx.drawImage(source.canvas, 0, 0, cols, rows);
      const data = sample.ctx.getImageData(0, 0, cols, rows).data;
      lum = Float32Array.from({length: cols * rows}, (_, i) => (data[i * 4] * 0.3 + data[i * 4 + 1] * 0.59 + data[i * 4 + 2] * 0.11) / 255);
      previousGlyph = new Int16Array(cols * rows).fill(-1);
      previousColour = new Int8Array(cols * rows).fill(-1);
      ctx.fillStyle = NIGHT; ctx.fillRect(0, 0, w, h);
      ctx.font = `${cw}px ui-monospace, monospace`; ctx.textBaseline = 'top';
    },
    draw(t) {
      const lamp = api.light(), r = Math.max(130, lamp.radius), count = RAMP.length - 1;
      for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
        const i = row * cols + col;
        const d = ((col * cw - lamp.x) ** 2 + (row * ch - lamp.y) ** 2) / (r * r);
        const light = Math.exp(-d * 1.6) * (api.still ? 1 : 0.98 + Math.sin(t * 1.7) * 0.02);
        const brightness = Math.min(1, Math.pow(lum[i], 0.8) * (0.26 + light * 1.5) + light * 0.05);
        const target = brightness * count;
        const glyph = previousGlyph[i] < 0 || Math.abs(target - previousGlyph[i]) > 0.65 ? Math.round(target) : previousGlyph[i];
        const colour = light > 0.5 ? 6 + Math.min(3, Math.floor((light - 0.5) * 8 * Math.min(1, brightness * 2.2 + 0.2))) : Math.min(5, Math.floor(brightness * 7));
        if (glyph === previousGlyph[i] && colour === previousColour[i]) continue;
        previousGlyph[i] = glyph; previousColour[i] = colour;
        ctx.fillStyle = NIGHT; ctx.fillRect(col * cw, row * ch, cw, ch);
        if (glyph) { ctx.fillStyle = colours[colour]; ctx.fillText(RAMP[glyph], col * cw, row * ch + 1, cw); }
      }
    },
  }));
}
