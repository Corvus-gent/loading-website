const $ = id => document.getElementById(id);
const post = body => fetch("/api/auth", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(async r => ({ ok: r.ok, ...(await r.json().catch(() => ({}))) }));
let email = "";

const TITLES = {
  outbound: ["outbound links", ["page", "host", "link", "clicks"]],
  funnel: ["per platform & post", ["source", "post", "views", "clicks", "pidgy", "trial", "qr"]],
  links: ["clicks per link", ["link", "clicks"]],
  pidgy_out: ["short links out (pidgy)", ["source", "campaign", "n"]],
  calls: ["call & coffee clicks", ["page", "n"]],
  search: ["searched for", ["query", "n"]],
  terminal: ["terminal commands", ["command", "n"]],
  hours: ["hour of day (Brussels)", ["hour", "views"]],
  pages: ["pages", ["page", "views", "visitors"]],
  feathers: ["feathers found", ["where", "n"]],
  referrers: ["referrers", ["domain", "views"]],
};

function table(title, head, data) {
  const sec = document.createElement("section"); sec.className = "st-sec";
  const h = document.createElement("h2"); h.textContent = title; sec.appendChild(h);
  if (!data.length) { const p = document.createElement("p"); p.className = "sub"; p.textContent = "nothing yet."; sec.appendChild(p); return sec; }
  const t = document.createElement("table"); t.className = "st-table";
  t.innerHTML = "<tr>" + head.map(x => `<th>${x}</th>`).join("") + "</tr>";
  data.forEach(row => {
    const tr = document.createElement("tr");
    (Array.isArray(row) ? row : head.map(k => row[k])).forEach(v => { const td = document.createElement("td"); td.textContent = v ?? "–"; tr.appendChild(td); });
    t.appendChild(tr);
  });
  sec.appendChild(t); return sec;
}

async function dash(who) {
  $("login").style.display = "none"; $("dash").style.display = "block"; $("who").textContent = who;
  const r = await fetch("/api/private-stats", { credentials: "same-origin" });
  if (!r.ok) { $("out").textContent = r.status === 401 ? "session expired." : "stats not connected yet."; return; }
  const s = await r.json();
  Object.entries(TITLES).forEach(([k, [title, head]]) => $("out").appendChild(table(title, head, s[k] || [])));
  $("out").appendChild(table("goodreads requests", ["email", "at"], s.access_requests || []));
  $("out").appendChild(table("visitor guesses (exact = gift)", ["day", "email", "guess"], s.guesses || []));
  $("out").appendChild(table("logins", ["email", "at"], s.logins || []));
  $("updated").textContent = `refreshes every 10 minutes · last: ${new Date(s.updated).toLocaleString()}`;
}

$("f-mail").addEventListener("submit", async e => {
  e.preventDefault(); email = e.target.email.value.trim();
  const r = await post({ action: "request", email });
  $("msg").textContent = r.message || r.error || "";
  if (r.ok) { $("f-mail").style.display = "none"; $("f-code").style.display = "flex"; e.target.reset(); }
});
$("f-code").addEventListener("submit", async e => {
  e.preventDefault();
  const r = await post({ action: "verify", email, code: e.target.code.value.trim() });
  if (r.ok) dash(r.email); else $("msg").textContent = r.error || "wrong code";
});
$("logout").addEventListener("click", async e => { e.preventDefault(); await post({ action: "logout" }); location.reload(); });

fetch("/api/auth", { credentials: "same-origin" }).then(r => r.json()).then(d => { if (d.email) dash(d.email); }).catch(() => {});
