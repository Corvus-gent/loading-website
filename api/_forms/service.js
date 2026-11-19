import { createHash, randomUUID } from 'node:crypto';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export class FormError extends Error { constructor(message, status = 400) { super(message); this.status = status; } }
export function identity(input, form) {
  if (!form || input.slug !== form.slug || !UUID.test(input.sessionId || '')) throw new FormError('Invalid form or session.');
  return { slug: form.slug, sessionId: input.sessionId.toLowerCase() };
}
export function normalize(input, form, now = Date.now()) {
  const id = identity(input, form);
  if (!input.answers || typeof input.answers !== 'object' || Array.isArray(input.answers)) throw new FormError('Invalid answers.');
  const at = Date.parse(input.updatedAt);
  if (!Number.isFinite(at) || at > now + 300000) throw new FormError('Invalid update time.');
  const allowed = new Set(form.questions.map(q => q.id));
  if (Object.keys(input.answers).some(key => !allowed.has(key))) throw new FormError('Unknown question.');
  const answers = {};
  for (const q of form.questions) {
    const raw = input.answers[q.id];
    if (raw === undefined) continue;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new FormError('Invalid answer.');
    const field = q.type === 'thumbs' ? 'comment' : 'text';
    const value = raw[field] ?? '';
    if (typeof value !== 'string' || value.length > 10000) throw new FormError('Answer exceeds 10,000 characters.');
    if (q.type === 'thumbs') {
      const vote = raw.vote ?? null;
      if (vote !== null && !['up', 'down'].includes(vote)) throw new FormError('Invalid vote.');
      answers[q.id] = { vote, comment: value.trim() };
    } else answers[q.id] = { text: value.trim() };
  }
  return { ...id, answers, receivedAt: new Date(now).toISOString(), updatedAt: new Date(at).toISOString() };
}
export const answerHash = row => createHash('sha256').update(JSON.stringify(row.answers)).digest('hex');
export const empty = row => !Object.values(row.answers).some(a => a.vote || a.comment?.trim() || a.text?.trim());
export function readable(form, row) {
  return [`${form.title}`, `Session: ${row.sessionId}`, `Updated: ${row.updatedAt}`, '', ...form.questions.map(q => {
    const a = row.answers[q.id] || {};
    return `${q.label}\n${q.type === 'thumbs' ? (a.vote === 'up' ? '👍' : a.vote === 'down' ? '👎' : 'No vote') + (a.comment ? '\n' + a.comment : '') : a.text || 'No answer'}\n`;
  })].join('\n');
}
const csvCell = value => {
  let text = String(value ?? '');
  // Prevent user-supplied text becoming a spreadsheet formula on opening CSV.
  if (/^[\s]*[=+@-]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
};
export function csv(form, rows) {
  const headers = ['sessionId', 'createdAt', 'updatedAt', 'lastEmailedAt', ...form.questions.flatMap(q => q.type === 'thumbs' ? [q.label + ' — vote', q.label + ' — comment'] : [q.label])];
  return '\uFEFF' + [headers, ...rows.map(row => [row.sessionId, row.createdAt, row.updatedAt, row.lastEmailedAt, ...form.questions.flatMap(q => { const a = row.answers[q.id] || {}; return q.type === 'thumbs' ? [a.vote || '', a.comment || ''] : [a.text || '']; })])].map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
export function brusselsClock(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Brussels', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(now).map(p => [p.type, p.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) };
}
export function formService({ store, send, now = () => new Date() }) {
  async function flush(form, input) {
    const { slug, sessionId } = identity(input, form);
    const lock = `${slug}:${sessionId}`, token = randomUUID();
    if (!await store.acquire(lock, token)) return { sent: false, pending: true };
    try {
      // A leave beacon may carry the latest draft too, so it cannot overtake save.
      if (input.answers) await store.save(normalize(input, form, now().getTime()));
      const row = await store.get(slug, sessionId);
      if (!row || empty(row)) return { sent: false, empty: true };
      const hash = answerHash(row);
      if (row.lastEmailedHash === hash) return { sent: false, unchanged: true };
      await send({ subject: form.emailSubject, text: readable(form, row) });
      await store.emailed(row, hash, now().toISOString());
      return { sent: true };
    } finally { await store.release(lock, token); }
  }
  async function digest(forms) {
    const clock = brusselsClock(now());
    if (clock.hour !== 20) return { skipped: 'timezone' };
    const key = 'digest:' + clock.date, token = randomUUID();
    if (!await store.acquire(key, token)) return { skipped: 'running' };
    const held = [];
    try {
      if (await store.delivered(key)) return { skipped: 'already sent' };
      for (const form of forms) for (const row of await store.list(form.slug, now().getTime() - 86400000)) {
        if (empty(row) || row.lastEmailedHash === answerHash(row)) continue;
        const name = `${form.slug}:${row.sessionId}`, lease = randomUUID();
        if (!await store.acquire(name, lease)) continue;
        held.push({ name, lease });
        const latest = await store.get(form.slug, row.sessionId);
        if (latest && !empty(latest) && latest.lastEmailedHash !== answerHash(latest)) held.at(-1).entry = { form, row: latest, hash: answerHash(latest) };
      }
      const entries = held.map(item => item.entry).filter(Boolean);
      if (!entries.length) return { sent: false, count: 0 };
      await send({ subject: 'Corvus feedback digest — ' + clock.date, text: entries.map(({ form, row }) => readable(form, row)).join('\n\n────────────────────\n\n') });
      for (const { row, hash } of entries) await store.emailed(row, hash, now().toISOString());
      await store.markDelivered(key);
      return { sent: true, count: entries.length };
    } finally {
      await Promise.all(held.map(({ name, lease }) => store.release(name, lease)));
      await store.release(key, token);
    }
  }
  return { save: (form, input) => store.save(normalize(input, form, now().getTime())), flush, digest };
}
