// Translate presentation only. Booking state, form values and route IDs stay Dutch.
const LANGUAGES = {nl: 'Nederlands', fr: 'Français', en: 'English', es: 'Español'};
const normalize = value => value.replace(/\s+/g, ' ').trim();
const escapeRE = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function createTranslator(catalog = {}, language = 'nl') {
  const exact = new Map(Object.entries(catalog).map(([key, value]) => [normalize(key), value]));
  const locale = {nl:'nl-BE',fr:'fr-FR',en:'en-GB',es:'es-ES'}[language] || 'nl-BE';
  const dateWords = new Map();
  for (const kind of ['month', 'weekday']) for (const width of ['short', 'long']) {
    const count = kind === 'month' ? 12 : 7;
    for (let i = 0; i < count; i++) {
      const date = kind === 'month' ? new Date(Date.UTC(2026,i,1)) : new Date(Date.UTC(2026,0,4+i));
      const options = {[kind]:width,timeZone:'UTC'};
      dateWords.set(new Intl.DateTimeFormat('nl-BE',options).format(date), new Intl.DateTimeFormat(locale,options).format(date));
    }
  }
  const datePattern = new RegExp('(?<!\\p{L})(' + [...dateWords.keys()].sort((a,b)=>b.length-a.length).map(escapeRE).join('|') + ')(?!\\p{L})','gu');
  const dateCopy = value => dateWords.has(normalize(value)) || /\d/.test(value) ? value.replace(datePattern, word => dateWords.get(word)) : value;
  const patterns = [];
  for (const [originalSource, originalTarget] of exact) {
    let source = originalSource, target = originalTarget, ambiguous = false;
    // Optional suffixes are often adjacent slots (date + optional note). There
    // is no boundary to split at; keep them together instead of cutting a date.
    source = source.replace(/(?:\{\d+\}){2,}/g, group => {
      const tokens = group.match(/\{\d+\}/g);
      const output = new RegExp(tokens.map(escapeRE).join('\\s*'), 'g');
      if (!output.test(target)) {ambiguous = true; return group;}
      target = target.replace(output, tokens[0]);
      return tokens[0];
    });
    if (ambiguous) continue;
    if (!/\{\d+\}/.test(source) || source.replace(/\{\d+\}/g, '').trim().length < 4) continue;
    const slots = [...source.matchAll(/\{(\d+)\}/g)].map(match => match[1]);
    const parts = source.split(/\{\d+\}/).map(escapeRE);
    patterns.push({re: new RegExp('^' + parts.join('(.+?)') + '$', 'u'), slots, target, weight: parts.join('').length});
  }
  patterns.reverse().sort((a, b) => b.weight - a.weight);
  function translate(value, depth = 0) {
    if (value.includes('\n') && value.split('\n').filter(line=>normalize(line)).length > 1) return value.split('\n').map(line=>translate(line,depth)).join('\n');
    const key = normalize(value);
    if (!key) return value;
    let result = exact.get(key);
    if (result === undefined && depth < 2) {
      for (const pattern of patterns) {
        const match = pattern.re.exec(key);
        if (!match) continue;
        const args = Object.fromEntries(pattern.slots.map((slot, i) => [slot, translate(match[i + 1], depth + 1)]));
        result = pattern.target.replace(/\{(\d+)\}/g, (_, slot) => args[slot] ?? '{' + slot + '}');
        break;
      }
    }
    if (result === undefined) return dateCopy(value);
    return value.match(/^\s*/)[0] + result + value.match(/\s*$/)[0];
  }
  return translate;
}

