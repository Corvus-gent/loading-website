import {applyI18n, renderSwitcher} from './language.js';

// Move the historical control rather than adding a second one on older pages.
const bar = document.getElementById('lang-switcher') || document.createElement('nav');
bar.id = 'lang-switcher';
bar.classList.add('lang-switcher');
bar.dataset.siteLanguages = '';
bar.setAttribute('aria-label', 'Language');
document.body.prepend(bar);

applyI18n();
renderSwitcher();
