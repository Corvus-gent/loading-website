const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
export function mountXLog(root){
 root.replaceChildren(el('h2','x log'));const form=el('form');form.className='x-filters';
 const date=el('input');date.type='date';date.name='date';const voice=el('select');voice.name='voice';voice.append(new Option('all voices',''));const region=el('select');region.name='region';for(const [name,value]of [['all regions',''],['eu','eu'],['sf','sf']])region.append(new Option(name,value));
 for(const [title,control]of [['date',date],['voice',voice],['region',region]]){const label=el('label',title);control.setAttribute('aria-label',title);label.append(control);form.append(label);}
 const filter=el('button','filter');filter.type='submit';const sync=el('button','sync now');sync.type='button';form.append(filter,sync);root.append(form);
 const status=el('p','loading the private log…');status.className='sub';status.setAttribute('role','status');const body=el('div'),pager=el('div');pager.className='x-pager';root.append(status,body,pager);let page=1,generation=0;
 async function load(){
  const own=++generation;filter.disabled=true;
  try{
   const query=new URLSearchParams({private:'1',date:date.value,voice:voice.value,region:region.value,page:String(page)});
   const response=await fetch(`/api/x-stats?${query}`,{credentials:'same-origin',cache:'no-store'});
   if(!response.ok)throw Error(response.status===401?'session expired. log in again.':'the private log is unavailable.');
   const data=await response.json();if(own!==generation)return;
   if(!data.ready){status.textContent='the log is empty for now. connect the Notion integration to begin.';body.replaceChildren();pager.replaceChildren();return;}
   const selected=voice.value;voice.replaceChildren(new Option('all voices',''));for(const name of data.voices||[])voice.append(new Option(name,name));voice.value=selected;
   status.textContent=`${data.total} rows · ${data.state==='syncing'?'syncing…':'latest saved log'}${data.error?' · '+data.error.replaceAll('_',' '):''}`;
   body.replaceChildren();pager.replaceChildren();if(!data.rows.length){body.append(el('p','no rows match.'));return;}
   const wrap=el('div');wrap.className='x-scroll';wrap.tabIndex=0;wrap.setAttribute('aria-label','full private X log, scroll horizontally');const t=el('table');t.className='x-private-table';const head=el('tr');const columns=['date','hour','region','type','voice','lane','campaign','target_url','my_url','text','link','link_type','clicks','clicks_pidgy','estimated','synced_at'];for(const c of columns){const th=el('th',c.replaceAll('_',' '));th.scope='col';head.append(th);}t.append(head);
   for(const row of data.rows){const tr=el('tr');for(const c of columns){const td=el('td');if(c==='text')td.className='x-text';const value=row[c];if(['target_url','my_url','link'].includes(c)&&/^https?:\/\//.test(value||'')){const a=el('a',value);a.href=value;a.target='_blank';a.rel='noopener noreferrer';td.append(a);}else td.textContent=c==='estimated'?(value?'estimate':'—'):typeof value==='number'?new Intl.NumberFormat('en',{maximumFractionDigits:2}).format(value):value??'—';tr.append(td);}t.append(tr);}wrap.append(t);body.append(wrap);
   const previous=el('button','← previous'),next=el('button','next →');previous.disabled=data.page<=1;next.disabled=data.page>=data.pages;previous.onclick=()=>{page--;load();};next.onclick=()=>{page++;load();};pager.append(previous,el('span',`${data.page} / ${data.pages}`),next);
  }catch(e){if(own===generation){status.textContent=e.message;body.replaceChildren();pager.replaceChildren();}}
  finally{if(own===generation)filter.disabled=false;}
 }
 form.onsubmit=e=>{e.preventDefault();page=1;load();};
 sync.onclick=async()=>{sync.disabled=true;try{const r=await fetch('/api/x-stats',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:'{}'});if(!r.ok)throw Error(r.status===401?'session expired. log in again.':'sync could not start.');const data=await r.json();if(!data.ready)status.textContent='connect the Notion integration first.';else if(data.state==='cooldown')status.textContent=`next sync in ${Math.ceil(data.retryAfter/60)} min. no duplicate job started.`;else if(data.state==='unavailable')status.textContent='sync paused after a provider error. retry shortly.';else status.textContent='sync running in the background. use filter to refresh the table.';}catch(e){status.textContent=e.message;}finally{sync.disabled=false;}};
 load();
}
