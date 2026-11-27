import {formatPageText, translatePageText} from './i18n/page-copy.js';
import {number} from './stats-view.js';
import {renderSupport} from './stats-support.js?v=20261109order1';
import {renderCountries, countryPeriod} from './stats-countries.js';
import {readPreference, savePreference} from './storage.js';
const $ = id => document.getElementById(id);
const bar = (n, max, w = 18) => n ? "█".repeat(Math.max(1, Math.round((n / Math.max(1, max)) * w))) : "";
const lang = () => document.documentElement.lang || "en-GB";
const fmt = d => new Date(d + "T12:00:00Z").toLocaleDateString(lang() === "en" ? "en-GB" : lang(), { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Brussels" });
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
  $("hours-title").textContent = formatPageText('per hour ({zone})', { zone: translatePageText(tzName(tz)) });
  if (!lastHours) { $("hours").textContent = "hourly counts unavailable."; return; }
  const at = new Date((lastHoursDay || TODAY) + "T12:00:00Z");
  let diff = 0; try { diff = Math.round((offsetMin(tz, at) - offsetMin(HOME_TZ, at)) / 60); } catch { hoursTZ = HOME_TZ; return renderHours(); }
  const byHour = {};
  for (const { h, n } of lastHours) { const k = ((h + diff) % 24 + 24) % 24; byHour[k] = (byHour[k] || 0) + n; }
  const max = Math.max(1, ...Object.values(byHour));
  const note = local ? "" : "\n" + formatPageText('({date} in Brussels, shown in {zone} time)', {
    date: fmt(lastHoursDay || TODAY), zone: translatePageText(tzName(tz))
  });
  $("hours").textContent = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, "0")}h ${bar(byHour[h] || 0, max)} ${byHour[h] ? number(byHour[h]) : ""}`).join("\n") + note;
}
(function tzPicker() {
  const select = $("hours-tz"); if (!select) return;
  const opt = (tz, label) => new Option(label || tzName(tz), tz);
  const top = ["America/Los_Angeles", "Asia/Shanghai", HOME_TZ];
  const group = (label, list) => { const g = document.createElement("optgroup"); g.label = label; g.append(...list); return g; };
  const quick = top.filter(tz => tz !== ownTZ).map(tz => opt(tz));
  const localOption = opt(ownTZ, formatPageText('your time · {zone}', {zone: tzName(ownTZ)}));
  quick.unshift(localOption);
  window.addEventListener('corvus-page-copy-ready', () => {
    localOption.textContent = formatPageText('your time · {zone}', {zone: translatePageText(tzName(ownTZ))});
  });
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
    r.innerHTML = `<span class="lname"></span><span class="lbar"><span></span></span><span class="lval">${number(x.n)}</span>`;
    r.querySelector(".lbar span").style.width = 100 * x.n / max + '%';
    r.querySelector(".lname").textContent = x[key] || "?";
    $(el).appendChild(r);
  });
}

let stop, lastSnapshot;
const heading = day => day === TODAY ? formatPageText('today · {date}', { date: fmt(day) }) : fmt(day);
function render() {
  stop?.();
  lastSnapshot = undefined;
  const currentURL = new URL(location.href);
  if (day === TODAY) currentURL.searchParams.delete('day');
  else currentURL.searchParams.set('day', day);
  history.replaceState(null, "", currentURL);
  $("day").textContent = heading(day);
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
    lastSnapshot = snapshot;
    paint(snapshot);
  });
}

function paint(snapshot) {
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
  const uptime=document.querySelector('[data-uptime]');uptime.textContent=formatPageText('uptime 30d: {percent}', { percent: s.uptime == null ? '—' :
    new Intl.NumberFormat(lang(), { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(s.uptime / 100) });
  renderSupport(s.support);
  const outbound=$("outbound");outbound.replaceChildren();
  if(s.outbound)rows("outbound",s.outbound.hosts.map(([label,n])=>({label,n})),"label");else outbound.textContent='outbound counts unavailable.';
  const visitors=s.visitors==null?null:s.visitors+(s.unseen?.day||0);
  $("visitors").textContent = number(visitors);
  const army=document.getElementById("audience-counts");
  if(army)army.textContent=[
    formatPageText('soldiers who said ok: {today} today · {total} all time', {
      today: number(s.soldiers?.day ?? 0), total: number(s.soldiers?.all ?? 0)
    }),
    formatPageText('unseen visitors: {count}', { count: number(s.unseen?.day ?? 0) })
  ].join(' · ');
  $("visitors-line").textContent = s.visitors==null?"visitor count unavailable.":measuredDay === TODAY
    ? (visitors === 1 ? "visitor today. just the one, so far." : formatPageText('visitors today. so far, just {count}.', { count: number(visitors) }))
    : formatPageText('visitors on {date}.', { date: fmt(measuredDay) });
  $("total-line").textContent = day === FIRST ? "day one. the crow came back." : formatPageText('{count} visits since the crow came back ({date}).', { count: number(s.total), date: fmt(FIRST) });
  lastHours = s.hours; lastHoursDay = measuredDay; renderHours();
  if(s.countries)renderCountries($("countries"),s.countries);else $("countries").textContent="country counts unavailable.";
  rows("sources", s.sources, "s");
  rows("pages", s.pages, "p");
  rows("browsers", s.browsers, "b");
  const cliDay = Object.entries((s.cli && s.cli.day) || {}), cliAll = Object.values((s.cli && s.cli.all) || {}).reduce((a, b) => a + b, 0);
  $("cli").textContent = !s.cli ? "command-line counts unavailable." : cliDay.length
    ? formatPageText("{tools} this day. Someone’s poking around 🕵️ · all time: {total}.", {
        tools: cliDay.map(([tool, count]) => `${number(count)}× ${tool}`).join(", "), total: number(cliAll)
      })
    : [translatePageText('nobody curled corvus.gent this day.'),
        cliAll ? formatPageText('all time: {count}.', { count: number(cliAll) }) : '',
        translatePageText('(try: curl corvus.gent)')].filter(Boolean).join(' ');
  $("feathers").textContent = formatPageText('🪶 {feathers} feathers found by {hunters} hunters.', { feathers: number(s.feathers), hunters: number(s.hunters) });
  $("terminal").textContent = !s.terminal ? "terminal counts unavailable." : s.terminal.length ? formatPageText('most typed in the terminal: {commands}', { commands: s.terminal.map(t => t.c).join(', ') }) : "nobody opened the terminal.";
  if (s.cv) $("cv").textContent = formatPageText('📄 opened {opens}× and downloaded {downloads}× this day · all time: {openTotal} opens, {downloadTotal} downloads.', {
    opens: number(s.cv.open), downloads: number(s.cv.download), openTotal: number(s.cv.openTotal), downloadTotal: number(s.cv.downloadTotal)
  });
  $("votes-sec").style.display = s.votes ? "block" : "none";
  $("unpaid-sec").style.display = s.unpaid_days ? "block" : "none";
  const names = new Intl.DisplayNames(lang(), { type: "language" });
  if (s.votes) rows("votes", Object.entries(s.votes).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([c, n]) => ({ c: names.of(c), n })), "c");
  if (s.unpaid_days) $("unpaid").textContent = formatPageText('domain still unpaid: day {day}.', { day: number(s.unpaid_days) });
}
$("prev").addEventListener("click", () => { day = shift(day, -1); render(); });
$("next").addEventListener("click", () => { day = shift(day, 1); render(); });
document.addEventListener("keydown", e => {
  if (e.target.closest("input, #visitor-map")) return;
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
window.addEventListener('corvus-page-copy-ready', () => {
  $("day").textContent = heading(day);
  if (day > TODAY) $("fday").textContent = fmt(day);
  else if (lastSnapshot) paint(lastSnapshot);
});
render();
