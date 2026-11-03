const $ = id => document.getElementById(id);
const bar = (n, max, w = 18) => n ? "█".repeat(Math.max(1, Math.round((n / Math.max(1, max)) * w))) : "";
const names = new Intl.DisplayNames(["en"], { type: "language" });
const fmt = d => new Date(d + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }).toLowerCase();
const shift = (d, n) => { const x = new Date(d + "T12:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const tzToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Brussels" }).format(new Date());

const FIRST = "2026-11-02";
const TODAY = tzToday();
let day = new URLSearchParams(location.search).get("day") || TODAY;
if (day < FIRST) day = FIRST;
if (day > shift(TODAY, 1)) day = shift(TODAY, 1);

function rows(el, list, key) {
  const max = Math.max(1, ...list.map(x => x.n));
  $(el).innerHTML = list.length ? "" : '<p class="sub">nothing yet.</p>';
  list.forEach(x => {
    const r = document.createElement("div"); r.className = "lrow";
    r.innerHTML = `<span class="lname"></span><span class="lbar"><span style="width:${(x.n / max) * 100}%"></span></span><span class="lval">${x.n}</span>`;
    r.querySelector(".lname").textContent = x[key] || "?";
    $(el).appendChild(r);
  });
}

async function render() {
  history.replaceState(null, "", day === TODAY ? location.pathname : `?day=${day}`);
  $("day").textContent = day === TODAY ? `today · ${fmt(day)}` : fmt(day);
  $("prev").disabled = day <= FIRST;
  $("next").disabled = day > TODAY;
  const future = day > TODAY;
  $("past").style.display = future ? "none" : "block";
  $("future").style.display = future ? "block" : "none";
  if (future) { $("fday").textContent = fmt(day); return; }

  $("visitors").textContent = "…";
  try {
    const r = await fetch(`/api/stats?day=${day}`);
    if (!r.ok) throw 0;
    const s = await r.json();
    $("visitors").textContent = s.visitors;
    $("visitors-line").textContent = day === TODAY
      ? (s.visitors === 1 ? "visitor today. just the one, so far." : `visitors today. so far, just ${s.visitors}.`)
      : `visitors on ${fmt(day)}.`;
    $("total-line").textContent = day === FIRST ? "day one. the crow came back." : `${s.total} visits since the crow came back (2 nov 2026).`;
    const max = Math.max(1, ...s.hours.map(h => h.n));
    const byHour = Object.fromEntries(s.hours.map(h => [h.h, h.n]));
    $("hours").textContent = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, "0")}h ${bar(byHour[h] || 0, max)} ${byHour[h] || ""}`).join("\n");
    rows("countries", s.countries, "c");
    rows("sources", s.sources, "s");
    rows("pages", s.pages, "p");
    rows("browsers", s.browsers || [], "b");
    const cliDay = Object.entries((s.cli && s.cli.day) || {}), cliAll = Object.values((s.cli && s.cli.all) || {}).reduce((a, b) => a + b, 0);
    $("cli").textContent = cliDay.length
      ? `yes. ${cliDay.map(([t, n]) => `${n}× ${t}`).join(", ")} this day. someone's poking around 🕵️ · all time: ${cliAll}.`
      : `nobody curled corvus.gent this day.${cliAll ? ` all time: ${cliAll}.` : ""} (try: curl corvus.gent)`;
    $("feathers").textContent = `🪶 ${s.feathers} feathers found by ${s.hunters} hunters.`;
    $("terminal").textContent = s.terminal.length ? `most typed in the terminal: ${s.terminal.map(t => t.c).join(", ")}` : "nobody opened the terminal.";
    if (s.cv) $("cv").textContent = `📄 opened ${s.cv.open}× and downloaded ${s.cv.download}× this day · all time: ${s.cv.openTotal} opens, ${s.cv.downloadTotal} downloads.`;
    $("votes-sec").style.display = s.votes ? "block" : "none";
    $("unpaid-sec").style.display = s.unpaid_days ? "block" : "none";
    if (s.votes) rows("votes", Object.entries(s.votes).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([c, n]) => ({ c: names.of(c), n })), "c");
    if (s.unpaid_days) $("unpaid").textContent = `domain still unpaid: day ${s.unpaid_days}.`;
    $("updated").textContent = `brussels time · updated every hour · last: ${new Date(s.updated).toLocaleString("en-GB", { timeZone: "Europe/Brussels" })}`;
  } catch {
    $("visitors").textContent = "…"; $("visitors-line").textContent = "the crow is still counting. come back soon.";
  }
}

$("prev").addEventListener("click", () => { day = shift(day, -1); render(); });
$("next").addEventListener("click", () => { day = shift(day, 1); render(); });
document.addEventListener("keydown", e => {
  if (e.target.closest("input")) return;
  if (e.key === "ArrowLeft" && !$("prev").disabled) $("prev").click();
  if (e.key === "ArrowRight" && !$("next").disabled) $("next").click();
});
$("guess").addEventListener("submit", async e => {
  e.preventDefault();
  const f = e.target;
  const r = await fetch("/api/guess", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ guess: f.guess.value, email: f.email.value }) });
  const d = await r.json().catch(() => ({}));
  $("guess-msg").textContent = r.ok ? "locked in. if you're exactly right, you'll hear from the crow." : (d.error || "try again later.");
  if (r.ok) { f.style.display = "none"; if (window.posthog?.capture) window.posthog.capture("visitor_guess", { day }); }
});
render();
