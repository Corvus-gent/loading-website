/**
 * Link-in-bio: /links/<person>/<platform>/<campaign>
 *   /links/gabe              -> direct
 *   /links/gabe/li           -> from LinkedIn
 *   /links/gabe/li/402-post  -> from the LinkedIn "402" post
 * Every link carries the source along as UTM, every click is logged.
 */

const PLATFORMS = { li: "linkedin", ig: "instagram", tt: "tiktok", x: "x", luma: "luma", dc: "discord" };
const PIDGY_IMG = "https://cdn.prod.website-files.com/6a509b285b7ecf3280ec45a7/6abd0b36b07d3e8a652e8bb3_happy.png";

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

const [, , rawPerson = "gabe", p = "", campaign = ""] = location.pathname.replace(/\/+$/, "").split("/");
const personId = PEOPLE[rawPerson] ? rawPerson : "gabe";
const person = PEOPLE[personId];
const source = PLATFORMS[p] || p || "direct";

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
