import {validateSuggestion,SUGGESTION_LIFETIME} from '../js/dontpay-shared.js';
const STORAGE='corvus.dontpay.pending.v1';
export function readPending(storage,now=Date.now()){
 try{const raw=JSON.parse(storage.getItem(STORAGE)||'[]');if(!Array.isArray(raw))return[];
  return raw.slice(0,10).flatMap(item=>{try{if(!Number.isFinite(item.savedAt)||item.savedAt>now||now-item.savedAt>=SUGGESTION_LIFETIME*1000)return[];return[{...validateSuggestion(item),savedAt:item.savedAt}];}catch{return[];}});
 }catch{return[];}
}
export function savePending(storage,value,now=Date.now()){
 const valid=validateSuggestion(value),rows=readPending(storage,now).filter(item=>item.id!==valid.id);
 if(rows.length>=10)throw Error('This device already has 10 saved suggestions. Retry or clear them first.');
 storage.setItem(STORAGE,JSON.stringify([...rows,{...valid,savedAt:now}]));
}
if(typeof document!=='undefined'){
 for(const button of document.querySelectorAll('[data-video]'))button.addEventListener('click',()=>{
  const src=button.dataset.video;
  if(!/^https:\/\/(?:www\.youtube-nocookie\.com\/embed\/[\w-]{11}|player\.vimeo\.com\/video\/\d+)$/.test(src||''))return;
  const iframe=document.createElement('iframe');iframe.src=src;iframe.title='I DON’T PAY episode video';iframe.allow='fullscreen; picture-in-picture';iframe.allowFullscreen=true;iframe.referrerPolicy='strict-origin-when-cross-origin';button.parentElement.replaceChildren(iframe);
 });
 const form=document.getElementById('spot-form');
 if(form){
  const status=document.getElementById('spot-status'),saveChoice=document.getElementById('save-choice'),panel=document.getElementById('saved-panel'),savedStatus=document.getElementById('saved-status'),retry=document.getElementById('retry-saved'),clear=document.getElementById('clear-saved');
  let pending=null,busy=false;
  const storage=()=>window.localStorage;
  function refresh(){let rows=[];try{rows=readPending(storage());storage().setItem(STORAGE,JSON.stringify(rows));}catch{}panel.hidden=!rows.length;document.getElementById('saved-count').textContent=`${rows.length} suggestion${rows.length===1?'':'s'} saved here, not yet confirmed as sent to Gabe.`;}
  async function send(value){
   const response=await fetch('/api/dontpay',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(value),signal:AbortSignal.timeout(10000)});
   let result;try{result=await response.json();}catch{throw Error('Connection interrupted. No delivery confirmation.');}
   if(!response.ok){const error=Error(result.error||'Not sent. Please try again.');error.canSave=response.status===429||response.status>=500;throw error;}
   if(result.ok!==true)throw Error('No delivery confirmation.');return result;
  }
  form.addEventListener('input',()=>{pending=null;saveChoice.hidden=true;});
  form.addEventListener('submit',async event=>{
   event.preventDefault();if(busy||!form.reportValidity())return;
   const fd=new FormData(form);let value;
   try{value=validateSuggestion({...Object.fromEntries(fd),id:pending?.id||crypto.randomUUID(),consent:fd.get('consent')==='on'});}catch(error){status.textContent=error.message;return;}
   pending=value;busy=true;form.querySelectorAll('input,textarea,button').forEach(el=>el.disabled=true);saveChoice.hidden=true;status.textContent='Sending the suggestion…';
   try{await send(value);status.textContent='Sent privately to Gabe. Thank you — one more counter to discover.';form.reset();pending=null;}
   catch(error){status.textContent=error.message==='Failed to fetch'?'You’re offline or the connection failed. This has not been confirmed as sent.':error.message;saveChoice.hidden=error.canSave===false;}
   finally{busy=false;form.querySelectorAll('input,textarea,button').forEach(el=>el.disabled=false);}
  });
  document.getElementById('save-local').addEventListener('click',()=>{
   if(!pending)return;
   try{savePending(storage(),pending);status.textContent='Saved on this device only. Gabe has not received it. Use “Retry saved suggestions” when you’re ready.';form.reset();pending=null;saveChoice.hidden=true;refresh();}
   catch{status.textContent='This browser could not save it. Your text is still in the form; copy it somewhere safe or try sending again.';}
  });
  retry.addEventListener('click',async()=>{
   if(busy)return;busy=true;retry.disabled=true;clear.disabled=true;
   let sent=0;
   try{const rows=readPending(storage());for(const item of rows){await send(item);const remaining=readPending(storage()).filter(x=>x.id!==item.id);storage().setItem(STORAGE,JSON.stringify(remaining));sent++;}savedStatus.textContent=`${sent} saved suggestion${sent===1?'':'s'} sent to Gabe.`;status.textContent=savedStatus.textContent;}
   catch(error){savedStatus.textContent=`${sent} sent. Remaining suggestions stay on this device. ${error.message}`;}
   finally{busy=false;retry.disabled=false;clear.disabled=false;refresh();}
  });
  clear.addEventListener('click',()=>{try{storage().removeItem(STORAGE);savedStatus.textContent='Saved suggestions cleared from this device.';status.textContent=savedStatus.textContent;refresh();}catch{savedStatus.textContent='This browser could not clear storage.';}});
  refresh();
 }
}
