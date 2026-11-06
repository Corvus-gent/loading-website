import {tripState,SF_START,SF_END} from './sf-trip.js';
import {initI18n,t} from './i18n.js?v=20261106-knock1';initI18n();
const dialog=document.getElementById('realm-share'),message=document.getElementById('realm-share-message');
document.querySelector('[href="#realm-share"]').addEventListener('click',e=>{e.preventDefault();dialog.showModal();});
let redirect;
dialog.addEventListener('click',async e=>{const button=e.target.closest('[data-share]');if(!button)return;const gabe=button.dataset.share==='gabe',url=gabe?'https://corvus.gent/links/gabe/self':'https://corvus.gent/self';try{await navigator.clipboard.writeText(url);message.textContent=t('m.copied');}catch{message.textContent=url;}window.posthog?.capture('share_click',{what:button.dataset.share});if(gabe){clearTimeout(redirect);redirect=setTimeout(()=>location.assign('/links/gabe'),2000);}});

const sf=document.getElementById('sf-realm');let sfTimer;
function sfLink(){clearTimeout(sfTimer);const state=tripState();sf.hidden=state.phase!=='during';const boundary=state.phase==='before'?SF_START:state.phase==='during'?SF_END:0;if(boundary)sfTimer=setTimeout(sfLink,Math.min(2147483647,Math.max(0,boundary-Date.now())));}
sfLink();document.addEventListener('visibilitychange',sfLink);

import './realm-night.js?v=20261106-tour';
