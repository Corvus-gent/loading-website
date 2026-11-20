import {applyPageCopy} from './page-copy.js';
import {applyI18n, getLang, LANGS, renderSwitcher} from './language.js';
import {saveLanguagePreference} from '../storage.js';

// Move the historical control rather than adding a second one on older pages.
const bar = document.getElementById('lang-switcher') || document.createElement('nav');
bar.id = 'lang-switcher';
bar.classList.add('lang-switcher');
bar.dataset.siteLanguages = '';
const names = {
  en: 'Language', nl: 'Taal', es: 'Idioma', fr: 'Langue', pt: 'Idioma',
  de: 'Sprache', zh: '语言', hi: 'भाषा', ta: 'மொழி'
};
function labelBar() {
  bar.setAttribute('aria-label', names[getLang()] ?? names.en);
}
labelBar();
window.addEventListener('corvus-language-change', labelBar);
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
