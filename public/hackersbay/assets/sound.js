const key = 'hackersbay-sound';
let enabled = false;
let audio;
try { enabled = localStorage.getItem(key) === 'on'; } catch { /* Use the session setting. */ }

const notes = {
  squawk: [[0,660,890,.16,'triangle'], [.13,930,560,.15,'triangle']],
  cannon: [[0,130,38,.52,'sawtooth'], [.02,88,30,.4,'triangle']],
  coin: [[0,1047,1047,.15,'sine'], [.085,1568,1568,.3,'sine'], [.14,2093,2093,.19,'sine']],
  shanty: [57,57,60,64,62,60,57,55,57,60,65,64,62,60,55,57].map((midi,index) => {
    const frequency = 440 * 2 ** ((midi - 69) / 12);
    return [index * .16, frequency, frequency, index === 15 ? .45 : .19, 'triangle'];
  })
};

export function playBaySound(cue, once = false) {
  if (!audio || (!enabled && !once)) return;
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

const Audio = window.AudioContext || window.webkitAudioContext;

async function unlock() {
  if (!Audio) return;
  try {
    if (!audio) audio = new Audio();
    await audio.resume();
  } catch { audio = null; }
}

export async function playShanty() {
  await unlock();
  playBaySound('shanty', true);
}

export function playSalute() {
  playBaySound('squawk');
  if (!enabled || !window.speechSynthesis) return;
  const voice = speechSynthesis.getVoices().find(candidate => candidate.localService && /^en\b/i.test(candidate.lang));
  if (voice) {
    const shout = new SpeechSynthesisUtterance('Aye aye!');
    shout.voice = voice;
    speechSynthesis.speak(shout);
  }
}

export function wireSound(button, { shortcut = false } = {}) {
  if (!button && !shortcut) return;
  const reveal = () => {
    if (!button) return;
    button.setAttribute('aria-pressed', String(enabled));
    button.textContent = enabled ? 'Sound on' : 'Sound off';
  };
  reveal();
  if (!Audio) { if (button) button.hidden = true; return; }
  if (enabled) window.addEventListener('pointerdown', unlock, { once: true });
  async function toggle() {
    enabled = !enabled;
    reveal();
    try { localStorage.setItem(key, enabled ? 'on' : 'off'); } catch { /* Use the session setting. */ }
    if (!enabled) return;
    await unlock();
    playBaySound('squawk');
  }
  button?.addEventListener('click', toggle);
  if (shortcut) window.addEventListener('keydown', event => {
    if (event.code === 'KeyM' && !event.repeat && !event.metaKey && !event.ctrlKey && !event.altKey) void toggle();
  });
}
