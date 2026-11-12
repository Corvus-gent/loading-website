import {arrivalSearch} from '/js/arrival.js';
const params=new URLSearchParams(arrivalSearch),source=['linkedin','x'].includes(params.get('utm_source'))?params.get('utm_source'):'direct';
const invitation=document.getElementById('support-roll');if(invitation)invitation.hidden=new URLSearchParams(location.search).get('from')!=='support';
for(const link of document.querySelectorAll('[data-support-step]')){const url=new URL(link.href);url.searchParams.set('source',source);link.href=url.pathname+url.search;}
const form=document.getElementById('call-request');
if(form){
 fetch('/api/support',{signal:AbortSignal.timeout(6000)}).then(r=>r.ok?r.json():null).then(c=>{if(c)document.querySelector('[data-support-spots]').textContent=`${c.spotsThisWeek}/${c.weeklyCapacity} spots this week`;}).catch(()=>{});
 const status=document.getElementById('call-form-status'),button=form.querySelector('[type=submit]'),tier=form.elements.tier,coffee=form.elements.coffeePaid;let proof=null,proofPromise=null,busy=false;const requestId=crypto.randomUUID();
 async function prepare(){if(proof&&Date.now()-proof.at<1500000)return proof;if(proofPromise)return proofPromise;proofPromise=(async()=>{const r=await fetch('/api/support',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'challenge'}),signal:AbortSignal.timeout(8000)}),d=await r.json();if(!r.ok)throw Error(d.error||'Please try again.');return proof={...d,at:Date.now()};})();try{return await proofPromise;}finally{proofPromise=null;}}
 function syncTier(){const paid=tier.value!=='quick';document.getElementById('call-coffee-step').hidden=!paid;coffee.required=paid;if(!paid)coffee.checked=false;}
 tier.onchange=syncTier;syncTier();form.addEventListener('focusin',()=>prepare().catch(()=>{}));
 document.querySelectorAll('[data-call-tier]').forEach(b=>b.onclick=()=>{tier.value=b.dataset.callTier;syncTier();prepare().catch(()=>{});document.getElementById('booking').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});});
 form.onsubmit=async e=>{e.preventDefault();if(busy||!form.reportValidity())return;busy=true;button.disabled=true;status.textContent='sending your headache…';
  try{const ch=await prepare();await new Promise(r=>setTimeout(r,Math.max(0,ch.notBefore-Date.now())));const values=Object.fromEntries(new FormData(form));const r=await fetch('/api/support',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...values,coffeePaid:coffee.checked,source,requestId,challenge:ch.token}),signal:AbortSignal.timeout(18000)}),d=await r.json();if(!r.ok||!d.ok)throw Error((d.error||'Please try again.')+(d.retryAfter?' Try again in '+d.retryAfter+' seconds.':''));form.hidden=true;document.getElementById('call-coffee-step').hidden=true;document.getElementById('call-success').hidden=false;document.getElementById('call-success').scrollIntoView({block:'nearest',behavior:'smooth'});
  }catch(e){status.textContent=e.name==='TimeoutError'?'The connection took too long. Retry safely; your request will not be duplicated.':e.message;}finally{busy=false;button.disabled=false;}};
}
