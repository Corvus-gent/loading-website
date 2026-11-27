// the oracle's voice, chosen by Prolog rules (oracle.pl) run with Tau Prolog in the browser. JS picks nothing itself.
const TAU = 'https://cdn.jsdelivr.net/npm/tau-prolog@0.3.4/modules/core.js';
const load = () => window.pl ? Promise.resolve(window.pl) : new Promise((ok, no) => { const s = document.createElement('script'); s.src = TAU; s.onload = () => ok(window.pl); s.onerror = no; document.head.append(s); });
export async function ask({ hour = new Date().getHours(), rank = 1, visits = 1 } = {}) {
  const pl = await load(); const rules = await (await fetch(new URL('./oracle.pl', import.meta.url))).text();
  const session = pl.create(1000);
  await new Promise((ok, no) => session.consult(rules, { success: ok, error: no }));
  await new Promise((ok, no) => session.query(`voice(${hour | 0}, ${rank | 0}, ${visits | 0}, Line).`, { success: ok, error: no }));
  return new Promise(ok => session.answer({ success: a => ok(String(a.links.Line).replace(/^'|'$/g, '').replace(/\\'/g, "'")), fail: () => ok(null), error: () => ok(null), limit: () => ok(null) }));
}
