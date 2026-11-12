/**
 * Easter egg: press any key on the homepage (or tap >_) to open a terminal.
 */

const PAGES = {
  home: "/", about: "/gabe", now: "/now/", sidequests: "/sidequests/",
  support: "/support/", languages: "/languages/", "402": "/402/", cv: "/cv",
};

const COMMANDS = {
  help: () => [
    "available commands:",
    "  whoami · now · sidequests · support · location · cv · contact · live",
    "  ls · cd <page> · lang <en|nl|fr|es|pt|de|zh> · clear · exit",
    "  (there might be more. sudo is watching.)",
  ],
  whoami: () => [
    "gabe. gtm @ pidgy. upcoming business philosopher.",
    "dropped out with one year left. got bored. wanted to build.",
  ],
  now: () => ["opening /now ..."].concat(go("/now/")),
  sidequests: () => ["opening /sidequests ..."].concat(go("/sidequests/")),
  support: () => ["opening /support ..."].concat(go("/support/")),
  cv: () => ["opening cv ..."].concat(go("/cv")),
  contact: () => ["gabriel@corvus.gent"].concat(go("mailto:gabriel@corvus.gent")),
  live: () => ["twitch → https://corvus.gent/go/twitch", "instagram → https://corvus.gent/go/instagram", "x → https://corvus.gent/go/twitter"],
  ls: () => [Object.keys(PAGES).join("  ")],
  location: async () => {
    try {
      const r = await fetch("/location.json", { cache: "no-store" }).then(r => r.json());
      return [`currently in: ${r.city}`];
    } catch { return ["currently in: unknown"]; }
  },
  diogenes: () => ["stand a little out of my sun."],
  lantern: () => ["still looking for an honest man."],
  pay: () => ["402 payment required."],
  pidgy: () => ["coo. 🐦", "→ pidgy-ai.com"],
  coo: () => ["coo coo."],
  headache: () => ["fast-acting inbox relief: paracetamail® 500 mg", "side effects may include free time."].concat(go("/img/paracetamail.png")),
  sudo: args => args.join(" ") === "hire gabe"
    ? ["permission granted.", "→ gabriel@corvus.gent"]
    : ["nice try."],
  exit: () => { close(); return []; },
};

let overlay, out, input, hintTimer, noteTimer;

function go(url) {
  setTimeout(() => { location.href = url; }, 500);
  return [];
}

function print(lines, cls = "") {
  lines.forEach(line => {
    const div = document.createElement("div");
    div.textContent = line;
    if (cls) div.className = cls;
    out.appendChild(div);
  });
  out.scrollTop = out.scrollHeight;
}

async function run(raw) {
  const [cmd, ...args] = raw.trim().split(/\s+/);
  print([`$ ${raw}`], "term-cmd");
  if (!cmd) return;
  if (cmd === "clear") { out.innerHTML = ""; return; }
  if (cmd === "cd") {
    const target = Object.hasOwn(PAGES,args[0]) && PAGES[args[0]];
    print(target ? [`→ ${args[0]}`].concat(go(target)) : [`cd: no such page: ${args[0] || ""}`]);
    return;
  }
  if (cmd === "lang") {
    const url = new URL(location.href);
    url.searchParams.set("lang", args[0] || "en");
    print([`→ ${args[0] || "en"}`].concat(go(url.toString())));
    return;
  }
  const fn = Object.hasOwn(COMMANDS,cmd) && COMMANDS[cmd];
  print(fn ? await fn(args) : [`command not found: ${cmd}. try 'help'.`]);
  if (window.posthog?.capture) window.posthog.capture("terminal_command", { command: Object.hasOwn(COMMANDS, cmd) ? cmd : "unknown" });
}

function build() {
  overlay = document.createElement("dialog");
  overlay.setAttribute("aria-label","terminal");
  overlay.className = "term";
  overlay.innerHTML = `
    <div class="term-box">
      <div class="term-warn"><span class="term-lantern" aria-hidden="true"></span>do you know what a terminal is?
        <a class="term-no" href="https://en.wikipedia.org/wiki/Command-line_interface" target="_blank" rel="noreferrer">no? → this is one</a>
        <span class="term-no term-nontech">(for you non technical people)</span></div>
      <div class="term-out"></div>
      <div class="term-line"><span>$</span><input autocomplete="off" spellcheck="false" aria-label="terminal"></div>
      <div class="term-foot">esc · click outside to close</div>
    </div>`;
  document.body.appendChild(overlay);
  out = overlay.querySelector(".term-out");
  input = overlay.querySelector("input");
  print(["corvus.gent terminal. type 'help'."]);
  input.addEventListener("keydown", e => {
    if (e.key === "Enter") { run(input.value); input.value = ""; }
  });
  overlay.addEventListener("close", () => { overlay.style.display = "none"; });
  overlay.addEventListener("click", e => { if (e.target === overlay) close(); });
}

export function openTerminal(firstKey) {
  if (!overlay) build();
  if (overlay.open) return;
  overlay.style.display = "flex";
  overlay.showModal();
  const [no, nontech] = overlay.querySelectorAll(".term-no");
  no.classList.remove("show"); nontech.classList.remove("show");
  clearTimeout(hintTimer); clearTimeout(noteTimer);
  hintTimer = setTimeout(() => no.classList.add("show"), 2000);
  noteTimer = setTimeout(() => nontech.classList.add("show"), 4000);
  input.focus();
  input.value = firstKey || "";
}

function close() {
  overlay?.close();
}

document.addEventListener("keydown", e => {
  if (e.defaultPrevented || e.isComposing || e.repeat || document.querySelector("dialog[open]")) return;
  if (e.defaultPrevented || e.key === "/" || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.target.closest && e.target.closest("input,textarea,select,[contenteditable]:not([contenteditable=false]),[role=textbox]")) return;
  if (e.key === " " && e.target.closest?.("a,button,summary,[role=button]")) return;
  if (e.key.length === 1) { e.preventDefault(); openTerminal(e.key); }
});

document.querySelectorAll("[data-terminal]").forEach(el =>
  el.addEventListener("click", e => { e.preventDefault(); openTerminal(); })
);
