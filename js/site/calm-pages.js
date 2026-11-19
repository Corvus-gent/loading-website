import {t} from '../i18n/language.js';
// Small layout enhancements; the original links remain usable without JavaScript.
const path=location.pathname.replace(/\/+$/,'');
const kind=location.hostname==='stats.corvus.gent'?null:path==='/map'?'map':path==='/quests'?'quests':/^\/support\/(people|founders|sport-people)$/.test(path)?'people':null;
const main=document.querySelector('main');
if(kind && main){
  document.body.classList.add('calm-page','calm-'+kind);
  const css=document.createElement('link');css.rel='stylesheet';css.href='/css/site/calm-pages.css?v=20261113calm2';document.head.append(css);
  if(kind==='people'){
    const back=main.querySelector('a[data-i18n="support.back"]');
    if(back){back.classList.add('site-button');back.parentElement.classList.add('calm-primary');main.querySelector('h1')?.after(back.parentElement);}
  }
  if(kind==='quests'){
    const grid=main.querySelector('.site-grid');
    if(grid && grid.children.length>3){
      const more=document.createElement('details'),summary=document.createElement('summary'),list=document.createElement('div');
      more.className='calm-more';list.className='site-grid';
      for(const [key,text]of[['realm.more','more: '],['chrome.quests','Quests']]){const span=document.createElement('span');span.dataset.i18n=key;const copy=t(key);span.textContent=copy===key?text:copy;summary.append(span);}
      while(grid.children.length>3)list.append(grid.children[3]);
      more.append(summary,list);grid.after(more);
    }
  }
  if(kind==='map'){
    const root=main.querySelector('[data-full-directory]'),input=main.querySelector('[data-directory-filter]');
    const groups=[];
    for(const section of root?.children||[]){
      const heading=section.querySelector(':scope > h2');if(!heading)continue;
      const details=document.createElement('details'),summary=document.createElement('summary');
      details.className='calm-map-group';summary.append(heading);
      while(section.firstChild)details.append(section.firstChild);
      details.prepend(summary);section.append(details);groups.push({section,details,open:false});
    }
    let searching=false;
    const reveal=()=>{
      const active=!!input?.value.trim();
      for(const group of groups){
        if(active){if(!searching)group.open=group.details.open;const match=[...group.section.querySelectorAll('.site-directory a')].some(a=>!a.hidden);group.section.hidden=!match;group.details.open=match;}
        else{group.section.hidden=false;if(searching)group.details.open=group.open;}
      }
      searching=active;
    };
    root?.addEventListener('corvus-directory-filtered',reveal);reveal();
    // Existing fragment links open their section rather than landing on a closed group.
    const revealHash=()=>{const target=document.getElementById(location.hash.slice(1));for(const group of groups)if(target&&(target===group.section||group.section.contains(target)))group.details.open=true;};
    revealHash();addEventListener('hashchange',revealHash);
  }
}
