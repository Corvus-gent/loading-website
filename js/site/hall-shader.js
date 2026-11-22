import {effect, frame, init, surface} from 'vgpu';
import shader from './hall-shader.wgsl';

function rgb(property) {
  const value = property.trim();
  const channels = value[0] === '#'
    ? value.slice(1).match(/../g).map(channel => parseInt(channel, 16))
    : value.match(/[\d.]+/g).slice(0, 3).map(Number);
  return channels.map(channel => channel / 255);
}

export async function mountHallShader(hall, onFailure) {
  const gpu = await init({powerPreference: 'low-power', label: 'Corvus hall'});
  const canvas = document.createElement('canvas');
  canvas.className = 'hall-shader';
  let raf = 0;
  let active = false;
  let disposed = false;
  let dirtyPalette = true;
  let lastFrame = null;
  let lastDraw = null;
  let time = 0;
  let wave;
  let firstFrame = true;
  const palette = new MutationObserver(() => { dirtyPalette = true; });

  function dispose() {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(raf);
    palette.disconnect();
    canvas.remove();
    wave?.dispose();
    gpu.dispose();
  }

  function fail(error) {
    if (disposed) return;
    dispose();
    onFailure(error);
  }

  try {
    gpu.onError(fail);
    void gpu.lost.then(fail);
    hall.querySelector('.hall-dome').after(canvas);
    const mobile = matchMedia('(pointer: coarse)').matches;
    const target = surface(gpu, canvas, {dpr: [1, mobile ? 1 : 1.5], depth: false, msaa: false});
    wave = effect(gpu, shader, {label: 'Hall surface dither'});
    palette.observe(document.documentElement, {attributes: true, attributeFilter: ['style', 'data-realm-theme']});
    await wave.compile(target);

    function render(now) {
      if (!active || disposed) return;
      time += lastFrame === null ? 0 : Math.min(50, now - lastFrame) / 1000;
      lastFrame = now;
      if (lastDraw === null || now - lastDraw >= 32) {
        lastDraw = now;
        try {
          if (dirtyPalette) {
            const style = getComputedStyle(hall);
            wave.set({
              night: rgb(style.getPropertyValue('--night')),
              plum: rgb(style.getPropertyValue('--plum-lit')),
              light: rgb(style.getPropertyValue('--gold')),
            });
            dirtyPalette = false;
          }
          wave.set({time, size: [canvas.width / target.dpr, canvas.height / target.dpr]});
          frame(gpu, f => f.pass({target}, pass => pass.draw(wave)));
          if (firstFrame) {
            canvas.classList.add('is-ready');
            firstFrame = false;
          }
        } catch (error) {
          fail(error);
          return;
        }
      }
      raf = requestAnimationFrame(render);
    }

    return {
      setActive(next) {
        if (disposed || next === active) return;
        active = next;
        cancelAnimationFrame(raf);
        lastFrame = lastDraw = null;
        if (active) raf = requestAnimationFrame(render);
      },
      dispose,
    };
  } catch (error) {
    dispose();
    throw error;
  }
}
