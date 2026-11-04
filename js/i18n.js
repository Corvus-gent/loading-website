import "./eggs.js";
import { renderSearch } from "./search.js";
/**
 * Tiny i18n layer: 7 languages, picked from ?lang=, then saved choice, then browser.
 * Elements with data-i18n="key" get their text replaced.
 */

export const LANGS = [
  ["en", "EN"], ["nl", "NL"], ["es", "ES"], ["fr", "FR"],
  ["pt", "PT"], ["de", "DE"], ["zh", "中文"],
];

let STRINGS = (await import(`./locales/${getLang()}.js`)).default;

function savedLang() {
  try { return localStorage.getItem("lang"); } catch { return null; }
}

export function getLang() {
  const codes = LANGS.map(l => l[0]);
  const q = new URLSearchParams(location.search).get("lang");
  if (codes.includes(q)) return q;
  const s = savedLang();
  if (codes.includes(s)) return s;
  const nav = (navigator.language || "en").slice(0, 2).toLowerCase();
  return codes.includes(nav) ? nav : "en";
}

export function t(key, lang = getLang()) {
  const entry = STRINGS[key];
  if (!entry) return key;
  return entry;
}

// Pick the right language from a {en, nl, ...} object or return a plain string
export function pick(value, lang = getLang()) {
  if (value && typeof value === "object") return value[lang] ?? value.en;
  return value;
}

export function applyI18n(lang = getLang()) {
  document.documentElement.lang = lang;
  document.querySelectorAll("#corner-nav a").forEach(a=>{const key=a.textContent==="⌂"?"nav.home":"nav.back";a.title=t(key);a.setAttribute("aria-label",t(key));});
  const search=document.querySelector(".search-btn");if(search)search.setAttribute("aria-label",t("nav.search"));
  document.querySelectorAll("[data-i18n]").forEach(el => {
    el.textContent = t(el.dataset.i18n, lang);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
    el.placeholder = t(el.dataset.i18nPlaceholder, lang);
  });
}

export function renderSwitcher(onChange) {
  const box = document.getElementById("lang-switcher");
  if (!box) return;
  const current = getLang();
  box.innerHTML = "";
  LANGS.forEach(([code, label]) => {
    const a = document.createElement("a");
    a.href = "#";
    a.textContent = label;
    if (code === current) a.className = "active";
    a.addEventListener("click", async e => {
      e.preventDefault();
      try { localStorage.setItem("lang", code); } catch {}
      const url = new URL(location.href);
      url.searchParams.set("lang", code);
      history.replaceState(null, "", url);
      STRINGS = (await import(`./locales/${code}.js`)).default;
      applyI18n(code);
      renderSwitcher(onChange);
      if (onChange) onChange(code);
    });
    box.appendChild(a);
  });
  const stats = document.createElement("a");
  stats.href = "/languages/";
  stats.className = "stats";
  stats.textContent = "· " + t("lang.title");
  box.appendChild(stats);
}

function renderCornerNav() {
  if (document.getElementById("corner-nav")) return;
  const nav = document.createElement("div");
  nav.id = "corner-nav";
  nav.className = "corner-nav";
  if (location.pathname !== "/") renderSearch(nav);
  if (location.pathname === "/") { document.body.appendChild(nav); return; }
  const back = document.createElement("a");
  back.href = "#"; back.textContent = "←"; back.title = "back"; back.setAttribute("aria-label", t("nav.back"));
  back.addEventListener("click", e => {
    e.preventDefault();
    if (history.length > 1 && document.referrer.startsWith(location.origin)) history.back();
    else location.href = "/realm/";
  });
  const home = document.createElement("a");
  home.href = "https://corvus.gent/realm/"; home.textContent = "⌂"; home.title = "home"; home.setAttribute("aria-label", t("nav.home"));
  nav.append(back, home);
  document.body.appendChild(nav);
}

export function initI18n(onChange) {
  applyI18n();
  renderSwitcher(onChange);
  renderCornerNav();
}
