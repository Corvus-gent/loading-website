import { mkdir, copyFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { DURATIONS, timeline } from './src/timing.mjs';

const output = new URL('./public/', import.meta.url);
const source = new URL('../public/hackersbay/assets/', import.meta.url);
const rate = 44100;
const tau = 2 * Math.PI;
const melody = [57, 57, 60, 64, 62, 60, 57, 55, 57, 60, 65, 64, 62, 60, 55, 57];

function sine(frequency, time) {
  return Math.sin(tau * frequency * time);
}

function pulse(time, frequency, decay) {
  if (time < 0 || time > 1.8) return 0;
  return sine(frequency, time) * Math.exp(-time * decay);
}

function mix(seconds) {
  const cues = timeline(seconds);
  const sampleCount = rate * seconds;
  const file = Buffer.alloc(44 + sampleCount * 2);
  file.write('RIFF', 0);
  file.writeUInt32LE(file.length - 8, 4);
  file.write('WAVEfmt ', 8);
  file.writeUInt32LE(16, 16);
  file.writeUInt16LE(1, 20);
  file.writeUInt16LE(1, 22);
  file.writeUInt32LE(rate, 24);
  file.writeUInt32LE(rate * 2, 28);
  file.writeUInt16LE(2, 32);
  file.writeUInt16LE(16, 34);
  file.write('data', 36);
  file.writeUInt32LE(sampleCount * 2, 40);

  const pingTimes = [cues.sonar + .4, cues.sonar + 1.05, cues.sonar + 1.7];
  let random = 534523;
  for (let index = 0; index < sampleCount; index++) {
    const time = index / rate;
    random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
    const noise = random / 2147483648 - 1;
    let level = 0;

    if (time < cues.mutual) {
      const beat = time / .36;
      const chord = Math.floor(beat);
      const phase = (beat % 1) * .36;
      const note = 440 * 2 ** ((melody[chord % melody.length] - 69) / 12);
      const rhythm = .10 * pulse(phase, note, 5) + .045 * pulse(phase, note * 2, 7) + .025 * pulse(phase, note * 3, 9);
      const roll = .08 * pulse(time % .72, chord % 8 < 4 ? 110 : 87.3, 4);
      const pause = Math.min(1, Math.abs(time - cues.sonar - .11) * 7);
      level = (rhythm + roll) * pause;
    } else {
      const sinceDrop = time - cues.mutual;
      const steps = sinceDrop / .139;
      const step = Math.floor(steps);
      const phase = (steps % 1) * .139;
      const bassPhase = sinceDrop % .556;
      level = .32 * Math.tanh(2 * sine(49, bassPhase)) * Math.exp(-bassPhase * 6);
      if ([0, 2, 5, 6].includes(step % 8)) {
        const note = [540, 620, 670, 580][step % 4];
        level += .13 * pulse(phase, note, 12) + .055 * pulse(phase, note * 1.48, 17);
      }
      level += .045 * noise * Math.exp(-phase * 110);
      level += .16 * pulse(sinceDrop, 77, 4);
    }

    const blast = time - cues.cannon;
    if (blast >= 0 && blast < 1.1) {
      level += (.39 * sine(63 - blast * 33, blast) + .26 * noise) * Math.exp(-blast * 6);
    }
    for (const ping of pingTimes) {
      level += .18 * pulse(time - ping, 1170, 10) + .055 * pulse(time - ping - .12, 950, 8);
    }
    if (time > seconds - .45) level *= Math.max(0, (seconds - time) / .45);
    file.writeInt16LE(Math.round(Math.max(-1, Math.min(1, level)) * 32767), 44 + index * 2);
  }
  return file;
}

export async function prepare() {
  await mkdir(output, { recursive: true });
  await Promise.all([
    ...['anchor.svg', 'parrot-flag.svg', 'inter.woff2', 'jetbrains-mono.woff2']
      .map(file => copyFile(new URL(file, source), new URL(file, output))),
    ...DURATIONS.map(duration => writeFile(new URL('mix-' + duration + '.wav', output), mix(duration)))
  ]);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await prepare();
