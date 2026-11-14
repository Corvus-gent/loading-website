import '../i18n/bar.js';
// Keep this round scoped to the audited pages; leave games and embeds alone.
const pages = new Set(['/','/realm','/legion','/gabe','/daily','/call','/support','/sf/larp','/wiki']);
if (pages.has(location.pathname.replace(/\/index\.html$/, '/').replace(/\/+$/, '') || '/') || document.body.hasAttribute('data-realm-gate')) {
  document.body.classList.add('site-accessible');
  const sheet = document.createElement('link');
  sheet.rel = 'stylesheet'; sheet.href = '/css/site/accessibility.css?v=20261112a11y1';
  document.head.append(sheet);
  const copy = {
    en:['Skip to content','Show or hide current location'],
    nl:['Naar de inhoud','Huidige locatie tonen of verbergen'],
    es:['Saltar al contenido','Mostrar u ocultar la ubicación actual'],
    fr:['Aller au contenu','Afficher ou masquer la position actuelle'],
    pt:['Saltar para o conteúdo','Mostrar ou ocultar a localização atual'],
    de:['Zum Inhalt','Aktuellen Standort anzeigen oder ausblenden'],
    zh:['跳至正文','显示或隐藏当前位置']
  };
  const main = document.querySelector('main');
  let skip;
  if (main) {
    main.id ||= 'site-main';
    if (!main.hasAttribute('tabindex')) main.tabIndex = -1;
    skip = document.createElement('a'); skip.className = 'site-skip-link'; skip.href = '#' + main.id;
    document.body.prepend(skip);
  }
  const hero = document.querySelector('[data-realm-gate] #hero'), locationText = document.getElementById('loc');
  if (hero && locationText) {
    hero.tabIndex = 0; hero.setAttribute('role','button'); hero.setAttribute('aria-controls',locationText.id);
    const sync = () => {
      const open = locationText.classList.contains('show');
      hero.setAttribute('aria-expanded',String(open)); locationText.setAttribute('aria-hidden',String(!open));
    };
    hero.addEventListener('keydown',event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); if (!event.repeat) hero.click(); }
    });
    new MutationObserver(sync).observe(locationText,{attributes:true,attributeFilter:['class']});
    sync();
  }
  const dialog = document.getElementById('realm-share'), heading = dialog?.querySelector('h2');
  if (heading && !dialog.hasAttribute('aria-label') && !dialog.hasAttribute('aria-labelledby')) {
    heading.id ||= 'realm-share-title'; dialog.setAttribute('aria-labelledby',heading.id);
  }
  function labels() {
    const text = copy[document.documentElement.lang] || copy.en;
    if (skip) skip.textContent = text[0];
    if (hero) hero.setAttribute('aria-label',text[1]);
  }
  labels(); window.addEventListener('corvus-language-change',labels);
}
