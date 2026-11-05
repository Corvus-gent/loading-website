import assert from 'node:assert/strict';
import {ZONES,clockPair,localInstants,sfLoggedTime} from '../js/x-time.js';
const slot=(date,time,zone=ZONES.bx)=>localInstants(date,time,zone);
let p=clockPair(slot('2026-11-04','08:00')[0]);
assert.deepEqual(p.bx,{date:'2026-11-04',time:'08:00',hour:8});
assert.deepEqual(p.sf,{date:'2026-11-03',time:'23:00',hour:23});assert.equal(p.gap,9);
for(const date of ['2026-03-15','2026-10-28'])assert.equal(clockPair(slot(date,'12:00')[0]).gap,8);
for(const date of ['2026-01-15','2026-07-15','2026-11-04'])assert.equal(clockPair(slot(date,'12:00')[0]).gap,9);
assert.equal(slot('2026-03-29','02:30').length,0);
assert.equal(slot('2026-03-08','02:30',ZONES.sf).length,0);
assert.equal(slot('2026-02-30','10:00').length,0);
assert.equal(slot('2026-11-04','24:00').length,0);
assert.equal(slot('2026-10-25','02:00').length,2);
const repeated=slot('2026-11-01','01:30',ZONES.sf);
assert.equal(repeated.length,2);assert.equal(repeated[1]-repeated[0],3600000);
assert.equal(clockPair(repeated[0]).bx.time,'09:30');assert.equal(clockPair(repeated[1]).bx.time,'10:30');
assert.equal(sfLoggedTime('2026-11-04',9),'2026-11-04 00:00');
assert.equal(sfLoggedTime('2026-10-25',2),'2026-10-24 17:00 or 2026-10-24 18:00 · repeated bx hour');
assert.match(sfLoggedTime('2026-03-29',2),/no matching time/);
assert.match(sfLoggedTime('2026-11-04',null),/invalid logged hour/);
// Every valid logged hour around all four clock changes round-trips from either
// city, independent of the machine/browser's own timezone.
for(const month of [3,10,11])for(let day=1;day<=31;day++)for(let hour=0;hour<24;hour++){
 const date=`2026-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`,time=`${String(hour).padStart(2,'0')}:00`;
 for(const at of slot(date,time))for(const [id,zone]of Object.entries(ZONES)){
  const c=clockPair(at)[id];assert.ok(slot(c.date,c.time,zone).includes(at));
 }
}
console.log('BX/SF clocks: day boundaries, 8/9h gaps, both DST gaps/repeats and round-trips passed.');
