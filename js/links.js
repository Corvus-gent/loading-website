import {sourceCategory, campaignCategory} from './analytics-policy.js';
/**
 * Link-in-bio: /links/<person>/<platform>/<campaign>
 *   /links/gabe              -> direct
 *   /links/gabe/li           -> from LinkedIn
 *   /links/gabe/li/402-post  -> from the LinkedIn "402" post
 * Every link carries the source along as UTM, every click is logged.
 */

const PLATFORMS = { li: "linkedin", ig: "instagram", tt: "tiktok", x: "x", luma: "luma", dc: "discord", bmc: "buymeacoffee" };
const PIDGY_IMG = "/img/pidgy-happy.png";

const PEOPLE = {
  gabe: {
    name: "Gabe",
    full: "Francisco Gabriel Van Langenhove",
    photo: "/img/gabe.jpg",
    line: "GTM @ Pidgy · upcoming business philosopher",
    main: { id: "pidgy", text: "Try Pidgy, your AI inbox agent", href: "https://pidgy-ai.com/", img: PIDGY_IMG },
    trial: { id: "pidgy-trial", text: "start your free trial week →", href: "https://app.pidgy-ai.com/?invite=GABE" },
    links: [
      { id: "call", text: "📞 book a free 15-min call", href: "/call/" },
      { id: "portfolio", text: "portfolio", href: "/people/?id=gabe" },
      { id: "now", text: "now", href: "/now/" },
      { id: "sidequests", text: "sidequests", href: "/sidequests/" },
    ],
    socials: [
      { id: "linkedin", text: "LinkedIn", href: "https://www.linkedin.com/in/francisco-gabriel-van-langenhove/" },
      { id: "ig-startup", text: "Instagram · startup", href: "https://instagram.com/gabe.maxxing/" },
      { id: "ig-bjj", text: "Instagram · bjj", href: "https://instagram.com/gabinho_bjj/" },
      { id: "tiktok", text: "TikTok", href: "https://www.tiktok.com/@gabe.maxxing" },
      { id: "x", text: "X", href: "https://x.com/gabe_maxxing" },
      { id: "luma", text: "Luma", href: "https://luma.com/user/usr-SAWed3lOjW3IN3u" },
    ],
    extra: [
      { id: "alkmist", text: "Alkmist", href: "https://alkmist.com/" },
      { id: "coffee", text: "buy me a coffee", href: "https://buymeacoffee.com/gabe.maxxing" },
      { id: "home", text: "corvus.gent", href: "/" },
    ],
  },
};

let [, , rawPerson = "gabe", p = "", campaign = ""] = location.pathname.replace(/\/+$/, "").split("/");
// short form /links/<platform>[/<campaign>] defaults to gabe
if (!PEOPLE[rawPerson] && rawPerson) { campaign = p; p = rawPerson; rawPerson = "gabe"; }
const personId = PEOPLE[rawPerson] ? rawPerson : "gabe";
const person = PEOPLE[personId];
const source = sourceCategory(PLATFORMS[p] || p || "direct");
campaign = campaignCategory(campaign || "bio");

// every pageview on this page carries person, source and campaign
window.__phProps = { links_person: personId, links_source: source, links_campaign: campaign || "bio" };
if (window.posthog?.register) window.posthog.register(window.__phProps);

function tagged(link) {
  const url = new URL(link.href, location.origin);
  if (url.protocol === "mailto:") return url.toString();
  url.searchParams.set("utm_source", source);
  url.searchParams.set("utm_medium", "links");
  url.searchParams.set("utm_campaign", `${personId}-${campaign || "bio"}`);
  url.searchParams.set("utm_content", link.id);
  return url.toString();
}

function a(link, cls = "") {
  const el = document.createElement("a");
  el.href = tagged(link);
  el.className = cls;
  if (!link.href.startsWith("/")) { el.target = "_blank"; el.rel = "noreferrer"; }
  el.addEventListener("click", () => {
    if (window.posthog?.capture) window.posthog.capture("links_click", { link: link.id, ...window.__phProps });
  });
  return el;
}

document.getElementById("photo").src = person.photo;
document.getElementById("name").textContent = person.name;
document.getElementById("full").textContent = person.full;
document.getElementById("line").textContent = person.line;
document.title = `${person.name} | corvus.gent`;

const main = a(person.main, "lt-main");
main.innerHTML = `<img src="${person.main.img}" alt=""><span></span>`;
main.querySelector("span").textContent = person.main.text;
document.getElementById("main").appendChild(main);
if (person.trial) {
  const trial = a(person.trial, "lt-trial");
  trial.textContent = person.trial.text;
  document.getElementById("main").appendChild(trial);
  const qr = document.createElement("details");
  qr.className = "lt-qr";
  qr.innerHTML = `<summary>▦ show QR for the free trial</summary>
    <div class="lt-qr-card"><img src="${PIDGY_IMG}" alt="" class="lt-qr-bird"><img src="/img/pidgy-trial-qr.svg" alt="QR code: free Pidgy trial week" class="lt-qr-code"><span>scan → free trial week</span></div>`;
  qr.addEventListener("toggle", () => {
    if (qr.open && window.posthog?.capture) window.posthog.capture("links_qr_open", window.__phProps);
  });
  document.getElementById("main").appendChild(qr);
}

const fill = (id, list, cls) => list.forEach(l => { const el = a(l, cls); el.textContent = l.text; document.getElementById(id).appendChild(el); });
fill("links", person.links, "lt-btn");
fill("socials", person.socials, "lt-small");
fill("extra", person.extra, "lt-small");

// --- Diogenes' lantern note + the crow that flies in ---
const home = new URL("/", location.origin);
home.searchParams.set("utm_source", source);
home.searchParams.set("utm_medium", "links");
home.searchParams.set("utm_campaign", `${personId}-${campaign || "bio"}`);

const note = document.createElement("a");
note.className = "lt-lantern";
note.href = home.toString();
note.innerHTML = '<span class="term-lantern" aria-hidden="true"></span><span>I walk around with a lantern, looking for an honest man. maybe he\'s on the homepage. go look →</span>';
document.querySelector(".lt").insertBefore(note, document.getElementById("main"));

// crow loop: comes in, stays 3s, flies out bottom right. waits 10s, 11s, 13s, 16s, 20s, ...
const crow = document.createElement("a");
crow.className = "lt-crow";
crow.href = home.toString();
crow.innerHTML = `<svg viewBox="0 0 140 40" aria-hidden="true"><g fill="#141414" stroke="#d8d8d8" stroke-width="1.6" stroke-linejoin="round"><path d="M0 20 C18 -8 46 -14 64 10 C74 -4 104 -10 124 14 C104 10 86 16 66 26 C46 16 22 11 0 20Z"/><ellipse cx="66" cy="24" rx="16" ry="7"/><circle cx="82" cy="20" r="6"/><path d="M87 18 L98 21 L87 23Z"/></g></svg><span class="lt-bubble">URGENT. go to the homepage. NOW!!!!</span>`;
crow.addEventListener("click", () => { if (window.posthog?.capture) window.posthog.capture("links_crow_click", window.__phProps); });
document.body.appendChild(crow);

const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  for (let n = 0; ; n++) {
    await wait((10 + (n * (n + 1)) / 2) * 1000);
    crow.className = "lt-crow in";
    await wait(1600 + 3000);
    crow.className = "lt-crow out";
    await wait(1500);
    crow.className = "lt-crow";
  }
})();
