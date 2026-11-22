import {applyPageCopy} from './page-copy.js';
import {applyI18n, getLang, LANGS, renderSwitcher} from './language.js';
import {saveLanguagePreference} from '../storage.js';

// Arena rooms get the shared bar. Standalone pages may supply their own.
const existingBar = document.getElementById('lang-switcher');
if (!document.body.hasAttribute('data-realm-gate') && (existingBar || document.body.classList.contains('arena'))) {
  const bar = existingBar || document.createElement('nav');
  bar.id = 'lang-switcher';
  bar.classList.add('lang-switcher');
  bar.dataset.siteLanguages = '';
  const names = {
    en: 'Language', nl: 'Taal', es: 'Idioma', fr: 'Langue', pt: 'Idioma',
    de: 'Sprache', zh: '语言', hi: 'भाषा', ta: 'மொழி'
  };
  const labelBar = () => bar.setAttribute('aria-label', names[getLang()] ?? names.en);
  labelBar();
  window.addEventListener('corvus-language-change', labelBar);
  document.body.prepend(bar);
}

applyI18n();
renderSwitcher();

// CV routes own their complete, authored translation.
if (!document.documentElement.hasAttribute('data-language-routes')) {
  window.addEventListener('corvus-language-change', event => applyPageCopy(event.detail.lang));
  const queryLanguage = new URLSearchParams(location.search).get('lang');
  if (LANGS.some(([code]) => code === queryLanguage)) saveLanguagePreference(queryLanguage);
  applyPageCopy(getLang());
}
