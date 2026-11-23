// Build-only experiment: discover the selected language before the main bundle.
// Reuse the application's exact selection code, rather than a second preference
// policy. These hints never load another locale or execute its translations.
import {readFile} from 'node:fs/promises';
import path from 'node:path';

export async function localeHintSource(root) {
  const language = await readFile(path.join(root, 'js/i18n/language.js'), 'utf8');
  const copy = await readFile(path.join(root, 'js/i18n/page-copy.js'), 'utf8');
  const end = language.indexOf('const callbacks = new Set();');
  const start = language.indexOf('export function getLang()');
  const next = language.indexOf('export function t(');
  const version = copy.match(/const catalogVersion = '([^']+)'/);
  if (end < 0 || start < end || next < start || !version) {
    throw Error('Language policy changed; review early-locale experiment');
  }
  const policy = language.slice(0, end).replace(
    "from '../storage.js'", "from '/js/storage.js'"
  ) + language.slice(start, next).replace('export function', 'function');
  return policy + `
    const selected = getLang();
    if (selected !== 'en') {
      const moduleHint = document.createElement('link');
      moduleHint.rel = 'modulepreload';
      moduleHint.href = '/js/locales/' + (['hi', 'ta'].includes(selected) ? 'en' : selected) + '.js';
      document.head.append(moduleHint);
      const catalogHint = document.createElement('link');
      catalogHint.rel = 'preload';
      catalogHint.as = 'fetch';
      catalogHint.crossOrigin = 'anonymous';
      catalogHint.href = '/public/i18n/site.' + selected + '.json?v=' + ${JSON.stringify(version[1])};
      document.head.append(catalogHint);
    }
  `;
}
