import "./eggs.js?v=20261108live1";
// Legacy destinations also accept the original keyboard shortcut.
if (/^\/(?:now|sidequests|support|languages|call|people|gabe|402)(?:\/|$)/.test(location.pathname)) import('./terminal.js?v=20261108live1');
import { renderSearch } from "./search.js";
import {loadFeature,featureText} from './i18n/feature.js?v=20261108live1';
export {loadFeature,featureText};
import {applyI18n, renderSwitcher, t} from './i18n/language.js';
export {applyI18n, getLang, LANGS, pick, renderSwitcher, t} from './i18n/language.js';

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
  home.href = location.hostname==="stats.corvus.gent"?"https://corvus.gent/realm/":"/realm/"; home.textContent = "⌂"; home.title = "home"; home.setAttribute("aria-label", t("nav.home"));
  // recruiting is reachable from every page (feedback: "can't find the recruiting anywhere")
  const onArmy=/^\/(join-the-army-now|army|legion|soldier)(\/|$)/.test(location.pathname);
  if (!onArmy) {
    const army = document.createElement("a");
    army.href = location.hostname==="stats.corvus.gent"?"https://corvus.gent/join-the-army-now":"/join-the-army-now";
    army.className = "nav-army"; army.textContent = "⚑"; army.title = "join the army"; army.setAttribute("aria-label", "join the army");
    nav.append(army);
  }
  nav.append(back, home);
  document.body.appendChild(nav);
}

export function initI18n(onChange) {
  applyI18n();
  renderSwitcher(onChange);
  renderCornerNav();
}
