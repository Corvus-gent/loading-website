import {PRIVACY_VERSION} from './privacy-strings.js';
const KEY='analytics-consent', LIFE=180*86400000;
let memory=null,timer;
export const privacySignal=()=>navigator.globalPrivacyControl===true||navigator.doNotTrack==='1';
export function consentChoice(){
 let saved=memory;
 try {if(!saved){const raw=localStorage.getItem(KEY);saved=raw?JSON.parse(raw):null;}}catch{}
 if(!saved||saved.version!==PRIVACY_VERSION||!['allow','deny'].includes(saved.choice)||!Number.isFinite(saved.expires)||saved.expires<=Date.now()||saved.expires>Date.now()+LIFE+1000)return null;
 return saved;
}
export const analyticsAllowed=()=>!privacySignal()&&consentChoice()?.choice==='allow';
function changed(){
 clearTimeout(timer);
 const saved=consentChoice();
 if(saved)timer=setTimeout(changed,Math.min(saved.expires-Date.now()+1,2147483647));
 window.dispatchEvent(new Event('analytics-consent-change'));
}
export function chooseAnalytics(choice){
 if(!['allow','deny'].includes(choice))return;
 memory={choice,version:PRIVACY_VERSION,expires:Date.now()+LIFE};
 try{localStorage.setItem(KEY,JSON.stringify(memory));localStorage.removeItem('privacy-notice');}catch{if(choice==='deny')try{localStorage.removeItem(KEY);}catch{}}
 changed();
}
window.addEventListener('storage',e=>{if(e.key===KEY||e.key===null){memory=null;changed();}});
changed();
