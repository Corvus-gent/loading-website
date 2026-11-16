import {api} from './api.js?v=20261109ia2';
const b=document.getElementById('letter-action'),s=document.getElementById('letter-status'),token=new URLSearchParams(location.search).get('token');
b.onclick=async()=>{
 b.disabled=true;
 try{
  const d=await api({action:b.dataset.action,token});s.textContent=d.message;
  if(b.dataset.action==='confirm'){
   document.querySelector('main h1').textContent='You’re confirmed.';
   document.querySelector('main .site-lead').textContent='Your email-only field notes are open on this browser.';
   s.textContent+=' Expect occasional Corvus updates; unsubscribe from any email.';
   const next=document.createElement('a');next.id='letter-next';next.className='site-button';next.href='/wiki/corvus/namesakes/';next.textContent='Read the next field note →';
   const step=document.createElement('p');step.append(next);s.after(step);
  }
  b.hidden=true;history.replaceState(null,'',location.pathname);
 }catch(e){s.textContent=e.message;b.disabled=false;}
};
