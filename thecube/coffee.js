// Hidden coffee beans on every /cube page. Finding one opens a support sheet.
// Pure donation: nothing is won, nothing depends on chance. Links come from one config.
const KAS = window.CUBE_KAS || '/thecube/kas/';
const SUPPORT = Object.assign({
  revolut: 'https://revolut.me/gabe6maxxing',      // first choice: any amount, straight to Gabriel
  coffee: 'https://buymeacoffee.com/gabe.maxxing',  // same jar as corvus.gent/call and /join-the-army-now
  stripe: null,   // a dedicated Stripe Payment Link for The Cube (Codex creates it; the existing links feed other pages' counters)
}, window.CUBE_SUPPORT || {});

const BEANS = ['keys', 'portal', 'casino', 'broke', 'seed', 'crow', 'steam'];
const T = {
  nl: { title: 'Je vond een koffieboon.', body: 'Dit project is gratis en blijft gratis. Wil je het steunen? Trakteer op een koffie of geef een vrije bijdrage.',
    coffee: '☕ Trakteer een koffie', stripe: 'Vrije bijdrage', soon: 'link volgt', found: '{n} van {t} bonen gevonden', close: 'Sluiten', kas: 'Naar de kassa van de Nar →',
    legal: 'Vrijwillige donatie. Je krijgt er niets voor terug: geen fiches, geen prijs, geen kansspel. Revolut gaat rechtstreeks naar Gabriel; Buy Me a Coffee en Stripe gaan naar Corvus. Er wordt niets terugbetaald, behalve bij een fout.' },
  en: { title: 'You found a coffee bean.', body: 'This project is free and stays free. Want to support it? Buy a coffee or give any amount.',
    coffee: '☕ Buy a coffee', stripe: 'Any amount', soon: 'link coming', found: '{n} of {t} beans found', close: 'Close', kas: 'To the Fool’s cashbox →',
    legal: 'Voluntary donation. You receive nothing in return: no chips, no prize, no game of chance. Revolut goes straight to Gabriel; Buy Me a Coffee and Stripe go to Corvus. Nothing is refunded except in case of error.' },
};
const lang = () => (document.documentElement.lang || 'nl').startsWith('en') ? 'en' : 'nl';
const found = () => { try { return new Set(JSON.parse(localStorage.getItem('cube-beans') || '[]')); } catch { return new Set(); } };
function remember(id) { const s = found(); s.add(id); try { localStorage.setItem('cube-beans', JSON.stringify([...s])); } catch {} return s.size; }

const css = `.cbean{position:fixed;inset:0;z-index:50;display:grid;place-items:center;background:rgba(8,6,12,.72);backdrop-filter:blur(6px);padding:16px}
.cbean[hidden]{display:none}.cbean .sheet{width:min(440px,100%);background:#120d1a;border:1px solid #3d2b5e;border-radius:20px;padding:26px;color:#efe7d2;font:15px/1.55 'Instrument Sans',system-ui,sans-serif;box-shadow:0 30px 80px rgba(0,0,0,.6)}
.cbean h2{font:400 28px/1.1 'Bodoni Moda',Georgia,serif;margin:6px 0 10px}.cbean .cup{font-size:34px}
.cbean .acts{display:grid;gap:8px;margin:18px 0 12px}.cbean a,.cbean button{display:block;text-align:center;border-radius:999px;padding:12px 16px;min-height:46px;font:600 15px system-ui,sans-serif;text-decoration:none;cursor:pointer}
.cbean a.p{background:#ffd76a;color:#1a1206}.cbean a.s{border:1px solid #7a5cb0;color:#efe7d2}.cbean a[aria-disabled=true]{opacity:.45;pointer-events:none}
.cbean .x{background:none;border:0;color:rgba(239,231,210,.6);font:13px ui-monospace,monospace;min-height:40px}.cbean small{display:block;color:rgba(239,231,210,.55);font:11.5px/1.5 ui-monospace,monospace}
.cbean .n{font:12px ui-monospace,monospace;color:#b4a0d6}.cbean-steam{position:fixed;right:10px;bottom:8px;z-index:20;font:14px ui-monospace,monospace;color:rgba(239,231,210,.14);background:none;border:0;cursor:pointer;padding:6px;min-width:32px;min-height:32px}
.cbean-steam:hover,.cbean-steam:focus-visible{color:#ffd76a}`;
let sheet;
function build() {
  const style = document.createElement('style'); style.textContent = css; document.head.append(style);
  sheet = document.createElement('div'); sheet.className = 'cbean'; sheet.hidden = true; sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-modal', 'true');
  sheet.addEventListener('click', e => { if (e.target === sheet) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !sheet.hidden) close(); });
  document.body.append(sheet);
  // a faint wisp of steam in the corner of every page
  const steam = document.createElement('button'); steam.className = 'cbean-steam'; steam.type = 'button'; steam.textContent = '≋'; steam.setAttribute('aria-label', 'koffie');
  steam.onclick = () => open('steam'); document.body.append(steam);
}
function open(source) {
  if (!sheet) build();
  const n = remember(source), t = T[lang()];
  const link = (href, cls, label) => `<a class="${cls}" ${href ? `href="${href}" target="_blank" rel="noopener"` : 'aria-disabled="true"'}>${label}${href ? '' : ' · ' + t.soon}</a>`;
  sheet.setAttribute('aria-label', t.title);
  sheet.innerHTML = `<div class="sheet"><div class="cup" aria-hidden="true">☕</div><h2>${t.title}</h2><p>${t.body}</p>
    <div class="acts">${SUPPORT.revolut ? link(SUPPORT.revolut, 'p', 'Revolut · ' + t.stripe) : ''}${link(SUPPORT.coffee, 's', t.coffee)}${SUPPORT.stripe ? link(SUPPORT.stripe, 's', t.stripe + ' · card') : ''}<a class="s" href="${KAS}">${t.kas}</a></div>
    <p class="n">${t.found.replace('{n}', n).replace('{t}', BEANS.length)}</p><small>${t.legal}</small><button class="x" type="button">${t.close}</button></div>`;
  sheet.querySelector('.x').onclick = close;
  sheet.hidden = false; sheet.querySelector('a:not([aria-disabled]),.x').focus();
  try { window.dispatchEvent(new CustomEvent('cube-coffee', { detail: { source } })); } catch {}
}
function close() { sheet.hidden = true; }

// Bean 1 (every page): type "koffie" or "coffee".
let typed = '';
document.addEventListener('keydown', e => {
  if (e.target.closest?.('input, textarea, select, [contenteditable]')) return;
  typed = (typed + (e.key.length === 1 ? e.key.toLowerCase() : '')).slice(-6);
  if (typed.endsWith('coffee') || typed.endsWith('koffie')) { typed = ''; open('keys'); }
});
window.cubeCoffee = { open };
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build); else build();
