import {api,node} from './client.js?v=1';
const $=id=>document.getElementById(id);
async function load(){try{const data=await api(null,'?private=1&role=admin');$('login').hidden=true;$('private').hidden=false;$('version').replaceChildren(...data.versions.map(v=>{const o=node('option',v.id+' · '+v.label);o.value=v.id;return o;}));$('poll-form').querySelector('button').disabled=!data.versions.length;}catch(e){$('status').textContent=e.message;}}
$('login').onsubmit=async e=>{e.preventDefault();try{await api({action:'login',role:'admin',password:new FormData(e.target).get('password')});e.target.reset();$('status').textContent='unlocked.';await load();}catch(error){$('status').textContent=error.message;}};
$('poll-form').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);try{const result=await api({action:'live_poll',version:f.get('version'),q:f.get('q'),options:f.get('options').split('\n').map(s=>s.trim()).filter(Boolean)});$('status').textContent='live now: '+result.poll.q;}catch(error){$('status').textContent=error.message;}};
load();
