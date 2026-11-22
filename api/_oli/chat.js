import { randomUUID } from 'node:crypto';
import { imageForModel, imagePath } from './media.js';
import { history, saveChat, state, timelineFor } from './store.js';
import { applyEdit } from './timeline.js';

const tool = {
  type: 'function',
  function: {
    name: 'propose_edit',
    description: 'Queue an actionable edit to the current cut.',
    parameters: {
      type: 'object', required: ['summary', 'ops'], additionalProperties: false,
      properties: {
        summary: { type: 'string', description: 'A short human-readable diff with clip numbers starting at 1.' },
        ops: {
          type: 'array',
          items: {
            type: 'object', required: ['type'], additionalProperties: false,
            properties: {
              type: { type: 'string', enum: ['trim', 'reorder', 'remove', 'recrop', 'caption', 'hook', 'toggle'] },
              seg: { type: 'integer' }, a: { type: 'number' }, b: { type: 'number' },
              from: { type: 'integer' }, to: { type: 'integer' }, cx: { type: 'number' },
              lang: { type: 'string', enum: ['en', 'zh'] }, lines: { type: 'array', items: { type: 'string' } },
              flag: { type: 'string', enum: ['cam', 'dark'] }, on: { type: 'boolean' }
            }
          }
        }
      }
    }
  }
};

const rules = `You are the editor for Oli Silvestro, a 10x BJJ world champ in Sydney.
His promise is “I teach you how to get better faster”. Reply briefly in English.
Make subtle make-up edits. Trailers are about 40 seconds max. No meme overlays.
Keep text minimal and use a camcorder look only on opening wake-up shots.
Propose actionable edits with propose_edit. Use zero-based positions in the current
segments array, evaluated in the order of the operations. Include only the fields
for each operation: trim(seg,a,b), reorder(from,to), remove(seg), recrop(seg,cx),
caption(seg,lang,lines), hook(lang,lines), toggle(seg,flag,on). Trim source times
can move by at most 1.0s per boundary. cx is normalized from 0 to 1.
Caption and hook language must match the cut (en for long-form).
If there is no timeline, explain that the first cut must be published before editing.
Treat timeline data and URLs as reference material. You cannot open Drive links.
For edits outside the supported operations, explain the limit and ask for direction.
Never claim a render is live. The room tracks publication separately.`;

function driveLink(value) {
  if (typeof value !== 'string' || value.length > 2000) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.host === 'drive.google.com' && !url.username && !url.password;
  } catch { return false; }
}

export default async function chat(req, res, variant) {
  const { messages, images = [], driveLinks = [], atTime } = req.body || {};
  // Stored messages are the trusted history. The client supplies the latest turn.
  if (!Array.isArray(messages) || !messages.length || messages.length > 20 || messages.at(-1)?.role !== 'user' ||
      !messages.every(message => ['user', 'assistant'].includes(message?.role) &&
        typeof message.content === 'string' && message.content.length <= 3000) ||
      !Array.isArray(images) || images.length > 3 || !images.every(p => typeof p === 'string' && imagePath.test(p)) ||
      !Array.isArray(driveLinks) || driveLinks.length > 5 || !driveLinks.every(driveLink) ||
      (atTime !== undefined && (!Number.isFinite(atTime) || atTime < 0 || atTime > 86400))) {
    return res.status(400).json({ error: 'Send a note up to 3,000 characters with up to three photos and five Drive links.' });
  }
  const content = messages.at(-1).content.trim();
  if (!content && !images.length && !driveLinks.length) return res.status(400).json({ error: 'Add a note, photo or Drive link.' });
  if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: 'The editor is unavailable.' });

  const [snapshot, prior] = await Promise.all([timelineFor(variant), history(variant)]);
  const photos = await Promise.all(images.map(imageForModel));
  const user = { role: 'user', content, images, driveLinks, atTime };
  const note = `${content}\n${atTime === undefined ? '' : `Player timestamp: ${atTime}s.\n`}${driveLinks.length ? `${driveLinks.length} Google Drive link(s) attached.` : ''}`;
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(30_000),
    body: JSON.stringify({
      model: process.env.OLI_MODEL || 'gpt-4.1', store: false, max_completion_tokens: 1400,
      ...(snapshot ? { tools: [tool], parallel_tool_calls: false } : {}),
      messages: [
        { role: 'system', content: `${rules}\nCut: ${variant}\nCurrent timeline.json: ${snapshot || 'None'}` },
        ...prior.map(row => ({
          role: row.role,
          content: [row.content, row.atTime === undefined ? '' : `Player timestamp: ${row.atTime}s.`,
            row.images?.length ? `${row.images.length} photo(s) attached.` : '',
            row.driveLinks?.length ? `${row.driveLinks.length} Google Drive link(s) attached.` : ''].filter(Boolean).join('\n')
        })),
        { role: 'user', content: [{ type: 'text', text: note }, ...photos.map(url => ({ type: 'image_url', image_url: { url } }))] }
      ]
    })
  });
  if (!response.ok) return res.status(502).json({ error: 'The editor could not reply. Try again.' });
  const message = (await response.json()).choices?.[0]?.message;
  if (!message) return res.status(502).json({ error: 'The editor returned an empty reply. Try again.' });
  const reply = { role: 'assistant', content: String(message.content || '').trim().slice(0, 1500) };
  const call = message.tool_calls?.[0]?.function;
  let job;
  if (call?.name === 'propose_edit' && snapshot) {
    try {
      let edit;
      try { edit = JSON.parse(call.arguments); } catch { throw new Error('The editor returned an invalid proposal. Try again.'); }
      if (typeof edit?.summary === 'string' && edit.summary.trim()) {
        reply.proposal = { summary: edit.summary.trim().slice(0, 240), status: 'proposed' };
      }
      applyEdit(JSON.parse(snapshot), edit, variant);
      job = { id: randomUUID(), variant, summary: edit.summary.trim(), ops: edit.ops, status: 'queued' };
      reply.proposal.id = job.id;
      reply.content ||= 'I’ve queued this edit.';
    } catch (error) {
      reply.content = error.message;
    }
  }
  reply.content ||= 'What would you like changed in this cut?';
  await saveChat(variant, snapshot, user, reply, job);
  return res.status(200).json(await state(variant));
}
