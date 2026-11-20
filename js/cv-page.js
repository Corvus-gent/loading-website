// Small progressive enhancements; the full CV and downloads work without JavaScript.
export function formatCvCount(value,lang='en') {
  const number=Number(value);
  if(!Number.isSafeInteger(number)||number<0)return null;
  try{return new Intl.NumberFormat(lang).format(number);}catch{return new Intl.NumberFormat('en').format(number);}
}
const hints={
 en:['Secret code','in binary','Hover or use arrow keys for another code; click for binary.'],
 nl:['Geheime code','in binair','Beweeg erover of gebruik de pijltjes voor een andere code; klik voor binair.'],
 es:['Código secreto','en binario','Pasa el cursor o usa las flechas para cambiar de código; haz clic para verlo en binario.'],
 fr:['Code secret','en binaire','Survolez ou utilisez les flèches pour changer de code ; cliquez pour le binaire.'],
 pt:['Código secreto','em binário','Passe o cursor ou use as setas para mudar de código; clique para ver em binário.'],
 de:['Geheimcode','binär','Mit Maus oder Pfeiltasten wechseln; für Binärdarstellung klicken.'],
 zh:['秘密数字','二进制','悬停或使用方向键切换数字；点击查看二进制。']
};
export function mountCvPage(doc,win,getLang=()=>doc.documentElement.lang||'en') {
  const button=doc.querySelector('[data-cv-secret]');
  const codes=['512','520','1314'];let index=0,binary=false;
  function renderSecret(lang=getLang()) {
    if(!button)return;
    const words=hints[lang]||hints.en;
    button.textContent=binary?Number(codes[index]).toString(2):codes[index];
    const label=`${words[0]} ${codes[index]}${binary?', '+words[1]:''}. ${words[2]}`;
    button.setAttribute('aria-label',label);button.title=label;
  }
  function next(step=1){index=(index+step+codes.length)%codes.length;binary=false;renderSecret();}
  function refresh(lang=getLang()) {
    doc.querySelectorAll('[data-cv-count]').forEach(el=>{const value=formatCvCount(el.dataset.cvCount,lang);if(value!==null)el.textContent=value;});
    renderSecret(lang);
  }
  button?.addEventListener('pointerenter',event=>{if(['mouse','pen'].includes(event.pointerType))next();});
  button?.addEventListener('click',event=>{if(event.pointerType==='touch')next();else{binary=!binary;renderSecret();}});
  button?.addEventListener('keydown',event=>{if(['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();next(event.key==='ArrowLeft'?-1:1);}});
  win.addEventListener('corvus-language-change',event=>refresh(event.detail?.lang||getLang()));
  refresh();
}
if(typeof document!=='undefined'&&typeof window!=='undefined') {
  import('./i18n/language.js').then(({getLang})=>mountCvPage(document,window,getLang))
    .catch(()=>mountCvPage(document,window));
}
