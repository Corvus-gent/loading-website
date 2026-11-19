import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { formService, answerHash, normalize, csv, brusselsClock } from '../api/_forms/service.js';
const form = { slug: 'fixture', title: 'Test form', emailSubject: 'Test feedback', questions: [{ id: 'vote', label: 'Vote?', type: 'thumbs' }, { id: 'idea', label: 'Idea?', type: 'text' }] };
const rows = new Map(), locks = new Set(), delivered = new Set(), emails = [];
const store = {
  async get(_slug, id) { return rows.get(id); },
  async save(row) { const old = rows.get(row.sessionId); if (old && old.updatedAt >= row.updatedAt) return old; const saved = { ...row, createdAt: old?.createdAt || row.updatedAt, lastEmailedHash: old?.lastEmailedHash }; rows.set(row.sessionId, saved); return saved; },
  async list() { return [...rows.values()]; },
  async emailed(row, hash) { rows.get(row.sessionId).lastEmailedHash = hash; },
  async acquire(key) { if (locks.has(key)) return false; locks.add(key); return true; },
  async release(key) { locks.delete(key); },
  async delivered(key) { return delivered.has(key); },
  async markDelivered(key) { delivered.add(key); }
};
const date = new Date('2026-11-19T19:00:00Z');
const service = formService({ store, send: async email => { emails.push(email); }, now: () => date });
const input = { slug: 'fixture', sessionId: randomUUID(), updatedAt: date.toISOString(), answers: { vote: { vote: 'up', comment: 'works' }, idea: { text: 'hello' } } };
await service.save(form, input);
assert.equal(rows.size, 1);
await service.save(form, { ...input, updatedAt: '2026-11-19T18:00:00Z', answers: {} });
assert.equal(rows.get(input.sessionId).answers.idea.text, 'hello', 'late saves cannot erase newer answers');
await Promise.all([service.flush(form, input), service.flush(form, input)]);
assert.equal(emails.length, 1, 'simultaneous flushes send once');
assert.match(emails[0].text, /Vote\?\n👍\nworks/);
await service.flush(form, input); assert.equal(emails.length, 1, 'unchanged flush sends nothing');
const emptyInput = { ...input, sessionId: randomUUID(), answers: {} };
await service.flush(form, emptyInput); assert.equal(emails.length, 1, 'empty sessions send nothing');
const next = { ...input, sessionId: randomUUID() };
await service.save(form, next);
await service.digest([form]); assert.equal(emails.length, 2);
await service.digest([form]); assert.equal(emails.length, 2, 'digest sends once per Brussels day');
assert.equal(rows.get(next.sessionId).lastEmailedHash, answerHash(rows.get(next.sessionId)));
assert.equal(brusselsClock(new Date('2026-07-01T18:00:00Z')).hour, 20, 'summer DST');
assert.equal(brusselsClock(date).hour, 20, 'winter DST');
assert.throws(() => normalize({ ...input, answers: { vote: { vote: 'invalid' } } }, form, date.getTime()), /Invalid vote/);
assert.throws(() => normalize({ ...input, answers: { unknown: {} } }, form, date.getTime()), /Unknown question/);
const exported = csv(form, [{ ...rows.get(input.sessionId), answers: { idea: { text: '=IMPORTXML("https://bad")' } } }]);
assert.match(exported, /'=IMPORTXML/);
const before = emails.length;
const failing = formService({ store, send: async () => { throw Error('SMTP unavailable'); }, now: () => date });
const pending = { ...input, sessionId: randomUUID() }; await service.save(form, pending);
await assert.rejects(failing.flush(form, pending), /SMTP unavailable/);
assert.equal(rows.get(pending.sessionId).lastEmailedHash, undefined, 'SMTP failure remains retryable');
assert.equal(locks.size, 0, 'failed emails release their locks');
assert.equal(emails.length, before);
console.log('PASS: ordering, concurrent flushes, deduplication, empty sessions, digest, DST, validation, CSV and SMTP retry.');
