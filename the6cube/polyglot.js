// The Corvus polyglot rail, rebuilt for /cube: same languages, same flag-coloured letters, same storage
// (cookie corvus_lang, as js/storage.js), plus "· polyglot stats". On the real site, swap this for js/i18n/bar.js.
const LANGS = [['en', 'EN'], ['nl', 'NL'], ['es', 'ES'], ['fr', 'FR'], ['pt', 'PT'], ['de', 'DE'], ['zh', '中文']];
const FLAGS = { en: ['uk', 'usa'], nl: ['netherlands', 'flanders'], es: ['spain', 'bolivia'], fr: ['france', 'france'], pt: ['brazil', 'portugal'], de: ['germany', 'germany'], zh: ['china', 'hong-kong'] };
const CSS = `#lang-switcher[data-site-languages]{position:fixed;inset:0 0 auto;z-index:60;display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:0 8px;height:28px;padding:0 8px;background:#080808;font:11px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.2px}
#lang-switcher a{display:inline-flex;align-items:center;min-height:26px;color:#999;text-decoration:none}
#lang-switcher a[aria-current]{text-decoration:underline;text-underline-offset:3px}#lang-switcher a:focus-visible{outline:2px solid #ffd76a;outline-offset:2px}
[data-flag="uk"]{--flag:linear-gradient(135deg,#9eb6f2 29%,#f4ebdf 30% 45%,#f68b91 46% 58%,#f4ebdf 59% 68%,#9eb6f2 69%)}
[data-flag="usa"]{--flag:linear-gradient(90deg,#9eb6f2 52%,transparent 52%) top/100% 45% no-repeat,repeating-linear-gradient(#f68b91 0 2px,#f4ebdf 2px 4px)}
[data-flag="netherlands"]{--flag:linear-gradient(#f68b91 33%,#f4ebdf 33% 66%,#9eb6f2 66%)}[data-flag="flanders"]{--flag:linear-gradient(155deg,#f5d66a 68%,#27211b 68% 80%,#f5d66a 80%)}
[data-flag="spain"]{--flag:linear-gradient(#f68b91 24%,#f5d66a 24% 76%,#f68b91 76%)}[data-flag="bolivia"]{--flag:linear-gradient(#f68b91 33%,#f5d66a 33% 66%,#92cd99 66%)}
[data-flag="france"]{--flag:linear-gradient(90deg,#9eb6f2 33%,#f4ebdf 33% 66%,#f68b91 66%)}[data-flag="brazil"]{--flag:linear-gradient(135deg,#92cd99 28%,#f5d66a 28% 45%,#9eb6f2 45% 57%,#f5d66a 57% 74%,#92cd99 74%)}
[data-flag="portugal"]{--flag:linear-gradient(90deg,#92cd99 32%,#f5d66a 32% 48%,#f68b91 48%)}[data-flag="germany"]{--flag:linear-gradient(#77716d 30%,#f68b91 30% 64%,#f5d66a 64%)}
[data-flag="china"]{--flag:linear-gradient(140deg,#f5d66a 25%,#f68b91 25%)}[data-flag="hong-kong"]{--flag:radial-gradient(circle,#f4ebdf 26%,#f68b91 28%)}
@media (forced-colors:none){@supports (background-clip:text){#lang-switcher [data-flag]{background:var(--flag);-webkit-background-clip:text;background-clip:text;color:transparent}}}
body.has-polyglot{--rail:28px}`;

export function currentLang(supported = LANGS.map(([c]) => c), fallback = 'en') {
  const q = new URLSearchParams(location.search).get('lang'); if (supported.includes(q)) return q;
  const c = document.cookie.split(';').map(s => s.trim()).find(s => s.startsWith('corvus_lang='))?.slice(12); if (supported.includes(c)) return c;
  try { const s = localStorage.getItem('corvus-lang'); if (supported.includes(s)) return s; } catch {}
  const n = (navigator.language || fallback).slice(0, 2).toLowerCase(); return supported.includes(n) ? n : fallback;
}
function save(code) {
  try { localStorage.setItem('corvus-lang', code); } catch {}
  try { document.cookie = `corvus_lang=${code}; Max-Age=31536000; Path=/; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`; } catch {}
}
// onChange(code) re-renders in place; without it the page reloads with ?lang=
export function mountPolyglot(onChange) {
  if (!document.getElementById('polyglot-css')) { const s = document.createElement('style'); s.id = 'polyglot-css'; s.textContent = CSS; document.head.append(s); }
  let bar = document.getElementById('lang-switcher');
  if (!bar) { bar = document.createElement('nav'); bar.id = 'lang-switcher'; bar.dataset.siteLanguages = ''; bar.dataset.flagLanguages = ''; document.body.prepend(bar); }
  document.body.classList.add('has-polyglot');
  const draw = () => {
    const cur = currentLang(); let names; try { names = new Intl.DisplayNames(cur, { type: 'language' }); } catch {}
    bar.setAttribute('aria-label', names?.of(cur) ?? 'Language');
    bar.replaceChildren(...LANGS.map(([code, label]) => {
      const a = document.createElement('a'); const url = new URL(location.href); url.searchParams.set('lang', code);
      a.href = url.href; a.hreflang = code; a.setAttribute('aria-label', names?.of(code) ?? code);
      [...label].forEach((ch, i) => { const s = document.createElement('span'); s.dataset.flag = FLAGS[code][i % 2]; s.textContent = ch; a.append(s); });
      if (code === cur) a.setAttribute('aria-current', 'true');
      a.addEventListener('click', e => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault(); save(code); history.replaceState(null, '', a.href);
        if (onChange) { onChange(code); draw(); window.dispatchEvent(new CustomEvent('corvus-language-change', { detail: { lang: code } })); }
        else location.reload();
      });
      return a;
    }), (() => { const a = document.createElement('a'); a.href = '/languages/'; const s = document.createElement('span');
      for (const [f, t] of [['spain', '· poly'], ['china', 'glot '], ['portugal', 'st'], ['france', 'ats']]) { const p = document.createElement('span'); p.dataset.flag = f; p.textContent = t; s.append(p); }
      a.append(s); return a; })());
  };
  draw();
  return { redraw: draw };
}
