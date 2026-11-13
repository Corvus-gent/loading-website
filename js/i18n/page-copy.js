// Bind generated page copy at runtime so rebuilds cannot erase translation hooks.
// Exact text matches only: never replace HTML, URLs, names or tier contents.
let observer;
export function bindPageCopy(english, refresh, current) {
  if (!/^\/(?:legion|daily|gabe|support|flyer|books|now)(?:\/|$)/.test(location.pathname)) return false;
  const roots = [...document.querySelectorAll('main, .site-section, #corvus-flyer .masthead, #corvus-flyer .colophon, #corvus-flyer .skip')];
  const keys = new Map(Object.entries(english).filter(([,text])=>typeof text==='string' && text.trim().length>1).map(([key,text])=>[text.trim(),key]));
  let changed = false;
  const excluded = 'script,style,svg,noscript,[data-i18n],.legion-rules,.rank-list';
  for (const root of roots) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      const parent = node.parentElement, text = node.textContent.trim();
      if (!parent) continue;
      let key = keys.get(text), params = {};
      if (!key && parent.closest('#member-status') && /^(\d+) soldiers\. Different worlds\.$/.test(text)) {
        key='legion.count'; params.count=text.match(/^\d+/)[0];
      } else if (!key && parent.closest('.member-card .site-fine') && /^since \d{4}-\d{2}-\d{2}$/.test(text)) {
        key='legion.since'; params.date=text.slice(6);
      } else if (!key && parent.closest('.member-card a') && /^meet .+ →$/.test(text)) {
        key='legion.meetName'; params.name=text.slice(5,-2);
      }
      const blocked = parent.closest(excluded);
      if (!key || (blocked && !(blocked===parent && parent.dataset.pageCopy==='text'))) continue;
      const copy = (current()[key] ?? english[key]).replace(/\{(\w+)\}/g,(token,name)=>params[name] ?? token);
      if (parent.dataset.pageCopy==='text' && parent.dataset.i18n===key && parent.textContent===copy && Object.entries(params).every(([name,value])=>parent.getAttribute('data-i18n-'+name)===value)) continue;
      if (parent.childNodes.length===1 && !parent.closest('[role=status],[role=alert],.site-status')) {
        parent.dataset.i18n = key;
        parent.dataset.pageCopy = 'text';
        for (const [name,value] of Object.entries(params)) parent.setAttribute('data-i18n-'+name,value);
      } else {
        const span = document.createElement('span');
        span.dataset.i18n = key;
        for (const [name,value] of Object.entries(params)) span.setAttribute('data-i18n-'+name,value);
        const [,before,after] = node.textContent.match(/^(\s*)[\s\S]*?(\s*)$/);
        node.replaceWith(document.createTextNode(before),span,document.createTextNode(after));
      }
      changed = true;
    }
    for (const el of root.querySelectorAll('[placeholder],[aria-label]')) {
      if (el.closest('.legion-rules,.rank-list')) continue;
      for (const [attr,hook] of [['placeholder','i18nPlaceholder'],['aria-label','i18nAriaLabel']]) {
        const key = keys.get(el.getAttribute(attr)?.trim());
        if (key && el.dataset[hook]!==key) { el.dataset[hook]=key; changed=true; }
      }
    }
  }
  if (!observer && roots.length) {
    observer = new MutationObserver(()=>{ if (bindPageCopy(english,refresh,current)) refresh(); });
    for (const root of roots) observer.observe(root,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['placeholder','aria-label']});
  }
  return changed;
}
