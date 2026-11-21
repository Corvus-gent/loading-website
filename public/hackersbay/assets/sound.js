const key = 'hackersbay-sound';
let enabled = false;
let audio;
try { enabled = localStorage.getItem(key) === 'on'; } catch { /* Use the session setting. */ }

const notes = {
  squawk: [[0,660,890,.16,'triangle'], [.13,930,560,.15,'triangle']],
  cannon: [[0,130,38,.52,'sawtooth'], [.02,88,30,.4,'triangle']],
  coin: [[0,1047,1047,.15,'sine'], [.085,1568,1568,.3,'sine'], [.14,2093,2093,.19,'sine']]
};

export function playBaySound(cue) {
  if (!audio || !enabled) return;
  for (const [delay, from, to, duration, wave] of notes[cue]) {
    const tone = audio.createOscillator();
    const volume = audio.createGain();
    const start = audio.currentTime + delay;
    tone.type = wave;
    tone.frequency.setValueAtTime(from, start);
    tone.frequency.exponentialRampToValueAtTime(to, start + duration);
    volume.gain.setValueAtTime(cue === 'cannon' ? .11 : .075, start);
    volume.gain.exponentialRampToValueAtTime(.001, start + duration);
    tone.connect(volume).connect(audio.destination);
    tone.start(start);
    tone.stop(start + duration);
  }
}

export function wireSound(button) {
  if (!button) return;
  const reveal = () => {
    button.setAttribute('aria-pressed', String(enabled));
    button.textContent = enabled ? 'Sound on' : 'Sound off';
  };
  reveal();
  const Audio = window.AudioContext || window.webkitAudioContext;
  if (!Audio) { button.hidden = true; return; }
  async function unlock() {
    try {
      if (!audio) audio = new Audio();
      await audio.resume();
    } catch { audio = null; }
  }
  if (enabled) window.addEventListener('pointerdown', unlock, { once: true });
  button.addEventListener('click', async () => {
    enabled = !enabled;
    reveal();
    try { localStorage.setItem(key, enabled ? 'on' : 'off'); } catch { /* Use the session setting. */ }
    if (!enabled) return;
    await unlock();
    playBaySound('squawk');
  });
}
