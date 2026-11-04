import assert from 'node:assert/strict';import {redis} from '../api/_redis.js';import game,{puzzle,publicPuzzle,applyGuess,wordFeedback,dateKey,number,CYCLE,distance} from '../api/_game.js';
if(process.env.REDIS_URL!=='redis://127.0.0.1:16380/15')throw Error('isolated Redis required');await redis(['FLUSHDB']);
const RealDate=Date;globalThis.Date=class extends RealDate{constructor(...args){super(...(args.length?args:['2026-11-04T12:00:00Z']));}static now(){return RealDate.parse('2026-11-04T12:00:00Z');}};
assert.equal(dateKey(new Date('2026-11-03T23:01:00Z')),'2026-11-04');assert.equal(dateKey(new Date('2027-03-28T22:01:00Z')),'2027-03-29');assert.equal(number('2026-11-04'),1);assert.equal(wordFeedback('allee','apple'),'🟩🟨⬛⬛🟩');assert.equal(distance({lat:50,lng:4},{lat:50,lng:4}).km,0);
const solutions=[];
for(let i=0;i<8;i++){const day=new Date(Date.parse('2026-11-04')+i*86400000).toISOString().slice(0,10);if(i===6)await redis(['SET',`game:city:${day}`,JSON.stringify({name:'Ghent',lat:51.1,lng:3.7})]);const p=await puzzle(day);assert.equal(p.type,CYCLE[i]);let s={history:[],cells:[],deadline:Date.now()+10000};assert.ok(!('answer'in publicPuzzle(p,s)));assert.ok(!('country'in publicPuzzle(p,s)));if(p.type==='flags'){for(let j=0;j<5;j++)applyGuess(p,s,j%2?p.rounds[j].country.capital:p.rounds[j].country.name);}else if(p.type==='combo'){applyGuess(p,s,p.language.name);applyGuess(p,s,p.language.country);}else applyGuess(p,s,p.type==='babel'?p.language.name:p.type==='borders'?p.country.name:p.type==='bangle'?p.artist.name:p.type==='pingle'?{lat:51.1,lng:3.7}:p.answer);assert.ok(s.done&&s.solved,p.type);assert.ok(publicPuzzle(p,s).answer);solutions.push(p.type);}
function response(){return{code:200,headers:{},setHeader(k,v){this.headers[k]=v;},status(n){this.code=n;return this;},json(body){this.body=body;return this;},send(body){this.body=body;return this;},end(){return this;}};}
async function call({method='GET',body={},cookie='',query={},origin='https://corvus.gent'}={}){const r=response();await game({method,body,query,headers:{host:'corvus.gent',origin,cookie,'x-forwarded-for':'test'}},r);return r;}
let first=await call();assert.equal(first.code,200);const cookie=first.headers['Set-Cookie'].split(';')[0];const today=dateKey(),p=await puzzle(today);assert.equal((await call({query:{day:'2099-01-01'}})).code,404);assert.equal((await call({method:'POST',cookie,origin:'https://evil.test',body:{day:today}})).code,403);assert.equal((await call({method:'POST',cookie:cookie+'bad',body:{day:today}})).code,401);assert.equal((await call({method:'POST',cookie,body:{day:'2099-01-01'}})).code,409);
// Completion/replay counts are one atomic Redis commit.
const value=p.language.name;const solved=await call({method:'POST',cookie,body:{day:today,index:0,value}});assert.equal(solved.code,200);assert.equal(solved.body.solved,true);await Promise.all(Array.from({length:4},()=>call({method:'POST',cookie,body:{day:today,index:0,value}})));assert.equal(await redis(['HGET',`games:day:${today}`,'played']),'1');assert.equal(await redis(['HGET',`games:day:${today}`,'solved']),'1');
// Malformed inputs never consume a guess. Separate browser identity.
const second=await call();const cookie2=second.headers['Set-Cookie'].split(';')[0];assert.equal((await call({method:'POST',cookie:cookie2,body:{day:today,index:0,value:'not a language'}})).code,400);assert.equal((await call({cookie:cookie2})).body.history.length,0);
for(let i=1;i<8;i++){
 const millis=RealDate.parse('2026-11-04T12:00:00Z')+i*86400000;
 globalThis.Date=class extends RealDate{constructor(...args){super(...(args.length?args:[millis]));}static now(){return millis;}};
 const d=dateKey();if(i===6)await redis(['SET',`game:city:${d}`,JSON.stringify({name:'Ghent',lat:51.1,lng:3.7})]);
 const pp=await puzzle(d),opened=await call();assert.equal(opened.code,200,pp.type);assert.equal(opened.body.answer,undefined);
 const ck=opened.headers['Set-Cookie'].split(';')[0];let idx=0;
 const submit=async value=>{const r=await call({method:'POST',cookie:ck,body:{day:d,index:idx++,value}});assert.equal(r.code,200,JSON.stringify(r.body));return r.body;};
 if(i===7){const image=await call({method:'POST',cookie:ck,body:{day:d,action:'reveal',cell:44}});assert.equal(image.headers['Content-Type'],'image/png');assert.equal(image.body.subarray(1,4).toString(),'PNG');assert.equal((await call({cookie:ck})).body.light,1);}
 let end;
 if(pp.type==='flags'){assert.equal(opened.body.deadline,null);await call({method:'POST',cookie:ck,body:{day:d,action:'start'}});for(let j=0;j<5;j++)end=await submit(j%2?pp.rounds[j].country.capital:pp.rounds[j].country.name);}
 else if(pp.type==='combo'){await submit(pp.language.name);end=await submit(pp.language.country);}
 else end=await submit(pp.type==='borders'?pp.country.name:pp.type==='bangle'?pp.artist.name:pp.type==='pingle'?{lat:51.1,lng:3.7}:pp.answer);
 assert.ok(end.done&&end.solved,pp.type);assert.ok(end.answer);assert.equal((await call({cookie:ck})).body.done,true);
}
globalThis.Date=RealDate;
console.log('Passed: all eight engines, DST, repeated letters, future-day denial, no public answers, origin/cookie checks, invalid guesses, replay/concurrent dedupe.');process.exit(0);
