import assert from 'node:assert/strict';
import {ENTRANCES, brusselsDay, isChoice, resolveEntrance} from '../js/entry-days/calendar.js';
assert.equal(ENTRANCES.length, 7);
assert.equal(new Set(ENTRANCES.map(d => d.id)).size, 7);
for (const zone of ['America/Los_Angeles', 'UTC', 'Asia/Shanghai']) {
  process.env.TZ = zone;
  for (const [date, day] of [
    ['2026-11-22T22:59:59Z', 'sun'], ['2026-11-22T23:00:00Z', 'mon'],
    ['2026-07-19T21:59:59Z', 'sun'], ['2026-07-19T22:00:00Z', 'mon'],
    ['2026-03-29T00:59:59Z', 'sun'], ['2026-03-29T01:00:00Z', 'sun'],
    ['2026-10-25T00:59:59Z', 'sun'], ['2026-10-25T01:00:00Z', 'sun'],
  ]) assert.equal(brusselsDay(new Date(date)), day, `${zone} ${date}`);
}
const monday = new Date('2026-11-23T12:00:00Z');
assert.deepEqual(resolveEntrance('today', 'fri', monday), {choice: 'today', day: 'mon'});
assert.deepEqual(resolveEntrance('tue', 'fri', monday), {choice: 'tue', day: 'tue'});
assert.deepEqual(resolveEntrance(null, 'fri', monday), {choice: 'fri', day: 'fri'});
assert.deepEqual(resolveEntrance('nonsense', null, monday), {choice: 'today', day: 'mon'});
for (const value of ['__proto__', '', 'MON', null, undefined, '<script>']) assert.equal(isChoice(value), false);
console.log('Seven Brussels weekdays, DST, midnight boundaries, URL precedence and preference validation passed.');
