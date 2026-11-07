import {t,getLang} from './i18n.js?v=20261106-ranks1';
import {SF_END} from './sf-trip.js';
const KEY='sf-note:2026-11';
export function mountSFNote(){
 let flyer,dialog,delay,expiry;
 const capture=name=>window.posthog?.capture(name);
 function close(){if(dialog?.open)dialog.close();}
 function remove(){clearTimeout(delay);clearTimeout(expiry);flyer?.remove();close();dialog?.remove();}
 function labels(){if(flyer)flyer.setAttribute('aria-label',t('sf.noteLabel'));if(dialog){dialog.querySelector('h2').textContent=t('sf.noteTitle');dialog.querySelector('p').textContent=t('sf.noteBody');const a=dialog.querySelector('a');a.textContent=t('sf.meet');a.href='/sf/?lang='+getLang();dialog.querySelector('button').setAttribute('aria-label',t('sf.close'));}}
 function boundary(){if(Date.now()>=SF_END){remove();return;}clearTimeout(expiry);expiry=setTimeout(boundary,Math.min(SF_END-Date.now(),2147483647));}
 function show(){
  if(Date.now()>=SF_END)return;try{if(sessionStorage.getItem(KEY))return;sessionStorage.setItem(KEY,'1');}catch{}
  const hero=document.getElementById('hero'),rect=hero.getBoundingClientRect();
  flyer=document.createElement('button');flyer.type='button';flyer.className='sf-flyer';flyer.style.setProperty('--sf-y',Math.max(48,rect.top+rect.height*.12)+'px');flyer.style.setProperty('--sf-x',Math.max(12,Math.min(innerWidth-136,rect.left+rect.width*.1))+'px');
  const img=document.createElement('img');img.src='/img/sf-crow.svg';img.alt='';img.width=124;img.height=92;flyer.append(img);
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(reduced)flyer.classList.add('resting');else flyer.addEventListener('animationend',()=>flyer.remove(),{once:true});
  flyer.onclick=()=>{
   if(Date.now()>=SF_END){remove();return;}
   flyer.remove();dialog=document.createElement('dialog');dialog.className='sf-note-card';dialog.setAttribute('aria-labelledby','sf-note-title');
   const bird=img.cloneNode(),h=document.createElement('h2'),p=document.createElement('p'),a=document.createElement('a'),button=document.createElement('button');h.id='sf-note-title';button.type='button';button.className='sf-note-close';button.textContent='×';button.onclick=close;
   a.onclick=()=>capture('sf_note_click');dialog.append(bird,h,p,a,button);dialog.addEventListener('click',e=>{const box=dialog.getBoundingClientRect();if(e.target===dialog&&(e.clientX<box.left||e.clientX>box.right||e.clientY<box.top||e.clientY>box.bottom))close();});
   const entry=document.querySelector('.realm-enter').getBoundingClientRect();
   const above=Math.max(0,entry.top-24),below=Math.max(0,innerHeight-entry.bottom-24);
   dialog.style.top=(above>=below?12:entry.bottom+12)+'px';dialog.style.maxHeight=Math.max(above,below)+'px';
   document.body.append(dialog);labels();dialog.showModal();capture('sf_note_open');
  };
  document.body.append(flyer);labels();capture('sf_note_seen');boundary();
 }
 function visible(){if(Date.now()>=SF_END)remove();}
 document.addEventListener('visibilitychange',visible);window.addEventListener('pagehide',remove,{once:true});
 if(Date.now()<SF_END){if(document.readyState==='complete')delay=setTimeout(show,3000);else window.addEventListener('load',()=>{delay=setTimeout(show,3000);},{once:true});}
 return labels;
}
