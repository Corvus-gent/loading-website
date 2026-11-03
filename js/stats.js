const $ = id => document.getElementById(id);
const bar = (n, max, w = 18) => "█".repeat(Math.max(1, Math.round((n / Math.max(1, max)) * w)));
const rows = (el, list, key, val = "n") => {
  const max = Math.max(1, ...list.map(x => x[val]));
  $(el).innerHTML = "";
  list.forEach(x => {
    const r = document.createElement("div"); r.className = "lrow";
    r.innerHTML = `<span class="lname"></span><span class="lbar"><span style="width:${(x[val] / max) * 100}%"></span></span><span class="lval">${x[val]}</span>`;
    r.querySelector(".lname").textContent = x[key] || "?";
    $(el).appendChild(r);
  });
};
const names = new Intl.DisplayNames(["en"], { type: "language" });

fetch("/api/stats").then(r => r.ok ? r.json() : Promise.reject(r.status)).then(s => {
  $("today").textContent = s.today;
  $("today-line").textContent = s.today === 1 ? "visitor today. just the one, so far." : `visitors today. so far, just ${s.today}.`;
  $("total-line").textContent = `${s.total} visits since the crow came back (2 nov 2026).`;
  const max = Math.max(...s.daily.map(d => d.n), 1);
  $("daily").textContent = s.daily.slice(-14).map(d => `${d.d.slice(5)}  ${bar(d.n, max)} ${d.n}`).join("\n");
  rows("countries", s.countries, "c");
  rows("sources", s.sources, "s");
  rows("pages", s.pages, "p");
  $("feathers").textContent = `🪶 ${s.feathers} feathers found by ${s.hunters} hunters.`;
  $("terminal").textContent = s.terminal.length ? `most typed in the terminal: ${s.terminal.map(t => t.c).join(", ")}` : "nobody found the terminal yet.";
  rows("votes", Object.entries(s.votes).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([c, n]) => ({ c: names.of(c), n })), "c");
  $("unpaid").textContent = `domain still unpaid: day ${s.unpaid_days}.`;
  $("updated").textContent = `updated every hour · last: ${new Date(s.updated).toLocaleString()}`;
}).catch(() => { $("today").textContent = "…"; $("today-line").textContent = "the crow is still counting. come back soon."; });
