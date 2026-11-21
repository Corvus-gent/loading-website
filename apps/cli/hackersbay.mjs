#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { emitKeypressEvents } from 'node:readline';
import { classIndex, cleanName, KITS, CLASSES, randomPirate, pirateArt, TAGLINE } from './terminal-art.mjs';

const args = process.argv.slice(2);
const origin = process.env.HACKERSBAY_ORIGIN || 'https://corvus.gent';
const ansi = process.stdout.isTTY && !Object.hasOwn(process.env,'NO_COLOR') && process.env.TERM !== 'dumb';
const interactive = process.stdin.isTTY && process.stdout.isTTY && !args.includes('--json') && !args.includes('--quick');
const argument = key => {
  const index = args.indexOf(key);
  return index < 0 ? undefined : args[index+1];
};
const requestedClass = argument('--class');
const index = classIndex(requestedClass);

function help() {
  console.log(TAGLINE + '\n\nUsage: hackersbay [--class deckhand] [--name "Tide Byte"] [--quick] [--json]');
  console.log('Up/down chooses a field. Left/right changes a class or item. Enter raises the flag.');
  console.log('Classes: ' + CLASSES.join(', ') + '.');
}
function choose(pirate) {
  if (!interactive) return Promise.resolve(pirate);
  return new Promise(resolve => {
    const fields = ['name', 'class', ...Object.keys(KITS)];
    let position = 1;
    const wasRaw = process.stdin.isRaw;
    emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    if (ansi) process.stdout.write('\x1b[?1049h\x1b[?25l');
    function draw() {
      if (ansi) process.stdout.write('\x1b[H\x1b[2J');
      console.log('BUILD YOUR PIRATE · THE HACKERS BAY\n' + pirateArt(pirate, ansi));
      for (const [i, key] of fields.entries()) {
        const value = key === 'name' || key === 'class' ? pirate[key] : KITS[key][pirate.kit[key]];
        console.log((position === i ? '› ' : '  ') + key.padEnd(6) + ' ' + value);
      }
      console.log('\n↑ ↓ Field  ·  ← → Change  ·  Type in the name field  ·  Enter Board  ·  Esc Quit');
    }
    function finish(value) {
      process.stdin.off('keypress', keypress);
      process.stdin.setRawMode(wasRaw);
      process.stdin.pause();
      if (ansi) process.stdout.write('\x1b[?25h\x1b[?1049l');
      resolve(value);
    }
    function keypress(input, key) {
      if (key?.name === 'escape' || (key?.ctrl && key.name === 'c')) return finish(null);
      if (key?.name === 'return') return finish({...pirate, name:cleanName(pirate.name) || 'Tide Byte'});
      const field = fields[position];
      if (key?.name === 'up' || key?.name === 'down') {
        position = (position + fields.length + (key.name === 'up' ? -1 : 1)) % fields.length;
      } else if (key?.name === 'left' || key?.name === 'right') {
        const step = key.name === 'left' ? -1 : 1;
        if (field === 'class') {
          const next = (classIndex(pirate.class) + CLASSES.length + step) % CLASSES.length;
          const {type,class: label} = randomPirate(next, pirate.name);
          pirate = {...pirate,type,class:label};
        } else if (field !== 'name') {
          const limit = KITS[field].length;
          pirate.kit[field] = (pirate.kit[field] + limit + step) % limit;
        }
      } else if (field === 'name') {
        if (key?.name === 'backspace') pirate.name = pirate.name.slice(0,-1);
        else if (input && !key?.ctrl && !key?.meta) pirate.name = cleanName(pirate.name + input) + (input === ' ' && !pirate.name.endsWith(' ') ? ' ' : '');
      }
      draw();
    }
    process.stdin.on('keypress',keypress);
    draw();
  });
}
async function getMatches(pirate) {
  const url = new URL('/hackersbay/api/match', origin);
  url.search = new URLSearchParams({me:pirate.name,class:pirate.class.toLowerCase(),json:'1'});
  try {
    const response = await fetch(url, {signal:AbortSignal.timeout(3500)});
    if (response.ok && response.headers.get('content-type')?.includes('application/json')) {
      const result = await response.json();
      if (Array.isArray(result.matches)) return { matches: result.matches, offline:false };
    }
  } catch { /* The packaged Demo Day roster is available offline. */ }
  const fallback = JSON.parse(await readFile(new URL('./matches.json', import.meta.url),'utf8'));
  return { matches:fallback[pirate.type], offline:true };
}
async function main() {
  if (args.includes('--help') || args.includes('-h')) return help();
  if (requestedClass && index < 0) {
    console.error('Choose ' + CLASSES.join(', ') + '.');
    process.exitCode = 1;
    return;
  }
  const pirate = await choose(randomPirate(index < 0 ? undefined : index, argument('--name')));
  if (!pirate) return;
  const result = await getMatches(pirate);
  const url = new URL('/hackersbay/board', origin);
  url.search = new URLSearchParams({ pirate:pirate.name, class:pirate.type, ...pirate.kit });
  if (args.includes('--json')) { console.log(JSON.stringify({pirate,...result,share:url.href},null,2)); return; }
  console.log(pirateArt(pirate,ansi) + '\n' + pirate.name + ' · ' + pirate.class);
  console.log('\nYOUR THREE CREWMATES · ' + (result.offline ? 'BUNDLED DEMO ROSTER' : 'DEMO DAY ROSTER'));
  for (const [i, match] of result.matches.entries()) {
    console.log((i+1) + '. ' + match.name + '\n   For you: ' + match.forYou + '\n   For them: ' + match.forThem);
  }
  console.log('\nBoard or share your pirate\n' + url.href);
}
await main();
