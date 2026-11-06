import {PRIVACY_VERSION} from './privacy-strings.js';
const KEY='privacy-choice';
let memory=null;
export const privacySignal=()=>navigator.globalPrivacyControl===true||navigator.doNotTrack==='1'||window.doNotTrack==='1';
export function consentChoice(){
 if(memory)return memory;
 try{
  const saved=JSON.parse(localStorage.getItem(KEY)||'null');
  if(saved&&['allow','deny'].includes(saved.choice))return saved;
  // An earlier explicit refusal stays a refusal after this change.
  const old=JSON.parse(localStorage.getItem('analytics-consent')||'null');
  if(old?.choice==='deny'&&old.expires>Date.now())return {choice:'deny',legacy:true};
 }catch{}
 return null;
}
export const analyticsAllowed=()=>!privacySignal()&&consentChoice()?.choice!=='deny';
export const noticeDismissed=()=>{const s=consentChoice();return s?.choice==='deny'||s?.version===PRIVACY_VERSION;};
export function chooseAnalytics(choice){
 if(!['allow','deny'].includes(choice))return;
 const previous=consentChoice(),firstOK=choice==='allow'&&!previous?.soldier;
 memory={choice,version:PRIVACY_VERSION,soldier:!!previous?.soldier||firstOK};
 try{localStorage.setItem(KEY,JSON.stringify(memory));localStorage.removeItem('analytics-consent');localStorage.removeItem('privacy-notice');}catch{}
 window.dispatchEvent(new Event('analytics-consent-change'));
 if(firstOK){
  const day=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Brussels'}).format(new Date());
  fetch('/api/notice-ok',{method:'POST',credentials:'omit',referrerPolicy:'no-referrer',keepalive:true,headers:{'Content-Type':'application/json'},body:JSON.stringify({day})}).catch(()=>{});
  window.dispatchEvent(new Event('notice-ok'));
 }
}
window.addEventListener('storage',e=>{if(e.key===KEY||e.key==='analytics-consent'||e.key===null){memory=null;window.dispatchEvent(new Event('analytics-consent-change'));}});
