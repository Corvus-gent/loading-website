import {siteStrings} from './site-copy.js?v=20261113integration4';
import {bindPageCopy} from './page-copy.js?v=20261113integration4';
import {readLanguagePreference, saveLanguagePreference} from '../storage.js';

/**
 * Tiny i18n layer: 7 languages, picked from ?lang=, then saved choice, then browser.
 * Elements with data-i18n="key" get their text replaced.
 */

export const LANGS = [
  ["en", "EN"], ["nl", "NL"], ["es", "ES"], ["fr", "FR"],
  ["pt", "PT"], ["de", "DE"], ["zh", "中文"],
];

const callbacks = new Set();
const load = code => import(`../locales/${code}.js`).then(module => ({...module.default, ...siteStrings(code)}));
const requested = new URLSearchParams(location.search).get('lang');
if (LANGS.some(([code]) => code === requested)) saveLanguagePreference(requested);
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

// Bind only plain-text leaves; preserve links, icons, forms and their listeners.
function bindSiteCopy() {
  const mark = (selector, key, root = document) => root.querySelectorAll(selector).forEach(el => {
    if (!el.dataset.i18n && el.textContent.trim() === english[key]?.trim()) el.dataset.i18n = key;
  });
  const prefix = (selector, key) => {
    const el = document.querySelector(selector), text = el?.firstChild;
    if (text?.nodeType !== 3 || text.textContent.trim() !== english[key]?.trim()) return;
    const span = document.createElement('span'); span.dataset.i18n = key; text.replaceWith(span);
  };
  for (const id of ['quests','daily','legion','live']) {
    mark('.site-nav a[href="/' + id + '/"]', 'chrome.' + id);
    const card = document.querySelector('.portal-sections > a[href="/' + id + '/"]');
    if (card) { mark('strong', 'chrome.' + id, card); mark('p', 'portal.' + id, card); mark('small', id === 'legion' ? 'portal.join' : 'portal.explore', card); }
  }
  const gabe = document.querySelector('.portal-sections > a[href="/gabe/"]');
  if (gabe) { mark('p','portal.gabe',gabe); mark('small','portal.explore',gabe); }
  mark('.site-nav [data-site-search]', 'chrome.search');
  mark('.site-section [data-site-search]', 'chrome.find');
  for (const [href, key] of [['/map/','map'],['#lang-switcher','language'],['/privacy/','privacy']]) {
    mark('.site-quiet-footer a[href="' + href + '"], .portal-foot a[href="' + href + '"]', 'chrome.' + key);
  }
  if (document.querySelector('.portal-sections')) {
    mark('main > h1','portal.title'); mark('main > .site-lead','portal.lead');
    mark('.site-newsletter h2','portal.signupTitle'); mark('[data-newsletter] button[type=submit]','portal.signal');
    prefix('.site-newsletter .check > span','portal.consent'); mark('.site-newsletter a[href="/privacy/"]','portal.privacy');
  }
  mark('[data-read-note]','actions.readNote');
  mark('.realm-what','realm.what'); mark('.realm-recruit-eyebrow','realm.recruiting');
  mark('.realm-recruit strong','realm.join'); mark('.realm-recruit small','realm.review');
  mark('.realm-recruit strong','realm.enlistTiro'); mark('.realm-recruit small','realm.ranksEarned');
  prefix('.realm-more','realm.more');
  for (const [href, key] of [['/sidequests/','nav.sidequests'],['/now/','nav.now'],['/support/','nav.support'],['/hackathons/','realm.hackathons']]) mark('.realm-more a[href="' + href + '"]',key);
  if (/^\/support\/?$/.test(location.pathname)) {
    for (const [slug, key, note] of [['people','support.people','people'],['founders','support.founders','founders'],['companies','support.companies','companies'],['books','support.books','books'],['philosophists','support.philosophists','philosophists'],['sport-people',null,'sport']]) {
      const link = document.querySelector('.sx a[href="/support/' + slug + '/"]');
      if (link) { if (key) mark('.t',key,link); mark('.d','support.' + note + 'Note',link); }
    }
    const hack = document.querySelector('.sx a[href="/hackathons/"]');
    if (hack) { mark('.t','support.hackSquads',hack); mark('.d','support.hackNote',hack); }
  }
}

export function applyI18n(lang = getLang()) {
  bindSiteCopy();
  bindPageCopy(english, () => applyI18n(), () => strings);
  document.documentElement.lang = lang;
  document.querySelectorAll('a[href^="https://stats.corvus.gent"]').forEach(a=>{const url=new URL(a.href);url.searchParams.set("lang",lang);a.href=url.href;});
  document.querySelectorAll("#corner-nav a").forEach(a=>{const key=a.textContent==="⌂"?"nav.home":"nav.back";a.title=t(key);a.setAttribute("aria-label",t(key));});
  const search=document.querySelector(".search-btn");if(search)search.setAttribute("aria-label",t("nav.search"));
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const value = strings[el.dataset.i18n] ?? english[el.dataset.i18n];
    if (value !== undefined) {
      const copy = value.replace(/\{(\w+)\}/g, (token,name) => el.getAttribute('data-i18n-'+name) ?? token);
      if (el.textContent !== copy) el.textContent = copy;
    }
  });
  document.querySelectorAll("[data-i18n-aria-label]").forEach(el => {
    const value = strings[el.dataset.i18nAriaLabel] ?? english[el.dataset.i18nAriaLabel];
    if (value !== undefined && el.getAttribute('aria-label') !== value) el.setAttribute('aria-label', value);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
    const value = strings[el.dataset.i18nPlaceholder] ?? english[el.dataset.i18nPlaceholder];
    if (value !== undefined && el.placeholder !== value) el.placeholder = value;
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
