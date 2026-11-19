import {renderSupport} from './stats-support.js?v=20261109order1';
import {renderCountries, countryPeriod} from './stats-countries.js';
import {readPreference, savePreference} from './storage.js';
const $ = id => document.getElementById(id);
const bar = (n, max, w = 18) => n ? "█".repeat(Math.max(1, Math.round((n / Math.max(1, max)) * w))) : "";
const names = new Intl.DisplayNames(["en"], { type: "language" });
const fmt = d => new Date(d + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }).toLowerCase();
const shift = (d, n) => { const x = new Date(d + "T12:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const tzToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Brussels" }).format(new Date());

const FIRST = "2026-11-02";

// hourly chart: counts are bucketed per brussels hour; shift them into the zone the reader picks.
// SF and Shanghai first (where gabe is / is going), then the reader's own zone, then every zone.
const HOME_TZ = "Europe/Brussels";
const ownTZ = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || HOME_TZ; } catch { return HOME_TZ; } })();
const TZ_LABEL = { "America/Los_Angeles": "san francisco", "Asia/Shanghai": "shanghai", "Europe/Brussels": "brussels" };
const tzName = tz => TZ_LABEL[tz] || tz.split("/").pop().replace(/_/g, " ").toLowerCase();
const offsetMin = (tz, at) => { const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(at).map(x => [x.type, x.value])); return (Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) - at.getTime()) / 60000; };
let hoursTZ = readPreference("stats-hours-tz", ownTZ), lastHours = null, lastHoursDay = null;
function renderHours() {
  const tz = hoursTZ, local = tz === HOME_TZ;
  $("hours-title").textContent = `per hour (${tzName(tz)}${local ? "" : " time"})`;
  if (!lastHours) { $("hours").textContent = "hourly counts unavailable."; return; }
  const at = new Date((lastHoursDay || TODAY) + "T12:00:00Z");
  let diff = 0; try { diff = Math.round((offsetMin(tz, at) - offsetMin(HOME_TZ, at)) / 60); } catch { hoursTZ = HOME_TZ; return renderHours(); }
  const byHour = {};
  for (const { h, n } of lastHours) { const k = ((h + diff) % 24 + 24) % 24; byHour[k] = (byHour[k] || 0) + n; }
  const max = Math.max(1, ...Object.values(byHour));
  const note = local ? "" : `\n(${fmt(lastHoursDay || TODAY)} in brussels, shown in ${tzName(tz)} time)`;
  $("hours").textContent = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, "0")}h ${bar(byHour[h] || 0, max)} ${byHour[h] || ""}`).join("\n") + note;
}
(function tzPicker() {
  const select = $("hours-tz"); if (!select) return;
  const opt = (tz, label) => new Option(label || tzName(tz), tz);
  const top = ["America/Los_Angeles", "Asia/Shanghai", HOME_TZ];
  const group = (label, list) => { const g = document.createElement("optgroup"); g.label = label; g.append(...list); return g; };
  const quick = top.filter(tz => tz !== ownTZ).map(tz => opt(tz));
  quick.unshift(opt(ownTZ, `your time · ${tzName(ownTZ)}`));
  select.append(group("quick", quick));
  // capitals, west to east by current UTC offset (whole list of IANA zones is 400+ and unreadable)
  const CAPITALS = [["Pacific/Honolulu","honolulu"],["America/Anchorage","anchorage"],["America/Mexico_City","mexico city"],["America/Bogota","bogotá"],["America/New_York","washington / new york"],["America/La_Paz","la paz"],["America/Santiago","santiago"],["America/Argentina/Buenos_Aires","buenos aires"],["America/Sao_Paulo","brasília / são paulo"],["Atlantic/Azores","azores"],["Europe/London","london"],["Europe/Lisbon","lisbon"],["Africa/Lagos","lagos"],["Europe/Paris","paris"],["Europe/Berlin","berlin"],["Europe/Madrid","madrid"],["Europe/Amsterdam","amsterdam"],["Europe/Rome","rome"],["Africa/Cairo","cairo"],["Europe/Athens","athens"],["Europe/Kyiv","kyiv"],["Africa/Johannesburg","pretoria / johannesburg"],["Europe/Istanbul","ankara / istanbul"],["Europe/Moscow","moscow"],["Africa/Nairobi","nairobi"],["Asia/Riyadh","riyadh"],["Asia/Tehran","tehran"],["Asia/Dubai","abu dhabi / dubai"],["Asia/Karachi","islamabad / karachi"],["Asia/Kolkata","new delhi"],["Asia/Kathmandu","kathmandu"],["Asia/Dhaka","dhaka"],["Asia/Bangkok","bangkok"],["Asia/Jakarta","jakarta"],["Asia/Singapore","singapore"],["Asia/Hong_Kong","hong kong"],["Asia/Taipei","taipei"],["Asia/Manila","manila"],["Asia/Seoul","seoul"],["Asia/Tokyo","tokyo"],["Australia/Sydney","canberra / sydney"],["Pacific/Auckland","wellington / auckland"]];
  const now = new Date();
  const off = tz => { try { return Math.round(offsetMin(tz, now)); } catch { return null; } };
  const fmtOff = m => `utc${m < 0 ? "−" : "+"}${String(Math.floor(Math.abs(m) / 60)).padStart(2, "0")}${Math.abs(m) % 60 ? ":" + String(Math.abs(m) % 60).padStart(2, "0") : ""}`;
  const caps = CAPITALS.filter(([tz]) => !top.includes(tz) && off(tz) !== null).sort((a, b) => off(a[0]) - off(b[0])).map(([tz, name]) => opt(tz, `${name} · ${fmtOff(off(tz))}`));
  select.append(group("capitals", caps));
  if (![...select.options].some(o => o.value === hoursTZ)) hoursTZ = HOME_TZ;
  select.value = hoursTZ;
  select.addEventListener("change", () => { hoursTZ = select.value; savePreference("stats-hours-tz", hoursTZ); renderHours(); });
})();
const TODAY = tzToday();
let day = window.statsPage.selected;
if (day < FIRST) day = FIRST;
if (day > shift(TODAY, 1)) day = shift(TODAY, 1);

function rows(el, list, key) {
  if(!list){$(el).textContent="counts unavailable.";return;}
  const max = Math.max(1, ...list.map(x => x.n));
  $(el).innerHTML = list.length ? "" : '<p class="sub">nothing yet.</p>';
  list.forEach(x => {
    const r = document.createElement("div"); r.className = "lrow";
    r.innerHTML = `<span class="lname"></span><span class="lbar"><span style="width:${(x.n / max) * 100}%"></span></span><span class="lval">${x.n}</span>`;
    r.querySelector(".lname").textContent = x[key] || "?";
    $(el).appendChild(r);
  });
}

let stop;
function render() {
  stop?.();
  const currentURL = new URL(location.href);
  if (day === TODAY) currentURL.searchParams.delete('day');
  else currentURL.searchParams.set('day', day);
  history.replaceState(null, "", currentURL);
  $("day").textContent = day === TODAY ? `today · ${fmt(day)}` : fmt(day);
  $("prev").disabled = day <= FIRST;
  $("next").disabled = day > TODAY;
  const future = day > TODAY;
  $("past").style.display = future ? "none" : "block";
  $("future").style.display = future ? "block" : "none";
  if (future) { $("fday").textContent = fmt(day); return; }

  $("visitors").textContent = "…";
  $("visitors-line").textContent="";
  $("overview-details").hidden=true;
  $("countries-period").textContent = countryPeriod(day);
  $("countries").textContent = 'counting visitors…';
  const requestedDay = day;
  stop=window.statsPage.watch('overview',requestedDay,snapshot=>{
    if(day!==requestedDay)return;
    const s=snapshot.data;
    if(!s){
      $("visitors").textContent=snapshot.state==='warming'?'…':'—';
      $("visitors-line").textContent=snapshot.state==='warming'?'':'visitor count unavailable.';
      $("overview-details").hidden=true;return;
    }
    $("overview-details").hidden=false;
    const measuredDay=snapshot.day||day;
    $("countries-period").textContent=countryPeriod(measuredDay);
    window.overviewCoffee=s.coffee;
    document.dispatchEvent(new CustomEvent('overview-coffee',{detail:s.coffee}));
    document.querySelector('[data-coffee]').hidden=day!==TODAY;
    const uptime=document.querySelector('[data-uptime]');uptime.textContent='uptime 30d: '+(s.uptime==null?'—':s.uptime.toFixed(1)+'%');
    renderSupport(s.support);
    const outbound=$("outbound");outbound.replaceChildren();
    if(s.outbound)rows("outbound",s.outbound.hosts.map(([label,n])=>({label,n})),"label");else outbound.textContent='outbound counts unavailable.';
    const visitors=s.visitors==null?null:s.visitors+(s.unseen?.day||0);
    $("visitors").textContent = visitors??"—";
    const army=document.getElementById("audience-counts");
    if(army)army.textContent=`soldiers who said ok: ${s.soldiers?.day??0} today · ${s.soldiers?.all??0} all time · unseen visitors: ${s.unseen?.day??0}`;
    $("visitors-line").textContent = s.visitors==null?"visitor count unavailable.":measuredDay === TODAY
      ? (visitors === 1 ? "visitor today. just the one, so far." : `visitors today. so far, just ${visitors}.`)
      : `visitors on ${fmt(measuredDay)}.`;
    $("total-line").textContent = day === FIRST ? "day one. the crow came back." : `${s.total??'—'} visits since the crow came back (2 nov 2026).`;
    lastHours = s.hours; lastHoursDay = measuredDay; renderHours();
    if(s.countries)renderCountries($("countries"),s.countries);else $("countries").textContent="country counts unavailable.";
    rows("sources", s.sources, "s");
    rows("pages", s.pages, "p");
    rows("browsers", s.browsers, "b");
    const cliDay = Object.entries((s.cli && s.cli.day) || {}), cliAll = Object.values((s.cli && s.cli.all) || {}).reduce((a, b) => a + b, 0);
    $("cli").textContent = !s.cli ? "command-line counts unavailable." : cliDay.length
      ? `yes. ${cliDay.map(([t, n]) => `${n}× ${t}`).join(", ")} this day. someone's poking around 🕵️ · all time: ${cliAll}.`
      : `nobody curled corvus.gent this day.${cliAll ? ` all time: ${cliAll}.` : ""} (try: curl corvus.gent)`;
    $("feathers").textContent = `🪶 ${s.feathers??'—'} feathers found by ${s.hunters??'—'} hunters.`;
    $("terminal").textContent = !s.terminal ? "terminal counts unavailable." : s.terminal.length ? `most typed in the terminal: ${s.terminal.map(t => t.c).join(", ")}` : "nobody opened the terminal.";
    if (s.cv) $("cv").textContent = `📄 opened ${s.cv.open}× and downloaded ${s.cv.download}× this day · all time: ${s.cv.openTotal} opens, ${s.cv.downloadTotal} downloads.`;
    $("votes-sec").style.display = s.votes ? "block" : "none";
    $("unpaid-sec").style.display = s.unpaid_days ? "block" : "none";
    if (s.votes) rows("votes", Object.entries(s.votes).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([c, n]) => ({ c: names.of(c), n })), "c");
    if (s.unpaid_days) $("unpaid").textContent = `domain still unpaid: day ${s.unpaid_days}.`;
  });
}

