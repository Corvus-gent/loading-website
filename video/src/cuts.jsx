import React, { useLayoutEffect, useRef, useState } from 'react';
import { AbsoluteFill, Audio, continueRender, delayRender, Img, OffthreadVideo, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { battlePhase, makeArtworkSea } from '../../public/hackersbay/assets/art-sea.js';
import './cuts.css';

export const VIDEO_FPS = 30;
export const CUTS = [
  {id: 'CutA', hook: 'sink'},
  {id: 'CutB', hook: 'boat'},
  {id: 'CutC', hook: 'car'}
];
const frames = seconds => seconds * VIDEO_FPS;
const art = name => staticFile(name + '.webp');
const loadImage = name => new Promise((resolve, reject) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = reject;
  img.src = art(name);
});
const clips = {
  boat: ['Gabe stepping aboard', 'Gabe’s boat-step clip'],
  car: ['Gabe · remote hacker in Europe', 'Gabe’s in-car selfie'],
  deck: ['Colin · Historic Klamath, San Francisco', 'Colin’s Klamath deck clip']
};

function Naval({ closing = false }) {
  const frame = useCurrentFrame();
  const canvas = useRef(null);
  const paint = useRef(null);
  const time = frame / VIDEO_FPS;
  const shot = Math.min(9.6, 1.5 + time * (closing ? 1.2 : 1.62));
  const phase = battlePhase(shot);
  const [handle] = useState(() => delayRender('Load The Black Commit'));
  useLayoutEffect(() => {
    let disposed = false;
    makeArtworkSea(canvas.current, loadImage).then(draw => {
      if (disposed) return;
      paint.current = draw;
      draw(shot);
    }).finally(() => continueRender(handle));
    return () => { disposed = true; };
  }, [handle]);
  useLayoutEffect(() => { paint.current?.(shot); }, [shot]);
  return <AbsoluteFill className="hc-naval">
    <div className="hc-horizon"><canvas ref={canvas} /></div>
    <div className="hc-copy">
      <p>THE BLACK COMMIT</p>
      {phase === 'aim' ? <h1>LUMA IN<br />OUR SIGHTS.</h1> : phase === 'impact'
        ? <h1 className="hc-blast">WE BLASTED<br />LUMA.</h1>
        : <h1>LUMA IS<br /><em>SINKING.</em></h1>}
      {phase === 'sink' && !closing && <p className="hc-sink-line">The Hackers Bay is coming.</p>}
    </div>
    {closing && <div className="hc-end">
      <h2>The Hackers Bay is coming.</h2>
      <Img className="hc-qr" src={staticFile('boarding-qr.svg')} />
      <strong>corvus.gent/hackersbay</strong>
      <small>Built aboard Boat Hackathon</small>
    </div>}
  </AbsoluteFill>;
}

function CutFonts() {
  return <style>{`@font-face{font-family:CutPixel;src:url("${staticFile('silkscreen.woff2')}")}@font-face{font-family:CutInter;src:url("${staticFile('inter.woff2')}");font-weight:400 900}`}</style>;
}

export function NavalBookend({ wide, closing }) {
  return <AbsoluteFill className={'hc-film' + (wide ? ' hc-pitch' : '')}>
    <CutFonts />
    <Naval closing={closing} />
  </AbsoluteFill>;
}

function Proof({ clip, footage }) {
  const [title, missing] = clips[clip];
  return <AbsoluteFill className="hc-proof">
    {footage[clip] && <OffthreadVideo src={staticFile(footage[clip])} muted style={{ width:'100%', height:'100%', objectFit:'cover' }} />}
    <div className="hc-proof-body">
      <p>PROOF OF BOAT</p>
      <h1>{title}</h1>
      {!footage[clip] && <>
        <Img src={art(clip === 'car' ? 'squawk-typing' : 'squawk-wave')} />
        <strong>Footage slot · {missing}</strong>
      </>}
      <small>Built from a car in Europe + a boat in SF.</small>
    </div>
  </AbsoluteFill>;
}

const crew = [
  ['Kai Compass', 'A lower-cost way to get there.', 'navigator'],
  ['Devon Lastplate', 'Knows where to find free food.', 'quartermaster'],
  ['Tess Goldledger', 'Can check prize payout terms.', 'merchant']
];
const bearings = [[21, 43], [73, 24], [69, 74]];

function Story({ beat }) {
  const frame = useCurrentFrame();
  const locked = Math.min(3, Math.floor(frame / 72) + 1);
  return <AbsoluteFill className="hc-story">
    <p className="hc-kicker">THE HACKERS BAY</p>
    {beat === 'builder' && <>
      <h1>BUILD YOUR <em>PIRATE.</em></h1>
      <Img className="hc-character" src={art(frame < 65 ? 'crew-navigator' : frame < 130 ? 'crew-quartermaster' : 'crew-deckhand')} />
      <div className="hc-note"><strong>{'Copper Byte'.slice(0, frame / 7)}</strong><span>Deckhand · “Find food, a bunk, and a prize that pays.”</span></div>
    </>}
    {beat === 'lens' && <>
      <h1>IS THIS WORTH <em>BOARDING?</em></h1>
      <Img className="hc-character" src={art('crew-deckhand')} />
      <div className="hc-note"><strong>Boat Hackathon Demo Day</strong><span>Historic Klamath · Pier 9, SF</span><span>Food, a bunk, payout terms. Check before you board.</span></div>
    </>}
    {beat === 'radar' && <>
      <h1>FIND YOUR <em>THREE.</em></h1>
      <div className="hc-radar">
        <div className="hc-sweep" style={{transform: 'rotate(' + frame * 4 + 'deg)'}} />
        {bearings.slice(0, locked).map(([x,y], i) => <strong key={x} style={{left: x + '%', top: y + '%'}}>{i + 1} ×</strong>)}
      </div>
      <div className="hc-crew">
        {crew.slice(0, locked).map(([name, reason, kind]) => <div className="hc-note" key={name}><Img src={art('crew-' + kind)} /><div><strong>{name}</strong><span>{reason}</span></div></div>)}
      </div>
    </>}
    {beat === 'mutual' && <>
      <p className="hc-kicker">YOU SAID YES · THEY SAID YES</p>
      <h1>IT’S <em>MUTUAL ⚓</em></h1>
      <Img className="hc-mutual" src={art('mutual-beak-bump')} />
      <div className="hc-note"><strong>14:15 PT · Conference Center entrance</strong><span>Fictional demo introduction</span></div>
    </>}
  </AbsoluteFill>;
}

