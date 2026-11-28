const url='/api/logo-lab?trial=main-logo';
const labels={a:'A · Coil',b:'B · Handle',c:'C · Wing'};
const status=document.getElementById('status');
const choices=document.getElementById('choices');
const keys=Object.keys(labels);
for(const k of keys){
 const card=document.createElement('article');
 card.innerHTML='<figure><img src="'+(k==='c'?'/assets/brand/wing-still-uuc36xs2.png':k+'.svg')+'" alt="'+labels[k]+'"></figure><h3>'+labels[k]+'</h3><button type="button">Pick '+k.toUpperCase()+'</button>';
 card.dataset.choice=k;
 card.querySelector('button').setAttribute('aria-pressed','false');
 card.querySelector('button').onclick=()=>vote(k);
 choices.append(card);
}
function markPicked(saved){for(const card of choices.children){const picked=card.dataset.choice===saved;card.classList.toggle('is-picked',picked);const button=card.querySelector('button');button.setAttribute('aria-pressed',String(picked));button.textContent=picked?'Picked '+saved.toUpperCase()+' ✓':'Pick '+card.dataset.choice.toUpperCase();}}
function disable(value){choices.querySelectorAll('button').forEach(b=>b.disabled=value);}
async function vote(choice){
 disable(true);
 try{
 let id=localStorage.getItem('corvus-main-logo-id');
 if(!id){id=crypto.randomUUID();localStorage.setItem('corvus-main-logo-id',id);}
 const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,choice})});
 if(!r.ok)throw Error();
 const {saved}=await r.json();
 status.textContent='Your vote: '+labels[saved]+'. Thanks!';
 localStorage.setItem('corvus-main-logo-choice',saved);
 markPicked(saved);
 results();
 }catch{disable(false);status.textContent='Could not save your vote. Try again.';}
}
async function results(){
 const el=document.getElementById('results'),total=document.getElementById('vote-total'),note=document.getElementById('vote-total-note');
 try{
  const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw Error();
  const v=await r.json();
  if(!Array.isArray(v)||v.length!==3||!v.every(n=>Number.isSafeInteger(n)&&n>=0))throw Error();
  const count=v.reduce((sum,n)=>sum+n,0),formatted=count.toLocaleString('en');
  el.textContent=keys.map((k,i)=>labels[k]+' — '+v[i]).join('　/　');
  if(total.textContent!==formatted){total.textContent=formatted;total.classList.remove('count-updated');void total.offsetWidth;total.classList.add('count-updated');}
  note.textContent='across Coil, Handle & Wing · updated just now';
 }catch{el.textContent='Results temporarily unavailable.';note.textContent=total.textContent==='…'?'Vote count unavailable. Tap to retry.':'Last loaded vote count · tap to refresh.';if(total.textContent==='…')total.textContent='—';}
}
document.getElementById('vote-total-trigger').addEventListener('click',results);
results();

document.querySelector('details').ontoggle=results;
document.getElementById('flight').ontoggle=e=>{const img=document.getElementById('motion');if(e.target.open)img.src='wing-flight.gif';else img.removeAttribute('src');};
try{const saved=localStorage.getItem('corvus-main-logo-choice');if(labels[saved]){markPicked(saved);disable(true);status.textContent='Your vote: '+labels[saved]+'. Thanks!';}}catch{}