$("prev").addEventListener("click", () => { day = shift(day, -1); render(); });
$("next").addEventListener("click", () => { day = shift(day, 1); render(); });
document.addEventListener("keydown", e => {
  if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || e.target.closest("input, select, textarea, button, a, [contenteditable], [role=slider], #visitor-map")) return;
  if (e.key === "ArrowLeft" && !$("prev").disabled) $("prev").click();
  if (e.key === "ArrowRight" && !$("next").disabled) $("next").click();
});
$("guess").addEventListener("submit", async e => {
  e.preventDefault();
  const f = e.target, button = f.querySelector('button');
  if (button.disabled) return;
  button.disabled = true;
  f.setAttribute("aria-busy", "true");
  $("guess-msg").textContent = "sending your guess…";
  try {
    const r = await fetch("/api/guess", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ guess: f.guess.value, email: f.email.value }), signal: AbortSignal.timeout(10000) });
    const d = await r.json();
    if (!r.ok || d.ok !== true) throw new Error(d.error || "try again later.");
    $("guess-msg").textContent = "locked in. if you're exactly right, you'll hear from the crow.";
    f.style.display = "none";
    if (window.posthog?.capture) window.posthog.capture("visitor_guess", { day });
  } catch (error) {
    $("guess-msg").textContent = error instanceof TypeError || error.name === 'TimeoutError' || error instanceof SyntaxError ? "the guess did not reach the crow. please try again." : error.message;
  } finally {
    button.disabled = false;
    f.removeAttribute("aria-busy");
  }
});
render();
