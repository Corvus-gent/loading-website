import {SOCIALS} from './socials.js?v=20261108hacklive1';
const form=document.querySelector('#interview-form'),button=document.querySelector('#interview-send'),result=document.querySelector('#interview-result');
async function json(url,options={}){const r=await fetch(url,{...options,signal:AbortSignal.timeout(10000)});const d=await r.json();if(!r.ok)throw Error(d.error||'Please try again.');return d;}
function renderStatus(platforms){const live=Object.values(platforms).some(Boolean);document.querySelectorAll('[data-stream-status]').forEach(el=>{el.classList.toggle('is-live',live);el.querySelector('[data-status-text]').textContent=live?'live now':'next stream soon';});document.querySelectorAll('[data-platform-live]').forEach(el=>el.hidden=!platforms[el.dataset.platformLive]);}
const fallback=Object.fromEntries(SOCIALS.filter(s=>s.primary).map(s=>[s.platform,s.isLive]));renderStatus(fallback);
async function status(){if(document.hidden)return;try{const d=await json('/api/live?landing=1');renderStatus(d.platforms||fallback);}catch{renderStatus(fallback);}}
status();setInterval(status,60000);document.addEventListener('visibilitychange',status);
if(form){
 let ticket,pending;
 const challenge=()=>pending||(pending=json('/api/live?form=interview').then(d=>(ticket=d)).finally(()=>pending=null));
 button.disabled=false;form.addEventListener('focusin',()=>{if(!ticket)challenge().catch(()=>{});},{once:true});
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(!form.reportValidity())return;button.disabled=true;result.classList.remove('error');result.textContent='sending the crow…';
  try{
   if(!ticket||Date.now()-Number(ticket.token.split('.')[0])>1700000)await challenge();
   await new Promise(r=>setTimeout(r,Math.max(0,ticket.notBefore-Date.now()+100)));
   const data=Object.fromEntries(new FormData(form));await json('/api/live?form=interview',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({...data,token:ticket.token})});
   form.reset();result.textContent='Got it. You’re on the interview list. Find Gabe at the hackathon, or keep an eye on your DMs.';button.textContent='on the list ✓';
  }catch(error){result.classList.add('error');result.textContent=error.name==='TimeoutError'?'Taking too long. Please retry or DM Gabe above.':error.message;button.disabled=false;ticket=null;}
 });
}

document.addEventListener('click',e=>{const a=e.target.closest?.('[data-hack-track]');if(a)window.dispatchEvent(new CustomEvent('hack-action',{detail:{event:a.dataset.hackTrack,props:{hack_id:3,placement:a.dataset.placement||'plan'}}}));});
