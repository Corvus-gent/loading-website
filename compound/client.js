import {analyticsAllowed,privacySignal} from '/js/analytics-consent.js';
import {arrivalSearch} from '/js/arrival.js';
const KEY='compound-journey-v1',CHOICE='compound-journey-choice';
const storage={get:k=>{try{return localStorage.getItem(k);}catch{return null;}},set:(k,v)=>{try{localStorage.setItem(k,v);}catch{}},remove:k=>{try{localStorage.removeItem(k);}catch{}}};
const params=new URLSearchParams(arrivalSearch||location.search),source=params.get('utm_source')||'direct';
let referrer='';try{referrer=new URL(document.referrer).hostname;}catch{}
const first={source,medium:params.get('utm_medium')||'',campaign:params.get('utm_campaign')||'',content:params.get('utm_content')||'',term:params.get('utm_term')||'',referrer,landed:Date.now()};
let journey=null;
export const deepAllowed=()=>storage.get(CHOICE)==='yes'&&analyticsAllowed()&&!privacySignal();
export function setDeep(on){storage.set(CHOICE,on?'yes':'no');if(!on)storage.remove(KEY);journey=null;loadJourney();}
function loadJourney(){
 if(!deepAllowed()){storage.remove(KEY);journey=null;return;}
 try{const old=JSON.parse(storage.get(KEY)||'null');if(old&&old.expires>Date.now()&&/^[a-f0-9-]{36}$/.test(old.id))journey=old;}catch{}
 if(!journey){journey={id:crypto.randomUUID(),first,expires:Date.now()+90*86400000};storage.set(KEY,JSON.stringify(journey));}
}
loadJourney();window.addEventListener('analytics-consent-change',loadJourney);
export const handlePreference={get:()=>storage.get('compound-handle')||'',set:value=>value?storage.set('compound-handle',value):storage.remove('compound-handle')};
export const tags=()=>({attribution:journey?.first||first,analytics:!!journey,visitor:journey?.id||undefined});
export async function api(body,query=''){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
 try{const response=await fetch('/api/compound'+query,{method:body?'POST':'GET',credentials:'same-origin',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify({...tags(),...body}):undefined,signal:controller.signal,cache:body||query.includes('private=')?'no-store':'default'});const data=await response.json();if(!response.ok)throw Error(data.error||'the crow lost its connection. try again.');return data;}finally{clearTimeout(timer);}
}
export function beacon(body){const value=JSON.stringify({...tags(),...body});try{if(navigator.sendBeacon?.('/api/compound',new Blob([value],{type:'application/json'})))return;}catch{}fetch('/api/compound',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:value,keepalive:true}).catch(()=>{});}
export const node=(tag,text,className)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(className)e.className=className;return e;};
