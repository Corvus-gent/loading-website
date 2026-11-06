import {t,getLang} from './copy.js?v=20261106-earned1';
export const $=id=>document.getElementById(id);
export async function api(data,query=''){
 const response=await fetch('/api/army'+query,{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(18000),...(data?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}:{})});
 let body;try{body=await response.json();}catch{throw Error('resting');}if(!response.ok)throw Error(body.error||'resting');return body;
}
export function errorText(error){return t(['rate','unavailable_name_or_email','expired','resting','already_enlisted','login'].includes(error.message)?({already_enlisted:'already',login:'already'}[error.message]||error.message):'fields');}
const proofs=new Map();
export function prepare(action){
 const existing=proofs.get(action);if(existing&&Date.now()-existing.created<240000)return existing.promise;
 const entry={created:Date.now(),promise:null};
 entry.promise=(async()=>{const {challenge}=await api({action:'challenge',for:action});const nonce=await new Promise((resolve,reject)=>{
  const worker=new Worker('/js/music-proof.js');const timeout=setTimeout(()=>{worker.terminate();reject(Error('verification'));},90000);
  const stop=()=>{clearTimeout(timeout);worker.terminate();};worker.onmessage=({data})=>{stop();data.error?reject(Error('verification')):resolve(data.nonce);};worker.onerror=()=>{stop();reject(Error('verification'));};worker.postMessage(challenge);
 });const wait=challenge.notBefore-Date.now()+80;if(wait>0)await new Promise(r=>setTimeout(r,wait));return {challenge:challenge.id,nonce};})();
 proofs.set(action,entry);entry.promise.catch(()=>{if(proofs.get(action)===entry)proofs.delete(action);});return entry.promise;
}
export async function submit(action,fields){try{const proof=await prepare(action);return await api({...fields,lang:getLang(),action,...proof});}finally{proofs.delete(action);}}
export function tidyFields(form){
 const name=form.querySelector('input[name="username"]'),link=form.querySelector('input[name="link"]');
 if(name)name.addEventListener('input',()=>{const v=name.value.replace(/^@+/,'').replace(/\s+/g,'_').replace(/[^a-zA-Z0-9_-]/g,'').toLowerCase().slice(0,24);if(v!==name.value)name.value=v;});
 if(link)link.addEventListener('blur',()=>{const v=link.value.trim();if(v&&!/^[a-z][a-z0-9+.-]*:\/\//i.test(v))link.value='https://'+v.replace(/^\/+/,'');});
}
export function wireForm(form,action,done,status){
 tidyFields(form);
 form.addEventListener('focusin',()=>prepare(action).catch(()=>{}),{once:true});
 form.addEventListener('submit',async e=>{e.preventDefault();if(!form.reportValidity())return;const button=form.querySelector('button[type="submit"],button:not([type])');button.disabled=true;status.textContent=t('proof');
  try{const result=await submit(action,Object.fromEntries(new FormData(form)));await done(result);}
  catch(error){status.textContent=errorText(error);}finally{button.disabled=false;}
 });
}
export const recruitURL=code=>'https://corvus.gent/r/'+code;
export async function share(code,status){const url=recruitURL(code);try{if(navigator.share)await navigator.share({title:'corvus',text:t('shareTag').replace(' ↗',''),url});else{await navigator.clipboard.writeText(url);status.textContent=t('copied');}}catch(error){if(error.name!=='AbortError'){status.textContent=url;}}}
export async function copy(code,status){try{await navigator.clipboard.writeText(recruitURL(code));status.textContent=t('copied');}catch{status.textContent=recruitURL(code);}}
export function saveBlob(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export async function tag(container,s,code){const {tagSVG}=await import('./art.js?v=20261106-earned1');container.innerHTML=tagSVG(s,code);}
export async function saveArt(s,code,poster,status){try{const {downloadArt}=await import('./art.js?v=20261106-earned1');saveBlob(await downloadArt(s,code,poster),poster?'corvus-recruit-poster.png':'corvus-dog-tag.png');}catch{status.textContent=t('resting');}}
export function countryOptions(select,value=''){
 import('./countries.js?v=20261106-earned1').then(({CURRENCIES})=>{const names=new Intl.DisplayNames([getLang()],{type:'region'});select.replaceChildren(new Option(t('notGiven'),''),...Object.keys(CURRENCIES).map(code=>({code,name:names.of(code)})).sort((a,b)=>a.name.localeCompare(b.name,getLang())).map(({code,name})=>new Option(name,code)));select.value=value;});
}
export async function rankMoment(previous,s){
 if(!previous||previous===s.rank)return;
 const {insignia}=await import('./art.js?v=20261106-earned1'),box=document.createElement('aside');box.className='army-rank-toast';box.setAttribute('role','status');box.innerHTML=insignia(s.rank);const text=document.createElement('span');text.textContent=t('rankUp')+' '+s.rank;box.append(text);document.body.append(box);setTimeout(()=>box.remove(),6000);
}
