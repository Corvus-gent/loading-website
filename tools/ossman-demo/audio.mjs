import fs from 'node:fs/promises';
const SR=48000,LENGTH=24,BPM=140,beat=60/BPM,track=new Float64Array(SR*LENGTH);
let seed=1234567;function noise(){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)/2147483648-1;}
const midi=n=>440*2**((n-69)/12);
function tone(at,duration,freq,volume,type='square',end=freq){let phase=0;for(let i=0;i<duration*SR;i++){const k=Math.floor(at*SR)+i;if(k<0||k>=track.length)continue;const t=i/SR,p=t/duration;phase+=2*Math.PI*(freq+(end-freq)*p)/SR;const v=type==='sine'?Math.sin(phase):type==='triangle'?2/Math.PI*Math.asin(Math.sin(phase)):Math.sin(phase)>0?1:-1;const env=Math.min(1,t/.008)*Math.min(1,(duration-t)/.035);track[k]+=v*volume*env*Math.exp(-p*.9);}}
function hiss(at,duration,volume,low=.2){let v=0;for(let i=0;i<duration*SR;i++){const k=Math.floor(at*SR)+i;if(k<0||k>=track.length)continue;v+=low*(noise()-v);track[k]+=v*volume*Math.sin(Math.PI*i/(duration*SR));}}
// Original A-minor chiptune phrase; all instruments are synthesized here.
const chords=[[45,57,60,64],[41,53,57,60],[48,60,64,67],[43,55,59,62]];
for(let n=0;n<Math.ceil(LENGTH/beat);n++){const at=n*beat,ch=chords[Math.floor(n/8)%4];tone(at,.3,midi(ch[0]),.12,'triangle');tone(at,.13,105,.16,'sine',38);if(n%2===1)hiss(at,.12,.18,.7);for(let s=0;s<4;s++){const a=at+s*beat/4;tone(a,.075,midi(ch[1+(s+n)%3]+12),.045,'square');hiss(a,.025,.06,.9);}}
const bell=t=>{tone(t,.4,1200,.18,'sine',800);tone(t+.25,.5,1200,.16,'sine',800);};bell(2);
const events=JSON.parse(await fs.readFile('tests/results/ossman-demo/9x16-events.json','utf8')).events;
for(const e of events){const at=2+e.t;if(at>=18)continue;if(e.type==='token'){tone(at,.035,600,.025,'square',900);}if(e.type==='power'){[440,554,659,880].forEach((f,i)=>tone(at+i*.09,.2,f,.1));}if(e.type==='finish'){tone(at,.19,130,.3,'sine',35);hiss(at,.2,.3,.65);hiss(at+.04,.85,.25,.08);tone(at+.05,.55,190,.06,'sine',240);}if(e.type==='promote'){[523,659,784,1046].forEach((f,i)=>tone(at+i*.12,.3,f,.1));}}
tone(18,.25,880,.14,'square',440);bell(21);
let peak=0;for(const v of track)peak=Math.max(peak,Math.abs(v));const gain=.88/Math.max(1,peak),wav=Buffer.alloc(44+track.length*2);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(SR,24);wav.writeUInt32LE(SR*2,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(track.length*2,40);for(let i=0;i<track.length;i++){const fade=Math.min(1,(track.length-i)/(SR*.06));wav.writeInt16LE(Math.round(Math.max(-1,Math.min(1,track[i]*gain*fade))*32767),44+i*2);}await fs.writeFile('tests/results/ossman-demo/soundtrack.wav',wav);console.log('Original 24s / 140 BPM chiptune + synchronized bell, crunch, impact and crowd FX.');