export function Cut({ hook, footage = {} }) {
  const proof = hook === 'car' ? ['car','boat','deck'] : ['boat','car','deck'];
  const scenes = [
    [0, hook === 'sink' ? 7 : 2, <Naval />],
    [hook === 'sink' ? 7 : 2, 9, <Proof clip={proof[0]} footage={footage} />],
    [9, 12, <Proof clip={proof[1]} footage={footage} />],
    [12, 15, <Proof clip="deck" footage={footage} />],
    [15, 23, <Story beat="builder" />],
    [23, 31, <Story beat="lens" />],
    [31, 44, <Story beat="radar" />],
    [44, 52, <Story beat="mutual" />],
    [52, 60, <Naval closing />]
  ];
  return <AbsoluteFill className="hc-film">
    <CutFonts />
    <Audio src={staticFile('mix-cuts.wav')} />
    {scenes.map(([start,end,scene]) => <Sequence key={start} from={frames(start)} durationInFrames={frames(end - start)}>{scene}</Sequence>)}
  </AbsoluteFill>;
}

const pitchBeats = {
  wall: ['RSVP TO PEOPLE, NOT PLACES.', 'We love you, Luma. But a guest list full of grey circles can’t tell us whether to go, or whom to meet.', 'squawk-squawk'],
  logistics: ['WILL THIS BE WORTH MY TIME?', 'A Deckhand checks food, sleep, travel, and prize terms. A Navigator checks the quality of the room, co-founder fit, and time cost.', 'crew-deckhand'],
  class: ['FOUR CLASSES. ONE ROOM.', 'The Quartermaster finds the best crew. The Merchant looks for builders worth backing. Start with a class, then tell us what you build, want, and offer.', 'crew-quartermaster'],
  privacy: ['PRIVATE PARROT.', 'Context.dev reads public links. Boat.dev can give the scout a sandbox. Private Parrot uses NYTEX TrustedRouter and shows “verified” only for a verified receipt.', 'squawk-typing'],
  import: ['SINK A LUMA.', 'Paste any public Luma event link. We pull the public event facts that we can verify and apply your lens. Missing facts stay marked.', 'squawk-thumbs-up'],
  host: ['BUILD THE ROOM.', 'Import your event. Share “Build your pirate to board.” Rank applicants by what they add, then drag them aboard and see the two-way fits.', 'crew-quartermaster'],
  honest: ['STRAIGHT TALK.', 'The Demo Day roster is fictional. The organizer invite and consent workflows run live with Redis. Sponsor integrations show labeled fallbacks when credentials are missing.', 'squawk-wave']
};

function PitchBeat({ beat }) {
  const [title, words, sprite] = pitchBeats[beat];
  return <AbsoluteFill className="hc-pitch-beat">
    <div><p className="hc-kicker">THE HACKERS BAY · BOAT HACKATHON</p><h1>{title}</h1><p className="hc-pitch-words">{words}</p></div>
    {beat === 'wall' ? <div className="hc-wall" aria-hidden="true">{Array.from({length:20}, (_, i) => <i key={i} />)}</div>
      : <Img src={art(sprite)} />}
  </AbsoluteFill>;
}

export function Pitch({ footage = {} }) {
  const scenes = [
    [0, 7, <Naval />],
    [7, 16, <PitchBeat beat="wall" />],
    [16, 21, <Proof clip="car" footage={footage} />],
    [21, 25, <Proof clip="boat" footage={footage} />],
    [25, 29, <Proof clip="deck" footage={footage} />],
    [29, 38, <Story beat="builder" />],
    [38, 46, <PitchBeat beat="logistics" />],
    [46, 54, <PitchBeat beat="class" />],
    [54, 62, <PitchBeat beat="privacy" />],
    [62, 71, <Story beat="radar" />],
    [71, 81, <Story beat="mutual" />],
    [81, 90, <PitchBeat beat="import" />],
    [90, 101, <PitchBeat beat="host" />],
    [101, 110, <PitchBeat beat="honest" />],
    [110, 120, <Naval closing />]
  ];
  return <AbsoluteFill className="hc-film hc-pitch">
    <CutFonts />
    <Audio src={staticFile('mix-pitch.wav')} />
    {scenes.map(([start,end,scene]) => <Sequence key={start} from={frames(start)} durationInFrames={frames(end - start)}>{scene}</Sequence>)}
  </AbsoluteFill>;
}
