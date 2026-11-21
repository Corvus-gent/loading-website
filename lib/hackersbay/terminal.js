import { setTimeout as delay } from 'node:timers/promises';
import { classIndex, cleanName, CLASSES, TYPES, pirateArt, randomPirate, sinkFrame, welcome } from '../../apps/cli/terminal-art.mjs';
import { describeMatch, lensFor, matchRoom } from '../../public/hackersbay/assets/lens.js';
import { EVENT_PATH, preset } from '../../public/hackersbay/assets/persona.js';
import attendees from '../../public/hackersbay/assets/attendees.json' with { type: 'json' };
import event from '../../public/hackersbay/assets/event.json' with { type: 'json' };
import { SCOUTS } from '../../public/hackersbay/assets/race-model.js';
import { readRaceBoard } from './race.js';
import { readCrewCounts } from './crew.js';
import { available, networkId } from './quota.js';

const tips = [
  'A good intro starts with a reason on both sides.',
  'Deckhands check the payout schedule before they set sail.',
  'An event invite is an invitation to build your pirate.',
  'Keep your organizer link in your own ship’s log.',
  'Three good conversations beat a wall of grey dots.'
];

export const terminalActions = new Set([
  'terminal-home', 'terminal-pirate', 'terminal-crew', 'terminal-event', 'terminal-match', 'terminal-squawk', 'terminal-sink', 'terminal-ayay', 'terminal-race'
]);

function text(req, res, value, status = 200) {
  res.status(status);
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  return res.end(req.method === 'HEAD' ? undefined : value);
}

function respond(req, res, data, content, status = 200) {
  if (Object.hasOwn(req.query, 'json') && req.query.json !== '0') {
    if (req.method === 'HEAD') {
      res.status(status);
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.end();
    }
    return res.status(status).json(data);
  }
  return text(req, res, content, status);
}

async function sink(req, res, ansi) {
  res.status(200);
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('X-Accel-Buffering', 'no');
  if (req.method === 'HEAD') return res.end();
  res.flushHeaders?.();
  for (let frame = 0; frame < 19 && !res.destroyed; frame++) {
    res.write((ansi ? '\x1b[H\x1b[2J' : '\n') + sinkFrame(frame, ansi));
    if (frame < 18) await delay(115);
  }
  if (!res.destroyed) res.end(ansi ? '\x1b[0m' : '\n');
}

export async function handleTerminal(action, req, res) {
  const q = req.query || {};
  const ansi = q.color !== '0' && !Object.hasOwn(q, 'plain');
  if (action === 'terminal-home') {
    res.setHeader('Vary', 'User-Agent');
    return text(req, res, welcome(ansi));
  }
  if (action === 'terminal-race') {
    const { mode, leaders } = await readRaceBoard();
    const title = 'PARROT RACE · ' + (mode === 'shared' ? 'LIVE SCOREBOARD' : 'DEMO SCOREBOARD');
    const rows = leaders.map((entry,i) => (i+1) + '. ' + cleanName(entry.name) + ' · ' +
      (SCOUTS[entry.type]?.name || 'Scout') + ' · ' + entry.score + ' points · ' +
      (entry.mode === 'boat' ? 'Boat.dev VM' : 'Demo'));
    return text(req,res,(ansi ? '\x1b[1;38;5;49m' + title + '\x1b[0m' : title) + '\n' +
      (rows.join('\n') || 'No feathers have been posted yet.') + '\n' +
      'https://corvus.gent/hackersbay/race/leaderboard\n');
  }
  if (action === 'terminal-sink') {
    if (req.method !== 'HEAD' && !await available('terminal-sink', networkId(req), 24, 60)) {
      res.setHeader('Retry-After', '60');
      return text(req, res, 'The cannon needs a moment. Try again in a minute.\n', 429);
    }
    return sink(req, res, ansi);
  }
  if (action === 'terminal-ayay') {
    const shout = ansi ? '\x1b[1;38;5;49mAYE AYE!\x1b[0m' : 'AYE AYE!';
    return text(req, res, '  ✦  __     ✧\n    (o )>  ' + shout + '\n  \\/|_/    The crew salutes.\n     ^^     Captain Squawk\n');
  }
  if (action === 'terminal-squawk') {
    const tip = tips[Math.floor(Math.random() * tips.length)];
    return text(req, res, '   __\n  (o )>  SQUAWK! ' + tip + '\n  /|_/\n   ^^    Captain Squawk\n');
  }
  if (action === 'terminal-crew') {
    const totals = await readCrewCounts().catch(() => ({available:false}));
    const content = totals.available
      ? 'THE HACKERS BAY · LIVE CREW\nPirates created: ' + totals.pirates + '\nMutual matches: ' + totals.mutuals + '\n'
      : 'Live crew counts are unavailable.\n';
    return respond(req,res,totals,content);
  }

  const me = cleanName(q.me);
  const requested = q.class ?? q.lens;
  const selected = classIndex(requested ?? me);
  if (requested && selected < 0) {
    const error = 'Choose ' + CLASSES.join(', ') + '.';
    return respond(req,res,{error},error+'\n',400);
  }
  if (action === 'terminal-pirate') {
    const pirate = randomPirate(selected < 0 ? undefined : selected, q.name);
    const data = {
      ...pirate,
      share: 'https://corvus.gent/hackersbay/board?' + new URLSearchParams({pirate:pirate.name,class:pirate.type,...pirate.kit})
    };
    return respond(req,res,data,pirateArt(pirate,ansi) + '\n' + pirate.name + ' · ' + pirate.class + '\n' + data.share + '\n');
  }

  const type = TYPES[Math.max(0,selected)];
  const className = CLASSES[Math.max(0,selected)];
  const persona = preset(type);
  if (me && classIndex(me) < 0) persona.name = me;
  const ranked = matchRoom(persona, attendees).slice(0,3);
  if (action === 'terminal-match') {
    const matches = ranked.map(match => {
      const { yourReason, theirReason } = describeMatch(match);
      return {name:match.person.name, role:match.person.role, forYou:yourReason, forThem:theirReason};
    });
    const content = 'YOUR THREE CREWMATES · ' + className.toUpperCase() + ' · FICTIONAL DEMO ROSTER\n\n' +
      matches.map((match,i) => (i+1) + '. ' + match.name + '\n   For you: ' + match.forYou + '\n   For them: ' + match.forThem).join('\n') + '\n';
    return respond(req,res,{name:persona.name,class:className,roster:'fictional',matches},content);
  }

  const lens = lensFor(persona,event,ranked);
  const data = {title:event.title, startsAt:event.startsAt, endsAt:event.endsAt, timezone:event.timezone,
    venue:event.venue,address:event.address,entry:event.entry,rsvp:event.rsvp,class:className,lens,
    url:'https://corvus.gent'+EVENT_PATH};
  const when = new Intl.DateTimeFormat('en-US',{timeZone:event.timezone,weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'});
  const content = event.title + '\n' + when.format(new Date(event.startsAt)) + ' · ' + event.venue + ' · ' + event.address + '\n' +
    className + ' · ' + lens.title + ' (' + lens.score + '/100 demo score)\n' +
    lens.details.map(([label,value]) => label + ': ' + value).join('\n') + '\n' + data.url + '\n';
  return respond(req,res,data,content);
}
