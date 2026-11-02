// Pidgy easter eggs: hidden feathers on every page + a peeking Pidgy here and there.
const TOTAL = 7;
const LINES = ["coo.", "a Pidgy feather.", "Pidgy was here.", "inbox zero tastes like this.", "the flock sees you.", "follow the feathers.", "almost there."];
const found = () => { try { return JSON.parse(localStorage.getItem("feathers") || "[]"); } catch { return []; } };
const save = arr => { try { localStorage.setItem("feathers", JSON.stringify(arr)); } catch {} };

function toast(html) {
  let t = document.getElementById("egg-toast");
  if (!t) { t = document.createElement("div"); t.id = "egg-toast"; t.className = "egg-toast"; document.body.appendChild(t); }
  t.innerHTML = html; t.classList.add("show");
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), 3500);
}

function feather(id, style) {
  const f = document.createElement("img");
  f.src = "/img/feather.png"; f.alt = ""; f.className = "feather"; Object.assign(f.style, style);
  f.addEventListener("click", e => {
    e.stopPropagation();
    const got = found(); if (!got.includes(id)) { got.push(id); save(got); }
    f.classList.add("caught");
    const n = got.length;
    toast(n >= TOTAL
      ? `🪶 ${n}/${TOTAL}. you found the whole flock. <a href="/links/gabe">claim your free Pidgy trial →</a>`
      : `🪶 ${LINES[(n - 1) % LINES.length]} ${n}/${TOTAL} feathers found.`);
    if (window.posthog?.capture) window.posthog.capture("feather_found", { id, total: n });
  });
  document.body.appendChild(f);
}

// one feather per page, in a different obscure spot each time
const SPOTS = {
  "/": { bottom: "6px", left: "8px" },
  "/now/": { top: "40%", right: "4px", transform: "rotate(40deg)" },
  "/sidequests/": { bottom: "90px", right: "14px" },
  "/support/": { top: "120px", left: "6px", transform: "rotate(-30deg)" },
  "/support/books/": { bottom: "12px", right: "50%" },
  "/languages/": { top: "64px", left: "50%", transform: "rotate(160deg)" },
  "/call/": { bottom: "30px", left: "20px", transform: "rotate(90deg)" },
};
const spot = SPOTS[location.pathname];
if (spot) feather(location.pathname, spot);

// the sticky-note Pidgy peeks on /now
if (location.pathname === "/now/") {
  const p = document.createElement("img");
  p.src = "/img/sticky-pidgy.png"; p.alt = ""; p.className = "peek";
  p.addEventListener("click", () => toast("Pidgy remembers what you forget. <a href=\"https://pidgy-ai.com\" target=\"_blank\" rel=\"noreferrer\">pidgy-ai.com</a>"));
  document.body.appendChild(p);
}
