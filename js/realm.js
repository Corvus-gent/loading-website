import {initI18n,t} from './i18n.js';initI18n();
const dialog=document.getElementById('realm-share'),message=document.getElementById('realm-share-message');
document.querySelector('[href="#realm-share"]').addEventListener('click',e=>{e.preventDefault();dialog.showModal();});
let redirect;
dialog.addEventListener('click',async e=>{const button=e.target.closest('[data-share]');if(!button)return;const gabe=button.dataset.share==='gabe',url=gabe?'https://corvus.gent/links/gabe/self':'https://corvus.gent/self';try{await navigator.clipboard.writeText(url);message.textContent=t('m.copied');}catch{message.textContent=url;}window.posthog?.capture('share_click',{what:button.dataset.share});if(gabe){clearTimeout(redirect);redirect=setTimeout(()=>location.assign('/links/gabe'),2000);}});
