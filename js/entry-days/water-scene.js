import {canvasScene, offscreen, NIGHT} from './runtime.js';
// Ordered 8×8 Bayer thresholds; water indexes world coordinates, not screen x.
const BAYER = [0,32,8,40,2,34,10,42,48,16,56,24,50,18,58,26,12,44,4,36,14,46,6,38,60,28,52,20,62,30,54,22,3,35,11,43,1,33,9,41,51,19,59,27,49,17,57,25,15,47,7,39,13,45,5,37,63,31,55,23,61,29,53,21];
const PALETTE = [[7,6,10], [45,31,69], [122,92,176], [255,215,106]];
const mod = n => ((Math.floor(n) % 8) + 8) % 8;
export function waterScene(api, mirror = false) {
  let buffer, data, w, h;
  return canvasScene(api, ctx => ({
    resize(width, height) {
      const scale = Math.max(3, Math.ceil(Math.max(width / 320, height / 220)));
      w = Math.max(1, Math.floor(width / scale)); h = Math.max(1, Math.floor(height / scale));
      buffer = offscreen(w, h); data = buffer.ctx.createImageData(w, h);
    },
    draw(t, width, height) {
      const horizon = h * 0.47;
      const camera = Math.sin(t * 0.12) * 18;
      // An astronomical light fixed to the sky, with mild camera parallax.
      // Pointer/lantern input never moves the moon or disconnects its reflection.
      const moonX = w * 0.63 - camera * 0.12, moonY = h * 0.29;
      function sky(sx, sy) {
        const dx = (sx - moonX) / Math.max(2, h * 0.037), dy = (sy - moonY) / Math.max(2, h * 0.037);
        const moon = Math.exp(-(dx * dx + dy * dy) / 2);
        const halo = Math.exp(-(dx * dx + dy * dy) / 30);
        let brightness = 0.025 + halo * 0.2 + moon * 0.75;
        if (mirror) {
          const nx = (sx - w / 2 + camera * 0.35) / (w * 0.7), ny = sy / horizon;
          const dome = 0.12 + nx * nx * 0.64;
          const arch = Math.exp(-Math.abs(ny - dome) * 90);
          const radial = Math.abs(Math.sin(Math.atan2(nx, ny + 0.25) * 15));
          brightness += arch * 0.55 + (ny > dome && radial < 0.045 ? 0.24 : 0);
          const ring = Math.exp(-Math.abs(ny - 0.86) * 100);
          brightness += ring * 0.38;
        }
        return {value: Math.min(0.99, brightness), gold: moon > 0.5};
      }
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const worldX = x + camera, underwater = y >= horizon;
        let sample;
        if (!underwater) sample = sky(x, y);
        else {
          const depth = (y - horizon) / (h - horizon);
          const wave = Math.sin(worldX * 0.09 / (0.25 + depth) + t * 1.3) * 0.5
            + Math.sin(worldX * 0.031 + y * 0.2 - t * 0.7) * 0.5;
          const reflection = Math.exp(-((x - moonX) ** 2) / (2 * (5 + depth * 24) ** 2));
          let value = 0.06 + depth * 0.08 + wave * 0.045 + reflection * (0.3 + wave * 0.22);
          if (mirror) {
            const reflected = sky(x + wave * (1 + depth * 9), Math.max(0, horizon - (y - horizon) * 0.9));
            value += reflected.value * (0.65 - depth * 0.25);
          }
          sample = {value, gold: reflection > 0.6 && wave > 0.25};
        }
        const threshold = (BAYER[mod(y) * 8 + mod(underwater ? worldX : x)] + 0.5) / 64;
        const level = Math.max(0, Math.min(1.999, sample.value * 3.2));
        let ink = Math.min(2, Math.floor(level) + (level % 1 > threshold ? 1 : 0));
        if (sample.gold && sample.value > 0.4 && threshold < 0.7) ink = 3;
        const p = PALETTE[ink], i = (y * w + x) * 4;
        data.data[i] = p[0]; data.data[i + 1] = p[1]; data.data[i + 2] = p[2]; data.data[i + 3] = 255;
      }
      buffer.ctx.putImageData(data, 0, 0);
      ctx.imageSmoothingEnabled = false; ctx.drawImage(buffer.canvas, 0, 0, width, height);
      // Dome ribs are rendered as actual glyphs above their reflected dither.
      if (mirror) {
        const cw = width < 700 ? 11 : 9, ch = Math.round(cw * 1.6);
        ctx.font = `${cw}px ui-monospace, monospace`; ctx.textBaseline = 'top';
        for (let py = ch * 3; py < height * 0.44; py += ch) for (let px = 0; px < width; px += cw) {
          const s = sky(px / width * w, py / height * h);
          if (s.value < 0.17 || s.gold) continue;
          ctx.fillStyle = NIGHT; ctx.fillRect(px, py, cw, ch);
          ctx.fillStyle = s.value > 0.4 ? '#b4a0d6' : '#5b3e8c';
          ctx.fillText(s.value > 0.4 ? '#' : ':', px, py, cw);
        }
      }
    },
  }));
}
