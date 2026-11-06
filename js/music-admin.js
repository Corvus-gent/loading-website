import {initI18n,t} from './i18n.js?v=20261106-ranks1';
import {$,esc,label,genres,request} from './music-shared.js';
let state={tracks:[],suggestions:[],revision:null},dirty=false,busy=false,email='',editing=null,sortable=null;
const msg=text=>{$('notice').textContent=text || '';};
const options=chosen=>genres.map(genre=>`<option value="${esc(genre)}" ${chosen===genre?'selected':''}>${esc(genre)}</option>`).join('');
for(const id of ['add-genre','edit-genre'])$(id).innerHTML=options('');
function markDirty() {dirty=true;$('save-order').disabled=false;$('order-status').textContent=t('m.unsaved');numberRows();}
function numberRows() {document.querySelectorAll('#admin-tracks .track-rank').forEach((span,i)=>span.textContent=i+1);}
function render() {
  $('admin-tracks').innerHTML=state.tracks.map((track,index)=>`<li class="admin-row" data-id="${esc(track.id)}"><button type="button" class="drag-handle" aria-label="${label('m.drag')} · ${esc(track.title)}">⠿</button><span class="track-rank">${index+1}</span><div><strong>${esc(track.title)}</strong><small>${esc(track.artist || t('m.unknown'))} · ${esc(track.genre||'')}${track.needsReview?` · ${label('m.review')}`:''}</small></div><div class="row-actions"><button type="button" data-up="${esc(track.id)}" aria-label="${label('m.moveUp')}">↑</button><button type="button" data-down="${esc(track.id)}" aria-label="${label('m.moveDown')}">↓</button><button type="button" data-edit="${esc(track.id)}">${label('m.edit')}</button><button type="button" data-remove="${esc(track.id)}">${label('m.remove')}</button></div></li>`).join('');
  $('admin-suggestions').innerHTML=state.suggestions.length?state.suggestions.map(track=>`<li class="admin-row" data-suggestion="${esc(track.id)}"><span>♪</span><span></span><div>${esc(track.title)}<small>${esc(track.artist)}</small><div class="admin-add"><select aria-label="${label('m.genre')}">${options('')}</select><input class="position-input" type="number" min="1" max="${state.tracks.length+1}" value="${state.tracks.length+1}" aria-label="${label('m.position')}"></div></div><div class="row-actions"><button type="button" data-promote="${esc(track.id)}">${label('m.add')}</button><button type="button" data-dismiss="${esc(track.id)}">${label('m.dismiss')}</button></div></li>`).join(''):`<li class="empty">${label('music.empty')}</li>`;
  $('add-position').max=state.tracks.length+1;
  $('save-order').disabled=!dirty||busy;
  sortable?.destroy();
  if(window.Sortable)sortable=new window.Sortable($('admin-tracks'),{handle:'.drag-handle',animation:150,ghostClass:'sortable-ghost',onEnd:markDirty,disabled:busy});
  else msg(t('m.error'));
}
async function load() {
  try {state=await request('/api/music-admin');dirty=false;$('order-status').textContent='';$('login').hidden=true;$('admin').hidden=false;$('logout').hidden=false;render();}
  catch(error){
    if(error.status===401){$('login').hidden=false;$('admin').hidden=true;}
    else if(error.status===403){$('login').hidden=true;$('admin').hidden=true;$('logout').hidden=false;msg(t('m.forbidden'));}
    else msg(error.message);
  }
}
function setBusy(value) {
  busy=value;sortable?.option('disabled',value);
  document.querySelectorAll('#admin button,#admin input,#admin select,#edit-form button,#edit-form input,#edit-form textarea,#edit-form select').forEach(el=>el.disabled=value);
  if(!value)$('save-order').disabled=!dirty;
}
async function saveOrder() {
  if(!dirty)return;
  state=await request('/api/music-admin',{action:'order',ids:Array.from($('admin-tracks').children,li=>li.dataset.id),revision:state.revision});
  dirty=false;$('order-status').textContent='';
}
async function mutate(body) {
  if(busy)return false;
  setBusy(true);msg(t('m.working'));
  try {
    await saveOrder();
    if(body)state=await request('/api/music-admin',{...body,revision:state.revision});
    dirty=false;render();msg(t('m.saved'));return true;
  } catch(error){msg(error.message);$('edit-error').textContent=error.message;return false;}
  finally{setBusy(false);}
}
$('save-order').onclick=()=>mutate(null);
$('reload').onclick=async()=>{if(dirty && !confirm(t('m.unsaved')))return;msg('');await load();};
$('add-track').onsubmit=async event=>{event.preventDefault();if(await mutate({action:'add',url:$('add-url').value,genre:$('add-genre').value,position:Number($('add-position').value)}))$('add-url').value='';};
$('admin').addEventListener('click',async event=>{
  const button=event.target.closest('button');if(!button||busy)return;
  const d=button.dataset;
  if(d.up||d.down) {
    const row=button.closest('.admin-row'),other=d.up?row.previousElementSibling:row.nextElementSibling;
    if(other){d.up?other.before(row):other.after(row);markDirty();}
  }
  if(d.edit){
    const track=state.tracks.find(track=>track.id===d.edit);editing=track.id;
    for(const field of ['title','artist','genre','note'])$('edit-form').elements[field].value=track[field] || '';
    $('edit-form').elements.link.value='';$('edit-error').textContent='';$('edit-dialog').showModal();
  }
  if(d.remove&&confirm(t('m.confirmRemove')))await mutate({action:'remove',id:d.remove});
  if(d.dismiss)await mutate({action:'dismiss',id:d.dismiss});
  if(d.promote){const row=button.closest('.admin-row');await mutate({action:'promote',id:d.promote,genre:row.querySelector('select').value,position:Number(row.querySelector('input').value)});}
});
$('edit-form').onsubmit=async event=>{
  event.preventDefault();const f=event.target.elements;
  if(await mutate({action:'update',id:editing,title:f.title.value,artist:f.artist.value,genre:f.genre.value,note:f.note.value,link:f.link.value}))$('edit-dialog').close();
};
$('cancel-edit').onclick=()=>$('edit-dialog').close();
$('login-email').onsubmit=async event=>{
  event.preventDefault();email=$('email').value.trim().toLowerCase();
  if(email!=='gabriel@corvus.gent'){msg(t('m.forbidden'));return;}
  const button=event.submitter;button.disabled=true;
  try {await request('/api/auth',{action:'request',email});$('login-email').hidden=true;$('login-code').hidden=false;$('resend').hidden=false;msg(t('m.codeSent'));$('code').focus();}catch{msg(t('m.loginError'));}finally{button.disabled=false;}
};
$('login-code').onsubmit=async event=>{
  event.preventDefault();const button=event.submitter;button.disabled=true;
  try{await request('/api/auth',{action:'verify',email,code:$('code').value});msg('');await load();}catch{msg(t('m.loginError'));}finally{button.disabled=false;}
};
$('resend').onclick=()=>{$('login-email').hidden=false;$('login-code').hidden=true;$('resend').hidden=true;$('code').value='';};
$('logout').onclick=async()=>{try{await request('/api/auth',{action:'logout'});location.reload();}catch{msg(t('m.error'));}};
window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
initI18n(()=>{if(!$('admin').hidden){if(dirty){state.tracks=Array.from($('admin-tracks').children,li=>state.tracks.find(t=>t.id===li.dataset.id));}render();}});
await load();
