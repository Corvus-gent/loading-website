import { useEffect, useRef, useState } from 'react';

export function useAtmosphere() {
  useEffect(() => {
    const root = document.documentElement;
    const dark = matchMedia('(prefers-color-scheme: dark)');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const lights = document.querySelector('#lights');
    const hero = document.querySelector('.hero');
    const bag = document.querySelector('#bag');
    const themeKey = 'raygifts-theme';
    let theme;
    let frame = 0;
    try { theme = localStorage.getItem(themeKey); } catch {}
    const clamp = value => Math.min(1, Math.max(value, 0));
    const palettes = {
      dusk: [[246, 238, 223], [59, 42, 92], [20, 17, 43]],
      night: [[20, 17, 43], [74, 56, 115], [11, 9, 24]],
    };
    const luminance = values => values.reduce((sum, value, index) => {
      const channel = value / 255;
      return sum + [0.2126, 0.7152, 0.0722][index] * (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
    }, 0);
    function updateScroll() {
      frame = 0;
      if (!hero || reduced.matches) {
        root.style.removeProperty('--sunset');
        root.style.removeProperty('--sunset-ink');
        root.style.removeProperty('--stars');
        return;
      }
      const progress = clamp(window.scrollY / Math.max(1, bag.offsetTop));
      const [ground, plum, night] = palettes[root.dataset.theme];
      const start = progress < 0.68 ? ground : plum;
      const end = progress < 0.68 ? plum : night;
      const mix = progress < 0.68 ? progress / 0.68 : (progress - 0.68) / 0.32;
      const channels = start.map((channel, index) => Math.round(channel + (end[index] - channel) * mix));
      root.style.setProperty('--sunset', `rgb(${channels.join(' ')})`);
      const lightness = luminance(channels);
      const ink = lightness < 0.145 ? '#F6EEDF' : lightness < 0.179 ? '#FFFFFF' : lightness < 0.235 ? '#000000' : '#1B1630';
      root.style.setProperty('--sunset-ink', ink);
      root.style.setProperty('--stars', clamp(1 - bag.getBoundingClientRect().top / window.innerHeight));
    }
    function schedule() {
      if (!frame) frame = requestAnimationFrame(updateScroll);
    }
    function applyTheme() {
      const night = theme === 'night' || (theme !== 'dusk' && dark.matches);
      root.dataset.theme = night ? 'night' : 'dusk';
      lights.lastElementChild.textContent = night ? 'Lights on' : 'Lights off';
      lights.setAttribute('aria-checked', String(night));
      schedule();
    }
    function toggle() {
      theme = root.dataset.theme === 'night' ? 'dusk' : 'night';
      try { localStorage.setItem(themeKey, theme); } catch {}
      applyTheme();
      lights.animate?.([{ transform: 'translateY(0)' }, { transform: 'translateY(4px)' }, { transform: 'translateY(0)' }], { duration: reduced.matches ? 0 : 280 });
    }
    applyTheme();
    lights.addEventListener('click', toggle);
    dark.addEventListener('change', applyTheme);
    reduced.addEventListener('change', schedule);
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(frame);
      lights.removeEventListener('click', toggle);
      dark.removeEventListener('change', applyTheme);
      reduced.removeEventListener('change', schedule);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, []);
}

export function Pause() {
  const [elapsed, setElapsed] = useState(0);
  const dialog = useRef(null);
  const startButton = useRef(null);
  const timer = useRef(null);
  const total = 30;
  const phase = elapsed >= total ? 'Welcome back.' : elapsed % 14 < 4 ? 'Breathe in' : elapsed % 14 < 8 ? 'Hold' : 'Breathe out';
  const phaseClass = elapsed >= total ? 'done' : elapsed % 14 < 4 ? 'inhale' : elapsed % 14 < 8 ? 'hold' : 'exhale';

  function start() {
    setElapsed(0);
    dialog.current.showModal();
    const started = performance.now();
    function tick() {
      const seconds = Math.min(total, (performance.now() - started) / 1000);
      setElapsed(seconds);
      if (seconds === total) clearInterval(timer.current);
    }
    timer.current = setInterval(tick, 100);
  }
  function stop() {
    clearInterval(timer.current);
    startButton.current?.focus();
  }
  useEffect(() => () => clearInterval(timer.current), []);

  return <>
    <button ref={startButton} onClick={start}>Start 30-second pause</button>
    <dialog ref={dialog} className="pause" onClose={stop} aria-labelledby="pause-title">
      <div className="pause-content">
        <h2 id="pause-title" className="visually-hidden">30-second pause</h2>
        <div className="breath" data-phase={phaseClass} style={{ '--breath': phaseClass === 'inhale' ? 0.65 + elapsed % 14 / 4 * 0.35 : phaseClass === 'hold' ? 1 : phaseClass === 'exhale' ? 1 - (elapsed % 14 - 8) / 6 * 0.35 : 0.65 }} aria-hidden="true"></div>
        <p className="phase" role="status">{phase}</p>
        <time className="tag" aria-label="Seconds remaining">00:{String(Math.ceil(total - elapsed)).padStart(2, '0')}</time>
        <form method="dialog"><button autoFocus>{elapsed >= total ? 'Close' : 'End pause'}</button></form>
      </div>
    </dialog>
  </>;
}

export function Sound() {
  const [kind, setKind] = useState('off');
  const [error, setError] = useState('');
  const context = useRef(null);
  const current = useRef(null);
  const request = useRef(0);
  useEffect(() => () => {
    request.current++;
    context.current?.close().catch(() => {});
  }, []);

  async function play(next) {
    const key = ++request.current;
    setError('');
    if (current.current) {
      current.current.stop();
      current.current = null;
    }
    setKind('off');
    if (next === 'off') return;
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) throw new Error('Web Audio unavailable');
      const audio = context.current ??= new Audio();
      await audio.resume();
      if (key !== request.current) return;
      const buffer = audio.createBuffer(1, 4 * audio.sampleRate, audio.sampleRate);
      const channel = buffer.getChannelData(0);
      let previous = 0;
      for (let index = 0; index < channel.length; index++) {
        const noise = Math.random() * 2 - 1;
        previous = (previous + 0.025 * noise) / 1.025;
        const amplitude = Math.min(1, index / 512, (channel.length - index - 1) / 512);
        channel[index] = amplitude * (next === 'brown' ? previous * 3.2 : noise * 0.34 + previous * 1.6);
      }
      const output = audio.createGain();
      output.gain.value = 0.17;
      const filter = audio.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = next === 'rain' ? 3200 : 1300;
      const source = audio.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.connect(filter).connect(output).connect(audio.destination);
      source.onended = () => { source.disconnect(); filter.disconnect(); output.disconnect(); };
      source.start();
      current.current = source;
      setKind(next);
    } catch {
      if (request.current === key) setError('Sound is unavailable on this device.');
    }
  }

  return <div className="ambient">
    <p>Background sound</p>
    <div className="inline">{[['off', 'Off'], ['rain', 'Rain'], ['brown', 'Brown noise']].map(([value, label]) =>
      <button key={value} type="button" aria-pressed={kind === value} onClick={() => play(value)}>{label}</button>)}</div>
    {error && <p role="status">{error}</p>}
  </div>;
}
