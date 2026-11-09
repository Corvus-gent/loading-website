import {api} from './api.js?v=20261109ia1';
const b=document.getElementById('letter-action'),s=document.getElementById('letter-status'),token=new URLSearchParams(location.search).get('token');
b.onclick=async()=>{b.disabled=true;try{const d=await api({action:b.dataset.action,token});s.textContent=d.message;b.hidden=true;history.replaceState(null,'',location.pathname);}catch(e){s.textContent=e.message;b.disabled=false;}};
