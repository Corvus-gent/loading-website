/**
 * Tiny search: a 🔍 top right that expands into a field with page suggestions.
 */

const INDEX = [
  { title: "wiki · corvuspedia", url: "/wiki/", keys: "wiki wikipedia encyclopedia corvuspedia" },
  { title: "wiki · what is a corvus?", url: "/wiki/corvus/", keys: "corvus crow bird studio" },
  { title: "wiki · what is a pidgy?", url: "/wiki/pidgy/", keys: "pidgy pigeon inbox email bird" },
  { title: "army · join the people", url: "/people/", keys: "army join people team crew recruit" },
  { title: "gabe · about me", url: "/gabe", keys: "gabe gabriel about me bio profile portfolio who" },
  { title: "call · book 15 min", url: "/call/", keys: "call book meeting talk coffee calendar" },
  { title: "now · this week", url: "/now/", keys: "now week focus current hackathon" },
  { title: "sidequests · projects & travel", url: "/sidequests/", keys: "sidequests projects robot partycrasher travel china portugal sf" },
  { title: "402 · payment required", url: "/402/", keys: "402 payment client domain pay" },
  { title: "polyglot stats · languages", url: "/languages/", keys: "languages polyglot vote chinese french spanish lingo" },
  { title: "links · all my links", url: "/links/gabe", keys: "links linktree socials instagram tiktok linkedin x luma pidgy trial qr" },
  { title: "support", url: "/support/", keys: "support shoutouts vouch" },
  { title: "support · people", url: "/support/people/", keys: "toto mathias simon siebe ashkan friends" },
  { title: "support · founders", url: "/support/founders/", keys: "founders james posthog" },
  { title: "support · companies", url: "/support/companies/", keys: "companies pidgy alkmist compound posthog anthropic exoligamentz" },
  { title: "support · books", url: "/support/books/", keys: "books reading goodreads contagious" },
  { title: "support · philosophists", url: "/support/philosophists/", keys: "philosophy philosophists diogenes alexander lantern sun" },
  { title: "support · sport people", url: "/support/sport-people/", keys: "bjj jiu jitsu sport tainan jose santo" },
  { title: "cv · resume", url: "/cv/gabe.pdf", keys: "cv resume experience education" },
  { title: "research · papers", url: "/gabe", keys: "research papers llm manipulation medical imaging" },
];

function match(q) {
  q = q.trim().toLowerCase();
  if (!q) return [INDEX[3], INDEX[0]];
  return INDEX.filter(i => (i.title + " " + i.keys).toLowerCase().includes(q)).slice(0, 6);
}

export function renderSearch(container) {
  const box = document.createElement("div");
  box.className = "search";
  box.innerHTML = `<button class="search-btn" aria-label="search">⌕</button>
    <input class="search-in" type="search" placeholder="try: army or wiki" aria-label="search the site" autocomplete="off">
    <ul class="search-list"></ul>`;
  const btn = box.querySelector("button"), input = box.querySelector("input"), list = box.querySelector("ul");

  const show = () => {
    list.innerHTML = "";
    match(input.value).forEach(i => {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = i.url; a.textContent = i.title;
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
