import {t} from './i18n.js?v=20261106-feathers1';
import {SF_LETS} from './sf-trip.js';
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const translated=(tag,key)=>{const n=el(tag,t(key));n.dataset.i18n=key;return n;};
const activityKey=value=>'sf.'+(value==='intro'?'introChip':value);
export function mountSFLeads(root,savedFunnel){
 root.className='st-sec sf-private';root.replaceChildren(el('h2','sf trip'));
 const status=el('p','loading…','sub');status.setAttribute('role','status');const funnel=el('dl',undefined,'sf-funnel'),table=el('div',undefined,'x-scroll'),pager=el('div',undefined,'x-pager');table.tabIndex=0;table.setAttribute('aria-label','sf trip leads, scroll horizontally');root.append(status,funnel,el('p','event counts, from optional analytics; not a person-by-person conversion rate. leads expire 60 days after submission.','sub'),table,pager);
 const filters=el('form',undefined,'sf-filters'),activityLabel=el('label'),activity=el('select'),thingLabel=el('label'),thing=el('input'),apply=translated('button','sf.filterApply');
 activity.name='activity';const all=translated('option','sf.allActivities');all.value='';activity.append(all);
 for(const value of SF_LETS){const option=translated('option',activityKey(value));option.value=value;activity.append(option);}
 thing.name='thing';thing.type='search';thing.maxLength=60;thing.placeholder=t('sf.filterThingHint');thing.dataset.i18nPlaceholder='sf.filterThingHint';
 activityLabel.append(translated('span','sf.filterActivity'),activity);thingLabel.append(translated('span','sf.filterThing'),thing);apply.type='submit';filters.append(activityLabel,thingLabel,apply);table.before(filters);
 let page=1,selectedActivity='',selectedThing='',request=0;
 filters.onsubmit=e=>{e.preventDefault();page=1;selectedActivity=activity.value;selectedThing=thing.value.trim();load();};
 async function action(body,button){button.disabled=true;try{const r=await fetch('/api/sf?private=1',{method:'PATCH',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await r.json();if(!r.ok||!data.ok)throw Error();await load();}catch{status.textContent='could not update. try again.';button.disabled=false;}}
 async function load(){const current=++request;try{
  const query=new URLSearchParams({private:'1',rowsOnly:'1',page,activity:selectedActivity,thing:selectedThing});
  const response=await fetch('/api/sf?'+query,{credentials:'same-origin',cache:'no-store'});if(!response.ok)throw Error();const data=await response.json();if(current!==request)return;page=data.page;status.textContent=`${data.total} leads · only gabriel@corvus.gent`;
  funnel.replaceChildren();for(const [key,label]of [['sf_note_seen','note seen'],['sf_note_open','opened'],['$pageview','/sf visits'],['sf_form_start','form started'],['sf_form_submit','submitted']]){const box=el('div');box.append(el('dt',label),el('dd',savedFunnel?String(savedFunnel[key]||0):'—'));funnel.append(box);}
  table.replaceChildren();const grid=el('table'),head=el('tr');const columns=['name','contact','thing','what','lets','when','where','message','date'];for(const c of [...columns,'done','email']){const th=c==='thing'?translated('th','sf.thing'):el('th',c==='lets'?"let’s":c);th.scope='col';head.append(th);}grid.append(head);
  for(const row of data.rows){const tr=el('tr');for(const key of columns){const cell=el('td');if(key==='lets'){row.lets.forEach((value,i)=>{if(i)cell.append(document.createTextNode(', '));cell.append(translated('span',activityKey(value)));});}else cell.textContent=Array.isArray(row[key])?row[key].join(', '):row[key]||'—';tr.append(cell);}const done=el('td'),label=el('label'),toggle=el('input');toggle.type='checkbox';toggle.checked=row.done;toggle.setAttribute('aria-label',`mark ${row.name} done`);toggle.onchange=()=>action({id:row.id,done:toggle.checked},toggle);label.append(toggle,document.createTextNode(' done'));done.append(label);tr.append(done);const mail=el('td');if(row.notified)mail.textContent='sent';else{const retry=el('button','retry email');retry.type='button';retry.onclick=()=>action({action:'retry-mail',id:row.id},retry);mail.append(retry);}tr.append(mail);grid.append(tr);}table.append(grid);
  pager.replaceChildren();const prev=el('button','← previous leads'),next=el('button','next leads →');prev.disabled=data.page<=1;next.disabled=data.page>=data.pages;prev.onclick=()=>{page--;load();};next.onclick=()=>{page++;load();};pager.append(prev,el('span',`${data.page} / ${data.pages}`),next);
 }catch{if(current===request)status.textContent='sf leads unavailable. this section is only for gabe.';}}
 load();
}
