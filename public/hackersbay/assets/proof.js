export const DEMO_PREVIEW = '/hackersbay/preview';
const PART = '[a-z0-9][a-z0-9._-]{0,99}';

export function normalizeRepo(input) {
  const text = typeof input === 'string' ? input.trim().replace(/\/$/, '') : '';
  const match = new RegExp('^(?:(?:https://)?github\\.com/)?(' + PART + '/' + PART + ')$', 'i').exec(text);
  if (!match) throw new Error('Enter a public GitHub repository, like github.com/owner/project.');
  return match[1].replace(/\.git$/i, '').toLowerCase();
}

export function boatPreviewUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname.endsWith('.on.boat.dev') && !url.username && !url.password && !url.port
      ? url.href : '';
  } catch { return ''; }
}
