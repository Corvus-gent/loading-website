/**
 * Tiny search: a 🔍 top right that expands into a field with page suggestions.
 */

const INDEX = [
  { title:"the realm",url:"/realm/",keys:"home portal navigation" },
  { title:"daily games",url:"/games/",keys:"games puzzle daily babel borders wordle flags combo bangle pingle lantern" },
  { title: "stats · live numbers", url: "https://stats.corvus.gent/", keys: "stats analytics visitors numbers dashboard" },
  { title: "wiki · corvuspedia", url: "/wiki/", keys: "wiki wikipedia encyclopedia corvuspedia" },
  { title: "wiki · what is a corvus?", url: "/wiki/corvus/", keys: "corvus crow bird studio" },
  { title: "wiki · what is a pidgy?", url: "/wiki/pidgy/", keys: "pidgy pigeon inbox email bird" },
  { title: "army · join the people", url: "/people/", keys: "army join people team crew recruit" },
  { title: "gabe · about me", url: "/gabe", keys: "gabe gabriel about me bio profile portfolio who" },
  { title: "call · book 15 min", url: "/call/", keys: "call book meeting talk coffee calendar" },
  { title: "now · this week", url: "/now/", keys: "now week focus current hackathon" },
  { title: "sidequests · projects & travel", url: "/sidequests/", keys: "sidequests projects robot partycrasher travel china portugal sf" },
  { title: "polyglot stats · languages", url: "/languages/", keys: "languages polyglot vote chinese french spanish lingo" },
  { title: "links · all my links", url: "/links/gabe", keys: "links linktree socials instagram tiktok linkedin x luma pidgy trial qr" },
  { title: "support", url: "/support/", keys: "support shoutouts vouch" },
  { title: "support · people", url: "/support/people/", keys: "toto mathias simon siebe ashkan friends" },
  { title: "support · founders", url: "/support/founders/", keys: "founders james posthog" },
  { title: "support · companies", url: "/support/companies/", keys: "companies pidgy alkmist compound posthog anthropic exoligamentz routergrowth router growth" },
  { title: "support · books", url: "/support/books/", keys: "books reading goodreads contagious" },
  { title: "support · philosophists", url: "/support/philosophists/", keys: "philosophy philosophists diogenes alexander lantern sun" },
  { title: "support · sport people", url: "/support/sport-people/", keys: "bjj jiu jitsu sport tainan jose santo" },
  { title: "cv · resume", url: "/cv", keys: "cv resume experience education" },
  { title: "research · papers", url: "/gabe", keys: "research papers llm manipulation medical imaging" },
];

let FULL = [];
let loaded=false;
function loadIndex(){if(loaded)return;loaded=true;fetch("/search-index.json").then(r => r.json()).then(d => { FULL = d; }).catch(() => {}); }

function snippet(text, words) {
  const i = text.indexOf(words[0]);
  if (i < 0) return "";
  const start = Math.max(0, i - 25);
  return (start ? "…" : "") + text.slice(start, i + 45) + "…";
}

function match(q) {
  q = q.trim().toLowerCase();
  if (!q) return [INDEX[3], INDEX[0]];
  const words = q.split(/\s+/).filter(Boolean);
  const hit = str => words.every(w => str.includes(w));
  const out = INDEX.filter(i => hit((i.title + " " + i.keys).toLowerCase()));
  FULL.forEach(p => {
    if (out.length >= 7 || out.some(o => o.url === p.url)) return;
    if (hit(p.text) || hit(p.title)) out.push({ title: p.title, url: p.url, snip: snippet(p.text, words) });
  });
  return out.slice(0, 7);
}

export function renderSearch(container) {
  const box = document.createElement("div");
  box.className = "search";
  box.innerHTML = `<button class="search-btn" aria-label="search">⌕</button>
    <input class="search-in" type="search" placeholder="try: army or wiki" aria-label="search the site" autocomplete="off">
    <ul class="search-list"></ul>`;
  const btn = box.querySelector("button"), input = box.querySelector("input"), list = box.querySelector("ul");

  const show = () => { loadIndex();
    list.innerHTML = "";
    const results = match(input.value);
    if (!results.length) { list.innerHTML = '<li class="sub" style="padding:6px 8px">nothing. the crow looked everywhere.</li>'; return; }
    results.forEach(i => {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = i.url; a.textContent = i.title;
      if (i.snip) { const sm = document.createElement("small"); sm.textContent = i.snip; a.appendChild(sm); }
      li.appendChild(a); list.appendChild(li);
    });
  };
  btn.addEventListener("click", () => {
    box.classList.toggle("open");
    if (box.classList.contains("open")) { input.focus(); show(); }
  });
  input.addEventListener("input", show);
  input.addEventListener("keydown", e => {
    if (e.key === "Enter") { const first = match(input.value)[0]; if (first) location.href = first.url; }
    if (e.key === "Escape") box.classList.remove("open");
    if (e.key === "Enter" && window.posthog?.capture) window.posthog.capture("site_search", { q: input.value });
  });
  document.addEventListener("click", e => { if (!box.contains(e.target)) box.classList.remove("open"); });
  container.prepend(box);
}