if (typeof document !== 'undefined') {
  const controls = document.querySelector('#yp-languages');
  const originalText = new WeakMap();
  const originalAttributes = new WeakMap();
  const catalogs = {nl: {}};
  let current = 'nl', translate = value => value, scheduled = false, request = 0;
  const ignored = 'script,style,svg,code,pre,textarea,[translate="no"],[data-no-translate]';
  const attributes = ['placeholder', 'title', 'aria-label', 'alt'];
  function apply() {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode, parent = node.parentElement;
      if (!parent || parent.closest(ignored) || !normalize(node.data)) continue;
      const saved = originalText.get(node);
      const source = saved && node.data === saved.applied ? saved.source : node.data;
      // An option without value derives its submitted value from its text.
      // Pin that value before translating its visible label.
      if (parent.tagName === 'OPTION' && !parent.hasAttribute('value')) parent.setAttribute('value', parent.textContent);
      const applied = translate(source);
      originalText.set(node, {source, applied});
      if (node.data !== applied) node.data = applied;
    }
    for (const element of document.querySelectorAll(attributes.map(name => '[' + name + ']').join(','))) {
      if (element.closest(ignored)) continue;
      const saved = originalAttributes.get(element) || {};
      for (const name of attributes) {
        if (!element.hasAttribute(name)) continue;
        const value = element.getAttribute(name), previous = saved[name];
        const source = previous && value === previous.applied ? previous.source : value;
        const applied = translate(source);
        saved[name] = {source, applied};
        if (value !== applied) element.setAttribute(name, applied);
      }
      originalAttributes.set(element, saved);
    }
  }
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {scheduled = false; apply();});
  }
  async function select(language, persist = true) {
    if (!Object.hasOwn(LANGUAGES, language)) language = 'nl';
    const generation = ++request;
    controls.setAttribute('aria-busy', 'true');
    try {
      if (!catalogs[language]) {
        const response = await fetch(new URL('./locales/' + language + '.json?v=20261122yogi1', import.meta.url));
        if (!response.ok) throw Error('Translation unavailable');
        catalogs[language] = await response.json();
      }
      if (generation !== request) return;
      current = language;
      translate = createTranslator(catalogs[language], language);
      document.documentElement.lang = {nl:'nl-BE',fr:'fr',en:'en',es:'es'}[language];
      document.title = translate('Yogi Power · yoga & meditatie in Affligem');
      document.querySelector('meta[name="description"]').content = {
        nl:'Prototype nieuwe website en boekingsplatform voor Yogi Power, op basis van requirements v1.3.',
        fr:'Prototype du nouveau site et de la plateforme de réservation Yogi Power, basé sur le cahier des charges v1.3.',
        en:'Prototype of the new Yogi Power website and booking platform, based on requirements v1.3.',
        es:'Prototipo del nuevo sitio y plataforma de reservas de Yogi Power, basado en los requisitos v1.3.'
      }[language];
      for (const button of controls.querySelectorAll('button')) button.setAttribute('aria-pressed', String(button.dataset.language === language));
      controls.setAttribute('aria-label', {nl:'Taal',fr:'Langue',en:'Language',es:'Idioma'}[language]);
      controls.removeAttribute('data-error');
      apply();
      if (persist) {
        try {localStorage.setItem('yp-language', language);} catch {}
        const url = new URL(location.href); url.searchParams.set('lang', language);
        history.replaceState(history.state, '', url);
      }
    } catch {
      if (generation === request) controls.setAttribute('data-error', {
        nl:'Vertaling niet beschikbaar. Probeer opnieuw.',
        fr:'Traduction indisponible. Veuillez réessayer.',
        en:'Translation unavailable. Please try again.',
        es:'Traducción no disponible. Vuelve a intentarlo.'
      }[current]);
    } finally {
      if (generation === request) controls.removeAttribute('aria-busy');
    }
  }
  controls.addEventListener('click', event => {
    const button = event.target.closest('button[data-language]');
    if (button) select(button.dataset.language);
  });
  new MutationObserver(schedule).observe(document.body, {subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:attributes});
  let stored; try {stored = localStorage.getItem('yp-language');} catch {}
  select(new URL(location.href).searchParams.get('lang') || stored || 'nl', false);
  addEventListener('popstate', () => select(new URL(location.href).searchParams.get('lang') || 'nl', false));
}
