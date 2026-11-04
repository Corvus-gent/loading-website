import {initI18n,t,getLang} from './i18n.js';
import {SF_END,SF_DAYS,SF_LETS,tripState} from './sf-trip.js';
const $=id=>document.getElementById(id),form=$('sf-form'),send=$('sf-send'),status=$('sf-status');
let busy=false,started=false,complete=false,coolUntil=0,proofRequest=null,requestId=crypto.randomUUID(),statusKey='',stateCopy='',attemptBody='',eventRows=[];
const text=(key,values={})=>Object.entries(values).reduce((s,[key,value])=>s.replace(`{${key}}`,value),t(key));
const capture=name=>window.posthog?.capture(name);
function message(key){statusKey=key;status.textContent=key?t(key):'';}
function clock(){
 const trip=tripState(),state=$('sf-state');
 const copy=trip.phase==='after'?t('sf.after'):text(trip.phase==='before'?'sf.lands':'sf.inSF',{n:trip.phase==='before'?trip.lands:trip.number});
 if(copy!==stateCopy){stateCopy=copy;state.replaceChildren();if(trip.phase==='after'){const a=document.createElement('a');a.href='/call/';a.textContent=copy;state.append(a);}else state.textContent=copy;}
 form.hidden=trip.phase==='after'||complete;
 const seconds=Math.max(0,Math.ceil((coolUntil-performance.now())/1000));send.disabled=busy||seconds>0||trip.phase==='after';
 send.textContent=t(busy?'sf.working':'sf.send');
 if(seconds>0&&!busy)status.textContent=text('sf.wait',{time:`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`});
 else if(!busy)status.textContent=statusKey?t(statusKey):'';
}
function chip(name,value,key,label){const wrap=document.createElement('label');wrap.className='sf-chip';const input=document.createElement('input');input.type='checkbox';input.name=name;input.value=value;const span=document.createElement('span');if(key)span.dataset.i18n=key;span.textContent=key?t(key):label;wrap.append(input,span);return wrap;}
for(const value of SF_LETS)$('sf-lets').append(chip('lets',value,'sf.'+(value==='intro'?'introChip':value)));
for(const date of SF_DAYS){const label=chip('when',date,null,date);label.querySelector('span').dataset.sfDate=date;$('sf-when').append(label);}
const anytime=chip('when','anytime','sf.anytime');anytime.querySelector('input').checked=true;$('sf-when').append(anytime);
$('sf-when').onchange=e=>{if(!e.target.checked)return;for(const other of $('sf-when').querySelectorAll('input'))if(other!==e.target&&(e.target.value==='anytime'||other.value==='anytime'))other.checked=false;};
function renderEvents(){const section=$('sf-events'),ul=section.querySelector('ul');ul.replaceChildren();for(const row of eventRows){const li=document.createElement('li'),time=document.createElement('time'),a=document.createElement('a');time.dateTime=row.date;time.textContent=new Intl.DateTimeFormat(getLang(),{dateStyle:'medium',timeZone:'UTC'}).format(new Date(row.date+'T12:00:00Z')).toLocaleLowerCase(getLang());a.textContent=row.name;a.href=row.url;a.rel='noopener noreferrer';li.append(time,a);ul.append(li);}section.hidden=!eventRows.length;}
function labels(){document.title=t('sf.formTitle')+' | corvus';for(const el of document.querySelectorAll('[data-sf-date]'))el.textContent=new Intl.DateTimeFormat(getLang(),{weekday:'short',day:'numeric',month:'short',timeZone:'UTC'}).format(new Date(el.dataset.sfDate+'T12:00:00Z')).toLocaleLowerCase(getLang());clock();renderEvents();}
initI18n(labels);labels();
setInterval(clock,1000);document.addEventListener('visibilitychange',clock);
setTimeout(clock,Math.min(2147483647,Math.max(0,SF_END-Date.now())));
async function request(body){const response=await fetch('/api/sf',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});let data;try{data=await response.json();}catch{throw {error:'unavailable'};}if(!response.ok)throw data;return data;}
function getChallenge(){
 if(!proofRequest)proofRequest=request({action:'challenge'}).then(data=>{if(data.retryAfter)coolUntil=performance.now()+data.retryAfter*1000;clock();return {...data.challenge,receivedAt:performance.now()};}).catch(e=>{proofRequest=null;throw e;});
 return proofRequest;
}
form.addEventListener('focusin',()=>{if(started)return;started=true;capture('sf_form_start');getChallenge().catch(()=>{});});
function solve(challenge){return new Promise((resolve,reject)=>{let worker;try{worker=new Worker('/js/music-proof.js');}catch{return reject({error:'verification'});}const timeout=setTimeout(()=>{worker.terminate();reject({error:'verification'});},120000);worker.onmessage=({data})=>{clearTimeout(timeout);worker.terminate();data.error?reject({error:'verification'}):resolve(data.nonce);};worker.onerror=()=>{clearTimeout(timeout);worker.terminate();reject({error:'verification'});};worker.postMessage(challenge);});}
const errors={invalid_contact:'sf.invalidContact',invalid_fields:'sf.invalidFields',verification:'sf.verification',unavailable:'sf.unavailable',trip_over:'sf.tripOver',forbidden:'sf.verification',rate_limited:'sf.wait'};
form.onsubmit=async e=>{
 e.preventDefault();if(busy||performance.now()<coolUntil)return;
 if(!form.reportValidity())return;
 const values=new FormData(form),body=Object.fromEntries(values);body.lets=values.getAll('lets');body.when=values.getAll('when');
 if(!body.lets.length||!body.when.length){message('sf.invalidFields');(body.lets.length?$('sf-when'):$('sf-lets')).querySelector('input').focus();return;}
 const fingerprint=JSON.stringify(body);if(attemptBody&&attemptBody!==fingerprint)requestId=crypto.randomUUID();attemptBody=fingerprint;
 busy=true;for(const field of form.querySelectorAll('input,textarea'))field.disabled=true;form.setAttribute('aria-busy','true');message('');clock();
 try{
  let challenge=await getChallenge();if(performance.now()-challenge.receivedAt>290000){proofRequest=null;challenge=await getChallenge();}
  const nonce=await solve(challenge),wait=3000-(performance.now()-challenge.receivedAt);if(wait>0)await new Promise(resolve=>setTimeout(resolve,wait));
  const result=await request({...body,requestId,challenge:challenge.id,nonce});
  if(!result.ok)throw {error:'unavailable'};
  complete=true;form.hidden=true;const success=$('sf-success');success.hidden=false;success.classList.add('sent');success.focus({preventScroll:true});capture('sf_form_submit');
  form.reset();requestId=crypto.randomUUID();
 }catch(error){
  if(error.retryAfter){coolUntil=performance.now()+error.retryAfter*1000;message('');}
  else message(errors[error.error]||'sf.error');
 }finally{proofRequest=null;busy=false;for(const field of form.querySelectorAll('input,textarea'))field.disabled=false;form.setAttribute('aria-busy','false');clock();}
};
fetch('/sf.json',{credentials:'omit'}).then(r=>r.ok?r.json():null).then(data=>{
 eventRows=(Array.isArray(data?.events)?data.events:[]).filter(row=>{try{const u=new URL(row.url);return /^2026-11-(0[6-9]|1[0-5])$/.test(row.date)&&typeof row.name==='string'&&row.name.length<=150&&['https:','http:'].includes(u.protocol)&&!u.username&&!u.password;}catch{return false;}}).slice(0,50);renderEvents();
}).catch(()=>{});
