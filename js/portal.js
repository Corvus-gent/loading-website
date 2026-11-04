import {readPreference,savePreference} from './storage.js';
const link=document.querySelector('.realm-enter');try{document.querySelector('.realm-skip').hidden=!readPreference('realm-entered');}catch{}
link.addEventListener('click',e=>{if(e.metaKey||e.ctrlKey||e.shiftKey)return;savePreference('realm-entered',true);if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;e.preventDefault();document.body.classList.add('entering');setTimeout(()=>location.assign(link.href),400);});
