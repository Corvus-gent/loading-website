// The catalog contains published copy only. Lookup and DOM updates run locally.
const catalogVersion = '20261120phoenix';
const catalogs = new Map();
const textState = new WeakMap();
const attributeState = new WeakMap();
const attributes = ['alt', 'aria-label', 'title', 'placeholder', 'label'];
const skipped = 'script, style, code, pre, kbd, samp, svg, template, noscript, [contenteditable], [translate="no"], #lang-switcher';
let dictionary = {};
let generation = 0;
let observer;

const normalize = text => text.replace(/\s+/g, ' ').trim();

export function translatePageText(text) {
  if (typeof text !== 'string') return text;
  const key = normalize(text);
  return Object.hasOwn(dictionary, key) ? dictionary[key] : text;
}

export function formatPageText(text, values) {
  return translatePageText(text).replace(/\{(\w+)\}/g, (placeholder, key) =>
    Object.hasOwn(values, key) ? values[key] : placeholder);
}

function translatedValue(value, previous) {
  const original = value === previous?.rendered ? previous.original : value;
  const translation = translatePageText(original);
  const rendered = translation === original ? original
    : original.replace(/^(\s*)[\s\S]*?(\s*)$/, (_, before, after) => before + translation + after);
  return {original, rendered};
}

function updateText(node) {
  const parent = node.parentElement;
  if (!parent || parent.closest(skipped + ', [data-i18n], [data-wc], [data-army]')) return;
  const lang = parent.closest('[lang]:not(html)')?.lang;
  if (lang && !/^en(?:-|$)/i.test(lang)) return;
  const state = translatedValue(node.data, textState.get(node));
  if (state.rendered !== state.original) {
    const option = parent.closest('option:not([value])');
    if (option) option.value = option.value;
    textState.set(node, state);
  } else {
    textState.delete(node);
  }
  if (node.data !== state.rendered) node.data = state.rendered;
}

function updateAttributes(el) {
  if (el.closest(skipped)) return;
  const names = el.matches('meta[name="description"]') ? ['content'] : attributes;
  const states = attributeState.get(el) ?? new Map();
  for (const name of names) {
    if (name === 'placeholder' && el.hasAttribute('data-i18n-placeholder')) continue;
    if (name === 'aria-label' && el.hasAttribute('data-army-label')) continue;
    const value = el.getAttribute(name);
    if (value === null) {
      states.delete(name);
      continue;
    }
    const state = translatedValue(value, states.get(name));
    if (state.rendered !== state.original) states.set(name, state);
    else states.delete(name);
    if (value !== state.rendered) el.setAttribute(name, state.rendered);
  }
  if (states.size) attributeState.set(el, states);
  else attributeState.delete(el);
}

function updateTree(root) {
  if (root.nodeType === Node.TEXT_NODE) {
    updateText(root);
    return;
  }
  if (root.nodeType !== Node.ELEMENT_NODE || root.closest(skipped)) return;
  updateAttributes(root);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      return node.nodeType === Node.ELEMENT_NODE && node.matches(skipped)
        ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
    }
  });
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.nodeType === Node.TEXT_NODE) updateText(node);
    else updateAttributes(node);
  }
}

function observe() {
  observer ??= new MutationObserver(records => {
    for (const record of records) {
      if (record.type === 'characterData') updateText(record.target);
      else if (record.type === 'attributes') updateAttributes(record.target);
      else for (const node of record.addedNodes) updateTree(node);
    }
  });
  observer.observe(document.documentElement, {
    subtree: true, childList: true, characterData: true, attributes: true,
    attributeFilter: [...attributes, 'content']
  });
}

function loadCatalog(lang) {
  if (lang === 'en') return Promise.resolve({});
  if (!catalogs.has(lang)) {
    const request = fetch('/public/i18n/site.' + lang + '.json?v=' + catalogVersion, {
      signal: AbortSignal.timeout(8000)
    }).then(response => {
      if (!response.ok) throw Error('Page translations unavailable');
      return response.json();
    }).catch(() => {
      catalogs.delete(lang);
      return {};
    });
    catalogs.set(lang, request);
  }
  return catalogs.get(lang);
}

export async function applyPageCopy(lang) {
  const request = ++generation;
  const selected = await loadCatalog(lang);
  if (request !== generation) return;
  dictionary = selected;
  observer?.disconnect();
  updateTree(document.documentElement);
  // English needs only a single pass to restore earlier translations.
  if (Object.keys(dictionary).length) observe();
  window.dispatchEvent(new Event('corvus-page-copy-ready'));
}
