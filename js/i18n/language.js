import {readLanguagePreference, saveLanguagePreference} from '../storage.js';

/**
 * Tiny i18n layer: 7 languages, picked from ?lang=, then saved choice, then browser.
 * Elements with data-i18n="key" get their text replaced.
 */

const curiosityLanguages = /^\/(?:curiositycraft(?:\/|$)|worldcraft(?:\/|$)|curiosity(?:\/|$)|quests(?:\/|$)|hack(?:\/?$|\/4(?:\/|$)))/.test(location.pathname);
export const LANGS = curiosityLanguages ? [["en","EN"],["es","ES"],["zh","中文"],["fr","FR"],["pt","PT"],["nl","NL"],["hi","हिन्दी"],["ta","தமிழ்"]] : [
  ["en", "EN"], ["nl", "NL"], ["es", "ES"], ["fr", "FR"],
  ["pt", "PT"], ["de", "DE"], ["zh", "中文"],
];

const callbacks = new Set();
const load = code => import(`../locales/${["hi","ta"].includes(code)?"en":code}.js`).then(module => module.default);
const english = await load('en');
let strings = await load(getLang()).catch(() => english);

export function getLang() {
  const codes = LANGS.map(l => l[0]);
  const q = new URLSearchParams(location.search).get("lang");
  if (codes.includes(q)) return q;
  const s = readLanguagePreference();
  if (codes.includes(s)) return s;
  const nav = (navigator.language || "en").slice(0, 2).toLowerCase();
  return codes.includes(nav) ? nav : "en";
}

export function t(key, lang = getLang()) {
  return strings[key] ?? english[key] ?? key;
}

// Pick the right language from a {en, nl, ...} object or return a plain string
export function pick(value, lang = getLang()) {
  if (value && typeof value === "object") return value[lang] ?? value.en;
  return value;
}

export function applyI18n(lang = getLang()) {
  document.documentElement.lang = lang;
  document.querySelectorAll('a[href^="https://stats.corvus.gent"]').forEach(a=>{const url=new URL(a.href);url.searchParams.set("lang",lang);a.href=url.href;});
  document.querySelectorAll("#corner-nav a").forEach(a=>{const key=a.textContent==="⌂"?"nav.home":"nav.back";a.title=t(key);a.setAttribute("aria-label",t(key));});
  const search=document.querySelector(".search-btn");if(search)search.setAttribute("aria-label",t("nav.search"));
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const value = strings[el.dataset.i18n] ?? english[el.dataset.i18n];
    if (value !== undefined) el.textContent = value;
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
    const value = strings[el.dataset.i18nPlaceholder] ?? english[el.dataset.i18nPlaceholder];
    if (value !== undefined) el.placeholder = value;
  });
}

export function renderSwitcher(onChange) {
  const box = document.getElementById("lang-switcher");
  if (onChange) callbacks.add(onChange);
  if (!box) return;
  const current = getLang();
  box.innerHTML = "";
  LANGS.forEach(([code, label]) => {
    const a = document.createElement("a");
    const url = new URL(location.href);
    url.searchParams.set('lang', code);
    a.href = url.href;
    a.hreflang = code;
    a.textContent = label;
    if (code === current) {
      a.className = "active";
      a.setAttribute('aria-current', 'true');
    }
    a.addEventListener("click", async e => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
      e.preventDefault();
      saveLanguagePreference(code);
      const currentURL = new URL(location.href);
      currentURL.searchParams.set('lang', code);
      history.replaceState(null, '', currentURL);
      const selected = await load(code).catch(() => english);
      if (getLang() !== code) return;
      strings = selected;
      applyI18n(code);
      renderSwitcher();
      box.querySelector('[aria-current]')?.focus({preventScroll:true});
      window.dispatchEvent(new CustomEvent('corvus-language-change',{detail:{lang:code}}));
      callbacks.forEach(callback => callback(code));
    });
    box.appendChild(a);
  });
  const stats = document.createElement("a");
  stats.href = location.hostname === 'stats.corvus.gent' ? 'https://corvus.gent/languages/' : '/languages/';
  stats.className = "stats";
  stats.textContent = "· " + t("lang.title");
  box.appendChild(stats);
}
