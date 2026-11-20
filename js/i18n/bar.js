import {applyPageCopy} from './page-copy.js';
import {applyI18n, getLang, LANGS, renderSwitcher} from './language.js';
import {saveLanguagePreference} from '../storage.js';

// Move the historical control rather than adding a second one on older pages.
const bar = document.getElementById('lang-switcher') || document.createElement('nav');
bar.id = 'lang-switcher';
bar.classList.add('lang-switcher');
bar.dataset.siteLanguages = '';
bar.setAttribute('aria-label', 'Language');
document.body.prepend(bar);

applyI18n();
renderSwitcher();

// CV routes own their complete, authored translation.
if (!document.documentElement.hasAttribute('data-language-routes')) {
  window.addEventListener('corvus-language-change', event => applyPageCopy(event.detail.lang));
  const queryLanguage = new URLSearchParams(location.search).get('lang');
  if (LANGS.some(([code]) => code === queryLanguage)) saveLanguagePreference(queryLanguage);
  applyPageCopy(getLang());
}
