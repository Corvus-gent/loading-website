import {canvasScene, glow, NIGHT} from './runtime.js';
export function mount(api) {
  return canvasScene(api, ctx => ({
    draw(t, w, h) {
      ctx.fillStyle = NIGHT; ctx.fillRect(0, 0, w, h);
      const x = w * 0.52, y = h * 0.49;
      glow(ctx, x, y + 20, Math.min(w * 0.25, 130), api.still ? 0.08 : 0.075 + Math.sin(t * 0.8) * 0.008);
      // Just Wing's eye, a hint of his silhouette, and the real HTML lantern.
      ctx.fillStyle = '#0e0b16';
      ctx.beginPath(); ctx.ellipse(x - 12, y + 8, 32, 18, -0.3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffd76a'; ctx.fillRect(x + 9, y - 1, 3, 3);
    },
  }));
}
