import {applyI18n, renderSwitcher} from './language.js';

// Version this dependency here as well as on legacy pages using CSS imports.
const sheet = document.createElement('link');
sheet.rel = 'stylesheet';
sheet.href = '/css/site/languages.css?v=20261112audit1';
if (!document.querySelector('link[href="' + sheet.getAttribute('href') + '"]')) document.head.append(sheet);

// Move the historical control rather than adding a second one on older pages.
const bar = document.getElementById('lang-switcher') || document.createElement('nav');
bar.id = 'lang-switcher';
bar.classList.add('lang-switcher');
bar.dataset.siteLanguages = '';
bar.setAttribute('aria-label', 'Language');
document.body.prepend(bar);

applyI18n();
renderSwitcher();
