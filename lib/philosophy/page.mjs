// Both language routes are compiled from this shared component and translation data.
export const PHILOSOPHY_ROUTES={nl:'/cv/filosofie',en:'/cv/philosophy',es:'/cv/philosophy/es',fr:'/cv/philosophy/fr',pt:'/cv/philosophy/pt',de:'/cv/philosophy/de',zh:'/cv/philosophy/zh'};
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function renderPhilosophyPage(language,translations){
 const lang=Object.hasOwn(PHILOSOPHY_ROUTES,language)?language:'en',copy=translations[lang],url='https://corvus.gent'+PHILOSOPHY_ROUTES[lang];
 const sections=copy.sections.map(section=>`<section><h2>${esc(section.heading)}</h2>${section.timeline?`<ol class="timeline">${section.timeline.map(item=>`<li><strong>${esc(item.label)}</strong><p>${item.text}</p></li>`).join('')}</ol>`:section.paragraphs.map(p=>`<p${p.note?' class="personal-note"':''}>${p.html}</p>`).join('')}${section.contact?`<a class="email" href="mailto:gabriel@corvus.gent">gabriel@corvus.gent</a><img class="margin-art michael" src="/public/inspiration/michael-margin.webp" alt="${lang==='nl'?'Aartsengel Michaël':'Archangel Michael'}" loading="lazy">`:''}</section>`).join('\n');
 return `<!doctype html>
<html lang="${lang}" data-language-routes='${JSON.stringify(PHILOSOPHY_ROUTES)}'>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light dark"><meta name="robots" content="noindex, nofollow">
<title>${esc(copy.title)}</title><meta name="description" content="${esc(copy.description)}">
<link rel="canonical" href="${url}">${Object.entries(PHILOSOPHY_ROUTES).map(([code,path])=>`<link rel="alternate" hreflang="${code}" href="https://corvus.gent${path}">`).join('')}
<meta property="og:type" content="website"><meta property="og:locale" content="${({nl:'nl_BE',en:'en_GB',es:'es_ES',fr:'fr_FR',pt:'pt_PT',de:'de_DE',zh:'zh_CN'})[lang]}"><meta property="og:title" content="${esc(copy.title)}"><meta property="og:description" content="${esc(copy.description)}"><meta property="og:url" content="${url}"><meta property="og:image" content="https://corvus.gent/og.png"><meta name="twitter:card" content="summary_large_image"><link rel="icon" href="/logo.png">
<link rel="stylesheet" href="/cv/filosofie/reading.css"><script type="module" src="/js/philosophy-page.js"></script></head>
<body class="philosophy-page"><main>
<div class="reading-controls"><nav class="languages" aria-label="${esc(copy.toggleLabel)}">${Object.entries(PHILOSOPHY_ROUTES).map(([code,path])=>`<a href="${path}" hreflang="${code}" lang="${code}"${code===lang?' aria-current="page"':''}>${code.toUpperCase()}</a>`).join('')}</nav><label class="reading-theme-label">${esc(copy.appearanceLabel)} <select id="reading-theme"><option value="system">${esc(copy.systemLabel)}</option><option value="light">${esc(copy.lightLabel)}</option><option value="dark">${esc(copy.darkLabel)}</option></select></label></div>
<header><img class="margin-art diogenes" src="/public/inspiration/diogenes-margin.webp" alt="${lang==='nl'?'Diogenes met zijn lantaarn':'Diogenes with his lantern'}"><img class="portrait" src="/public/gabe.jpg" alt="${esc(copy.portraitLabel)}" width="112" height="112" fetchpriority="high"><h1>${esc(copy.name)}</h1><p class="lead">${esc(copy.lead)}</p></header>
${sections}
</main></body></html>\n`;
}
