import React from 'react';
import { AbsoluteFill, Audio, Composition, Img, interpolate, registerRoot, Sequence, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { DURATIONS, FPS, timeline } from './timing.mjs';
import './sonar.css';
import { Cut, CUTS, NavalBookend, Pitch, VIDEO_FPS } from './cuts.jsx';

const names = ['Mina Park', 'Lena Moss', 'Noor Tan'];
const reasons = ['Find a design co-founder', 'Run a customer interview', 'Meet your first design partners'];
const locks = [[65, 27], [30, 43], [67, 69]];
const frames = seconds => Math.round(seconds * FPS);
const range = (value, input, output) => interpolate(value, input, output, { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

function Chrome({ children, note = 'BOAT HACKATHON DEMO DAY' }) {
  return <AbsoluteFill className="scene">
    <div className="video-bar"><span><Img src={staticFile('parrot-flag.svg')} /> THE HACKERS BAY</span><span>PIER 09 · SF</span></div>
    {children}
    <div className="video-foot"><span>{note}</span><span className="teal">37°47′ N · 122°23′ W</span></div>
  </AbsoluteFill>;
}

function Sonar({ rotation, lockCount = 0, ambient = true }) {
  return <div className="sonar">
    <div className="sweep" style={{ transform: `rotate(${rotation}deg)` }} />
    {[12, 24, 36].map(inset => <div className="ring" key={inset} style={{ inset: inset + '%' }} />)}
    <span className="bearing north">N</span><span className="bearing south">S</span>
    <span className="bearing west">W</span><span className="bearing east">E</span>
    <div className="center-dot" />
    {ambient && Array.from({ length: 27 }, (_, index) => {
      const angle = index * 2.39996;
      const radius = 42 * Math.sqrt((index + 1) / 27);
      const power = .27 + .63 * (.5 + .5 * Math.sin(rotation / 22 - index * .73));
      return <span className="dot" key={index} style={{
        left: `${50 + Math.cos(angle) * radius}%`, top: `${50 + Math.sin(angle) * radius}%`, opacity: power
      }} />;
    })}
    {locks.slice(0, lockCount).map(([x, y], index) => <span className="lock" key={index} style={{ left: x + '%', top: y + '%' }}>
      <b>×</b><small>{String(index + 1).padStart(2, '0')}</small>
    </span>)}
  </div>;
}

function typed(text, frame, begin, perFrame = 1) {
  return text.slice(0, Math.max(0, Math.floor((frame - begin) * perFrame)));
}

function Boarding() {
  const frame = useCurrentFrame();
  const fields = [['Builds', 'Developer tools & working demos'], ['Wants', 'A co-founder and honest feedback'], ['Offers', 'Backend engineering and fast prototyping']];
  return <Chrome note="ONE PUBLIC LINK">
    <div className="split stage">
      <div className="stage-copy"><p className="eyebrow">BOARD THE SHIP</p><h1>One link.<br /><em>One crew card.</em></h1><p className="sub">Get a lens on the room before you go.</p></div>
      <div className="interface">
        <div className="interface-top"><span>PUBLIC PROFILE</span><span className="teal">CONTEXT.DEV</span></div>
        <div className="input-mock">{typed('github.com/example/dockside', frame, 1, 1.65)}<span className="cursor">▌</span></div>
        <div className="crew-mock" style={{ opacity: range(frame, [16, 24], [0, 1]), transform: `translateY(${range(frame, [16, 30], [30, 0])}px)` }}>
          <p className="eyebrow">YOUR CREW CARD</p><h2>Busy builder</h2>
          {fields.map(([label, text], index) => <div className="field" key={label}><b>{label}</b><span>{typed(text, frame, 23 + 12 * index, 2.9)}</span></div>)}
        </div>
      </div>
    </div>
  </Chrome>;
}

function Matches() {
  const frame = useCurrentFrame();
  const count = [.4, 1.05, 1.7].filter(seconds => frame >= frames(seconds)).length;
  return <Chrome note="WORTH-IT SCORE · DEMO ROSTER">
    <div className="split stage match-stage">
      <div className="sonar-shell"><Sonar rotation={frame * 4.6} lockCount={count} /></div>
      <div className="stage-copy">
        <p className="eyebrow">× {count} MATCHES LOCKED</p><h1>Three people.<br /><em>Three reasons.</em></h1>
        <div className="match-drafts">
          {names.map((name, index) => <div className="match-draft" key={name} style={{ opacity: index < count ? 1 : 0 }}>
            <b>×</b><div><strong>{name}</strong><small>{reasons[index]}</small></div>
          </div>)}
        </div>
      </div>
    </div>
  </Chrome>;
}

function Consent() {
  const frame = useCurrentFrame();
  const requested = frame >= 10;
  const accepting = frame >= 26;
  return <Chrome note="DOUBLE OPT-IN · FICTIONAL DEMO">
    <div className="stage mutual consent-stage">
      <p className="eyebrow">INTRO REQUEST · MINA PARK</p>
      <h1>{accepting ? <>Mina’s <em>turn.</em></> : <>Make the <em>ask.</em></>}</h1>
      <div className="consent-status">
        <div className="end-cta">{!requested ? 'Intro me' : accepting ? 'Accept intro' : '✓ You opted in'}</div>
        <p>{!requested ? 'Send one reason to meet.' : accepting ? 'The recipient chooses.' : 'Waiting for the other side…'}</p>
      </div>
    </div>
  </Chrome>;
}

function Mutual() {
  const frame = useCurrentFrame();
  const punch = range(frame, [0, 12, 25], [.88, 1.045, 1]);
  const reveal = range(frame, [14, 27], [0, 1]);
  return <Chrome note="DOUBLE OPT-IN · FICTIONAL DEMO">
    <div className="stage mutual">
      <div className="consent"><span>✓ YOU OPTED IN</span><span>✓ MINA OPTED IN</span></div>
      <div className="mutual-lock" style={{ transform: `scale(${punch})` }}><Img src={staticFile('anchor.svg')} /><h1>IT’S MUTUAL</h1></div>
      <p className="meetup" style={{ opacity: reveal }}>14:15 PT · CONFERENCE CENTER ENTRANCE</p>
    </div>
  </Chrome>;
}

function Film({ seconds }) {
  const { durationInFrames, width, height } = useVideoConfig();
  const cue = timeline(seconds);
  const entries = [
    [0, cue.board, <NavalBookend wide={width > height} />],
    [cue.board, cue.sonar, <Boarding />],
    [cue.sonar, cue.consent, <Matches />],
    [cue.consent, cue.mutual, <Consent />],
    [cue.mutual, cue.end, <Mutual />],
    [cue.end, cue.total, <NavalBookend wide={width > height} closing />]
  ];
  return <AbsoluteFill className="film">
    <style>{`@font-face{font-family:Inter;src:url("${staticFile('inter.woff2')}");font-weight:400 900}@font-face{font-family:JetBrains;src:url("${staticFile('jetbrains-mono.woff2')}");font-weight:400 700}`}</style>
    <Audio src={staticFile(`mix-${seconds}.wav`)} endAt={durationInFrames} />
    {entries.map(([start, end, scene]) => <Sequence key={start} from={frames(start)} durationInFrames={frames(end) - frames(start)}>{scene}</Sequence>)}
  </AbsoluteFill>;
}

function Root() {
  return [...DURATIONS.flatMap(seconds => [
    <Composition key={'vertical' + seconds} id={'SonarVertical' + seconds} component={Film} defaultProps={{ seconds }} fps={FPS} durationInFrames={frames(seconds)} width={1080} height={1920} />,
    <Composition key={'wide' + seconds} id={'SonarWide' + seconds} component={Film} defaultProps={{ seconds }} fps={FPS} durationInFrames={frames(seconds)} width={1920} height={1080} />
  ]), <Composition key="pitch" id="Pitch" component={Pitch} defaultProps={{footage:{}}} fps={VIDEO_FPS} durationInFrames={120 * VIDEO_FPS} width={1920} height={1080} />, ...CUTS.map(({id, hook}) => <Composition key={id} id={id} component={Cut} defaultProps={{hook, footage:{}}} fps={VIDEO_FPS} durationInFrames={60 * VIDEO_FPS} width={1080} height={1920} />)];
}

registerRoot(Root);
