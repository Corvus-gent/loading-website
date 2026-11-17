const url='/api/logo-lab?trial=main-logo';
const labels={a:'A · Coil',b:'B · Handle',c:'C · Wing'};
const status=document.getElementById('status');
const choices=document.getElementById('choices');
const keys=Object.keys(labels);
for(const k of keys){
 const card=document.createElement('article');
 card.innerHTML='<figure><img src="'+k+'.svg" alt="'+labels[k]+'"></figure><h3>'+labels[k]+'</h3><button type="button">Pick '+k.toUpperCase()+'</button>';
 card.querySelector('button').onclick=()=>vote(k);
 choices.append(card);
}
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
 results();
 }catch{disable(false);status.textContent='Could not save your vote. Try again.';}
}
async function results(){const el=document.getElementById('results');try{const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw Error();const v=await r.json();el.textContent=keys.map((k,i)=>labels[k]+' — '+v[i]).join('　/　');}catch{el.textContent='Results temporarily unavailable.';}}
document.querySelector('details').ontoggle=results;
document.getElementById('flight').ontoggle=e=>{const img=document.getElementById('motion');if(e.target.open)img.src='wing-flight.gif';else img.removeAttribute('src');};
try{const saved=localStorage.getItem('corvus-main-logo-choice');if(labels[saved]){disable(true);status.textContent='Your vote: '+labels[saved]+'. Thanks!';}}catch{}
