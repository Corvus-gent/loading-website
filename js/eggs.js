import {readPreference,savePreference} from './storage.js';
// Pidgy easter eggs: hidden feathers on every page + a peeking Pidgy here and there.
const TOTAL = 7;
const LINES = ["coo.", "a Pidgy feather.", "Pidgy was here.", "inbox zero tastes like this.", "the flock sees you.", "follow the feathers.", "almost there."];
const found = () => { const value=readPreference("feathers",[]);return Array.isArray(value)?value:[]; };
const save = arr => savePreference("feathers", arr);

function toast(html) {
  let t = document.getElementById("egg-toast");
  if (!t) { t = document.createElement("div"); t.id = "egg-toast"; t.className = "egg-toast"; document.body.appendChild(t); }
  t.innerHTML = html; t.classList.add("show");
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), 3500);
}

function collect(id) {
  const got = found();
  const fresh = !got.includes(id);
  if (fresh) { got.push(id); save(got); }
  const n = got.length;
  toast(n >= TOTAL
    ? `🪶 ${n}/${TOTAL}. you found the whole flock. <a href="/links/gabe">claim your free Pidgy trial →</a>`
    : `🪶 ${LINES[(n - 1) % LINES.length]} ${n}/${TOTAL} feathers found.`);
  if (fresh) window.posthog?.capture("feather_found",{id,total:n});
}
export function collectRealmFeather() {
  // An alternate hiding place for one of the original seven.
  let id = readPreference('realm-feather');
  if (!Object.hasOwn(SPOTS,id)) {
    id = Object.keys(SPOTS).find(key => !found().includes(key)) || '/';
    savePreference('realm-feather',id);
  }
  collect(id);
}
function feather(id, style) {
  const f = document.createElement("img");
  f.src = "/img/feather.png"; f.alt = ""; f.className = "feather"; Object.assign(f.style, style);
  f.addEventListener("click", e => {
    e.stopPropagation();
    collect(id);
    f.classList.add("caught");
  });
  document.body.appendChild(f);
}

// one feather per page. kept clear of the privacy notice and the header so it can actually be tapped
const SPOTS = {
  "/": { top: "45%", left: "6px", transform: "rotate(-20deg)" },
  "/now/": { top: "40%", right: "6px", transform: "rotate(40deg)" },
  "/sidequests/": { top: "62%", right: "14px" },
  "/support/": { top: "120px", left: "8px", transform: "rotate(-30deg)" },
  "/support/books/": { top: "30%", right: "10px", transform: "rotate(15deg)" },
  "/languages/": { top: "55%", left: "10px", transform: "rotate(160deg)" },
  "/call/": { top: "35%", left: "10px", transform: "rotate(90deg)" },
};
const page = location.pathname.replace(/\/?$/, "/");
const spot = SPOTS[page];
if (spot) feather(page, spot);

// the sticky-note Pidgy peeks on /now
if (location.pathname === "/now/") {
  const p = document.createElement("img");
  p.src = "/img/sticky-pidgy.png"; p.alt = ""; p.className = "peek";
  p.addEventListener("click", () => toast("Pidgy remembers what you forget. <a href=\"https://pidgy-ai.com\" target=\"_blank\" rel=\"noreferrer\">pidgy-ai.com</a>"));
  document.body.appendChild(p);
}
