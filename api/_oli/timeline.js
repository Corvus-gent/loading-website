export const variants = ['en', 'zh', 'long'];

const fields = {
  trim: ['seg', 'a', 'b'],
  reorder: ['from', 'to'],
  remove: ['seg'],
  recrop: ['seg', 'cx'],
  caption: ['seg', 'lang', 'lines'],
  hook: ['lang', 'lines'],
  toggle: ['seg', 'flag', 'on']
};

export function validateTimeline(timeline) {
  const segments = timeline?.segments;
  if (!Array.isArray(segments) || !segments.length || segments.length > 500 ||
      !segments.every(s => Number.isFinite(s?.a) && Number.isFinite(s.b) && s.a >= 0 && s.a < s.b) ||
      JSON.stringify(timeline).length > 160_000) {
    throw new Error('The timeline needs a segments array with valid a/b source times.');
  }
}

export function applyEdit(timeline, edit, variant) {
  validateTimeline(timeline);
  if (typeof edit?.summary !== 'string' || !edit.summary.trim() || edit.summary.length > 240 ||
      !Array.isArray(edit.ops) || !edit.ops.length || edit.ops.length > 12) {
    throw new Error('An edit needs a short summary and 1–12 operations.');
  }
  const next = structuredClone(timeline);
  const segments = next.segments;
  const original = new Map(segments.map(s => [s, { a: s.a, b: s.b }]));
  const get = i => {
    if (!Number.isInteger(i) || i < 0 || i >= segments.length) throw new Error('That clip position does not exist.');
    return segments[i];
  };
  for (const op of edit.ops) {
    if (!op || !Object.hasOwn(fields, op.type)) throw new Error('That operation is unsupported.');
    const expected = fields[op.type];
    if (Object.keys(op).length !== expected.length + 1 || !expected.every(k => Object.hasOwn(op, k))) {
      throw new Error('The operation has invalid fields.');
    }
    const segment = expected.includes('seg') ? get(op.seg) : null;
    switch (op.type) {
      case 'trim': {
        const { a, b } = op;
        const base = original.get(segment);
        if (!Number.isFinite(a) || !Number.isFinite(b) || a < 0 || b <= a) {
          throw new Error('Trim times must be ordered, non-negative source seconds.');
        }
        if (Math.abs(a - base.a) > 1.000000001 || Math.abs(b - base.b) > 1.000000001) {
          throw new Error('Each trim boundary can move by at most 1.0 s because the source has 1 s handles.');
        }
        Object.assign(segment, { a, b });
        break;
      }
      case 'reorder': {
        const clip = get(op.from);
        get(op.to);
        segments.splice(op.from, 1);
        segments.splice(op.to, 0, clip);
        break;
      }
      case 'remove':
        if (segments.length === 1) throw new Error('Keep at least one clip in the cut.');
        segments.splice(op.seg, 1);
        break;
      case 'recrop':
        if (!Number.isFinite(op.cx) || op.cx < 0 || op.cx > 1) throw new Error('Crop center must be between 0 and 1.');
        segment.cx = op.cx;
        break;
      case 'caption':
      case 'hook': {
        if (op.lang !== (variant === 'long' ? 'en' : variant) || !Array.isArray(op.lines) ||
            op.lines.length > 4 || !op.lines.every(line => typeof line === 'string' && line.length <= 100)) {
          throw new Error('Use the current cut’s language and up to four short lines.');
        }
        const target = segment || next;
        const key = segment ? 'captions' : 'hook';
        target[key] = { ...target[key], [op.lang]: op.lines };
        break;
      }
      case 'toggle':
        if (!['cam', 'dark'].includes(op.flag) || typeof op.on !== 'boolean') throw new Error('Invalid clip toggle.');
        segment[op.flag] = op.on;
        break;
    }
  }
  if (variant !== 'long' && segments.reduce((seconds, s) => seconds + s.b - s.a, 0) > 40.05) {
    throw new Error('Keep the trailer to about 40 seconds or less.');
  }
  return next;
}
