const variants = {a:['Coil','The snake frames the whole lantern.'],b:['Handle','The snake forms the lamp handle.'],c:['Wing','The snake folds into the wing.']};
const $ = id => document.getElementById(id);
const api = '/api/logo-lab?trial=arcade';
async function send(payload) {
  const response = await fetch(api,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  if (!response.ok) throw Error('Vote service unavailable');
  return response.json();
}
async function audience() {
  let id = localStorage.getItem('corvus-arcade-trial-v1');
  if (!id) { id=crypto.randomUUID(); localStorage.setItem('corvus-arcade-trial-v1',id); }
  const bucket = parseInt(id.slice(0,8),16) % 3;
  const variant = Object.keys(variants)[bucket];
  const image = $('sprite');
  image.src=variant+'.svg'; await image.decode(); image.hidden=false;
  const state=await send({id,action:'show'});
  if(state.answered){$('status').textContent='Your response is already counted.';return;}
  $('controls').hidden=false;
  for(const button of $('controls').querySelectorAll('button')) button.onclick=async()=>{
    const buttons=Array.from($('controls').children);buttons.forEach(b=>b.disabled=true);
    try {await send({id,action:button.dataset.answer});$('controls').hidden=true;$('status').textContent='Response saved. Thank you.';}
    catch {$('status').textContent='Couldn’t save your response. Try again.';buttons.forEach(b=>b.disabled=false);}
  };
}
async function compare() {
  $('trial').hidden=true;$('review').hidden=false;
  document.querySelector('.grid').innerHTML=Object.entries(variants).map(([k,[name,caption]])=>'<article><figure><img src="'+k+'.svg" alt="'+caption+'"></figure><h3>'+k.toUpperCase()+' · '+name+'</h3><p>'+caption+'</p></article>').join('');
  const response=await fetch(api,{cache:'no-store'});if(!response.ok) throw Error();
  const rows=await response.json();
  document.querySelector('tbody').innerHTML=rows.map(({variant,shown,yes,no})=>'<tr><th>'+variant.toUpperCase()+'</th><td>'+shown+'</td><td>'+yes+'</td><td>'+no+'</td><td>'+(shown?Math.round(100*yes/shown)+'%':'—')+'</td></tr>').join('');
}
if(new URLSearchParams(location.search).get('view')==='compare') compare().catch(()=>$('metrics').textContent='Results temporarily unavailable.');
else audience().catch(()=>$('status').textContent='The test could not start. Reload to try again.');
