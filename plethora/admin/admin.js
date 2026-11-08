const $=id=>document.getElementById(id),url=new URL(location.href);
let key=url.searchParams.get('key')||'';
if(key){url.searchParams.delete('key');history.replaceState(null,'',url.pathname+url.search+url.hash);try{sessionStorage.setItem('plethora.admin',key);}catch{}}
else try{key=sessionStorage.getItem('plethora.admin')||'';}catch{}
async function refresh(){
 $('admin-status').textContent='Loading placement counts…';$('refresh').disabled=true;
 try{const r=await fetch('/api/plethora?action=admin',{credentials:'same-origin',headers:key?{Authorization:'Bearer '+key}:{},cache:'no-store',signal:AbortSignal.timeout(10000)});const data=await r.json();if(!r.ok)throw Error(data.error||'Could not load counts.');
 $('admin-login').hidden=true;$('admin-report').hidden=false;$('all-total').textContent=data.total.toLocaleString();$('day-total').textContent=data.last24h.toLocaleString();$('admin-updated').textContent='Updated '+new Date(data.updated).toLocaleString();
 const rows=data.rows.map(row=>{const tr=document.createElement('tr'),label=document.createElement('td'),name=document.createElement('span'),link=document.createElement('a'),small=document.createElement('small');name.textContent=row.label;link.href='/go/'+row.id;link.textContent='/go/'+row.id;small.append(link);label.append(name,small);tr.append(label);for(const value of [row.total,row.last24h]){const td=document.createElement('td');td.textContent=value.toLocaleString();tr.append(td);}return tr;});$('placement-rows').replaceChildren(...rows);$('admin-status').textContent='';
 }catch(e){$('admin-status').textContent=e.message;$('admin-login').hidden=false;}finally{$('refresh').disabled=false;}}
$('admin-login').onsubmit=e=>{e.preventDefault();key=$('access-key').value.trim();try{sessionStorage.setItem('plethora.admin',key);}catch{}$('access-key').value='';refresh();};$('refresh').onclick=refresh;refresh();
