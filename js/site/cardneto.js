import {api} from './api.js?v=20261109ia1';
const counter=document.getElementById('cardneto-count');async function refresh(){try{const d=await api(null,'?action=partners');counter.textContent=d.total.toLocaleString()+' people tapped Dorian’s card';}catch{counter.textContent='The counter is reconnecting. The card still works.';}}refresh();setInterval(()=>{if(!document.hidden)refresh();},30000);
