import {api,beacon,node,deepAllowed,setDeep,handlePreference} from './client.js?v=20261108feedback1';
import {Cut} from './cuts.js?v=20261108feedback1';
const $=id=>document.getElementById(id),fundEnd=Date.parse('2026-11-08T07:30:00Z');
let state=null,active=1,selected='',loading=false,toastTimer,celebrated=false,viewSent=false,lastSlots='',reloading=false;
const battleVotes=new Set();let pickPool='';
function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,5000);}
function event(event,extra={}){beacon({action:'event',event,version:cuts[active-1]?.current?.id,...extra});}
const act=body=>api({version:cuts[active-1]?.current?.id,...body});
const cuts=[1,2,3].map(slot=>new Cut(slot,{toast,event,act,refresh,active:()=>active,activate,select:id=>{if(cuts[active-1]?.current?.id===id)selected=id;},watched:()=>{}}));
$('cuts').append(...cuts.map(c=>c.el));$('cut-tools').append(...cuts.map(c=>c.tools));
function activate(slot,scroll=false){active=slot;for(const c of cuts)c.tools.hidden=c.slot!==slot;for(const c of cuts){if(c.slot!==slot){c.video.pause();c.hidePoll();}c.transitionAt();}cuts[slot-1].prepare();selected=cuts[slot-1].current?.id||'';if(selected&&state&&!state.byVersion?.[selected])refresh();for(const b of document.querySelectorAll('[data-slot]')){b.classList.toggle('selected',Number(b.dataset.slot)===slot);b.setAttribute('aria-pressed',String(Number(b.dataset.slot)===slot));}syncQuick();if(scroll)cuts[slot-1].el.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'nearest',inline:'start'});}
for(const b of document.querySelectorAll('[data-slot]'))b.onclick=()=>activate(Number(b.dataset.slot),true);
const observer=new IntersectionObserver(entries=>{const visible=entries.filter(e=>e.isIntersecting&&e.intersectionRatio>.6).sort((a,b)=>b.intersectionRatio-a.intersectionRatio);if(visible.length)activate(Number(visible[0].target.dataset.cut));},{root:$('cuts'),threshold:[.6,.9]});cuts.forEach(c=>observer.observe(c.el));
function celebrate(){if(celebrated)return;celebrated=true;if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;for(let i=0;i<32;i++){const c=node('i',undefined,'confetti-piece');c.style.left=Math.random()*100+'%';c.style.setProperty('--drift',(Math.random()-.5)*250+'px');c.style.animationDelay=Math.random()*.6+'s';c.style.background=i%3===0?'#f35d62':'#ffd76a';$('confetti').append(c);setTimeout(()=>c.remove(),3400);}}
function fund(d){const value=d.total/100,hit=value>=40,expired=Date.now()>=fundEnd;$('fund-total').textContent=`€${value.toFixed(2)} / €40`;$('fund-bar').style.transform=`scaleX(${Math.min(1,value/40)})`;document.querySelector('.meter').setAttribute('aria-valuenow',Math.min(40,value));$('fund-result').textContent=hit?'Night extended. Army wins.':expired?`€${value.toFixed(2)} before the deadline. thank you.`:'one bed. one shower. one less questionable life choice.';if(hit)celebrate();$('donate').disabled=!d.ready;$('revolut').disabled=!d.revolut_url;$('payment-note').textContent=`${d.mode==='test'?'TEST MODE · Stripe is test money. Revolut is real. ':''}stripe auto · revolut confirmed by gabe${expired?' · after deadline: €'+(d.late/100).toFixed(2):''}`;}
function battles(){if(!state)return;const eligible=state.cuts.filter(c=>c.current),pool=state.cuts.map(c=>c.current?.id||'none').join('-');$('battle-note').textContent='one tap. trust your gut. no watch requirement.';
 $('pick-buttons').replaceChildren(...state.cuts.map(c=>{const b=node('button','V'+c.slot);b.disabled=!c.current||pickPool===pool;b.onclick=()=>choose(b,{action:'pick',winner:c.current.id},()=>pickPool=pool);return b;}));
 const pairs=[];for(let i=0;i<eligible.length;i++)for(let j=i+1;j<eligible.length;j++){const pair=[eligible[i],eligible[j]],id=pair.map(c=>c.current.id).sort().join('-');if(!battleVotes.has(id))pairs.push({pair,id});}
 $('pairwise').hidden=!pairs.length;if(pairs.length){const {pair,id}=pairs[0];$('battle-buttons').replaceChildren(...pair.map((c,i)=>{const b=node('button',`V${c.slot} wins →`,'button');b.onclick=()=>choose(b,{action:'battle',winner:c.current.id,opponent:pair[1-i].current.id},()=>battleVotes.add(id));return b;}));}
 const max=Math.max(1,...state.cuts.map(c=>(state.standings['pick:'+c.current?.id]||0)+(state.standings['battle:'+c.current?.id]||0)));$('standings').replaceChildren(...state.cuts.map(c=>{const picks=state.standings['pick:'+c.current?.id]||0,wins=state.standings['battle:'+c.current?.id]||0,row=node('div');row.append(node('span',`V${c.slot} · ${picks} picks · ${wins} battle wins`));const bar=node('i');bar.style.transform=`scaleX(${(picks+wins)/max})`;row.append(bar);return row;}));}
async function choose(b,body,done){b.disabled=true;try{await act(body);done();toast('verdict delivered.');await refresh();}catch(e){toast(e.message);b.disabled=false;}}
function render(d){state=d;fund(d.fund);const slots=d.cuts.map(c=>c.current?.id||'').join('-');if(lastSlots&&slots!==lastSlots)toast('NEW VERSION DROPPED · fresh cut in the selector.');lastSlots=slots;for(const c of cuts)c.update(d.cuts[c.slot-1],d.byVersion||{});selected=cuts[active-1]?.current?.id||'';cuts[active-1].prepare();document.documentElement.dataset.compoundReady='1';$('reload-cuts').hidden=true;$('connection').textContent='live · pick a cut. tell me what to change.';syncQuick();$('connection').classList.remove('error');$('helpers').replaceChildren(...(d.helpers.length?d.helpers.map(p=>{const li=node('li',p.handle);li.append(node('b',p.score+' pts'));return li;}):[node('li','first useful opinion gets the first spot.')]));battles();if(d.livePoll)cuts[active-1].showPoll(d.livePoll,(d.livePoll.expires-Date.now())/1000);if(!viewSent){viewSent=true;event('view');}}
async function refresh(){if(document.hidden)return;if(loading){reloading=true;return;}loading=true;try{render(await api(null,selected?'?version='+encodeURIComponent(selected):''));}catch(e){$('connection').textContent=state?'connection lost. last counts shown. tap to retry.':'could not load. tap here to retry.';$('connection').classList.add('error');$('reload-cuts').hidden=false;}finally{loading=false;if(reloading){reloading=false;setTimeout(refresh,0);}}}
const chips={hook:['🐌 hook too slow','The hook is too slow because '],memes:['😂 needs more memes','Add a meme where '],music:['🎵 music mid','The music should '],length:['✂️ too long','Cut the part where '],fire:["🔥 it's fire","It's fire because "],note:['✍️ editor note','']};
let draft={version:null,chip:'note',id:null},pendingNote=null,feedLoading=false,feedAgain=false;
function syncQuick(){
 const current=cuts[active-1]?.current;
 $('feedback-cut').textContent='· V'+active+(current?'':' · dropping soon');
 for(const button of document.querySelectorAll('[data-chip]')){button.disabled=!current||!!pendingNote;button.setAttribute('aria-pressed',String(draft.version===current?.id&&draft.chip===button.dataset.chip));}
 $('idea-form').querySelector('button').disabled=!current||!!pendingNote;
 if(draft.version!==current?.id){draft={version:current?.id||null,chip:'note',id:null};$('idea').value='';$('idea-status').textContent='';$('feedback-thanks').hidden=true;}
}
for(const button of document.querySelectorAll('[data-chip]'))button.onclick=async()=>{
 const version=cuts[active-1]?.current?.id;if(!version||pendingNote)return;
 const chip=button.dataset.chip;draft={version,chip,id:null};const context=draft;
 $('idea').value=chips[chip][1];$('idea').focus({preventScroll:true});$('idea').setSelectionRange($('idea').value.length,$('idea').value.length);
 $('idea-status').textContent='saving your tap…';
 pendingNote=api({action:'quick',version,chip,website:new FormData($('idea-form')).get('website')});syncQuick();
 try{const result=await pendingNote;if(draft===context){draft.id=result.id;$('idea-status').textContent='tap saved ✅ add the why if you want.';$('feedback-thanks').hidden=false;}await refreshFeed();}
 catch(e){if(draft===context)$('idea-status').textContent='not saved: '+e.message;}
 finally{pendingNote=null;syncQuick();}
};
$('idea-form').onsubmit=async e=>{
 e.preventDefault();const button=e.submitter,context={...draft},text=$('idea').value.trim();if(!context.version)return;
 button.disabled=true;
 try{
  const website=new FormData(e.target).get('website');
  if(!context.id){const result=await api({action:'quick',version:context.version,chip:context.chip,text,website});context.id=result.id;}
  await api({action:'note_text',version:context.version,id:context.id,text,website});
  if(draft.version===context.version){draft={version:context.version,chip:'note',id:null};$('idea').value='';$('idea-status').textContent='Noted ✅';$('feedback-thanks').hidden=false;}
  await Promise.all([refreshFeed(),refresh()]);
 }catch(error){$('idea-status').textContent='not saved: '+error.message;}finally{button.disabled=false;}
};
async function refreshFeed(){
 if(document.hidden)return;if(feedLoading){feedAgain=true;return;}feedLoading=true;
 try{const data=await api(null,'?feed=1');$('feed-retry').hidden=true;$('feed-notes').replaceChildren(...(data.feedback.length?data.feedback.map(note=>{
  const li=node('li'),label=chips[note.chip]?.[0]||'✍️ editor note',v=state?.versions.find(v=>v.id===note.version);
  li.append(node('strong',label),node('p',note.text||'one-tap feedback'),node('small',`${note.handle} · ${v?'V'+v.slot+' / r'+v.iteration:note.version}`));return li;
 }):[node('li','no notes yet. your gut reaction goes here.','muted')]));}
 catch{if(!$('feed-notes').querySelector('strong'))$('feed-notes').textContent='feedback is unavailable for a moment. your draft stays here.';$('feed-retry').hidden=false;}
 finally{feedLoading=false;if(feedAgain){feedAgain=false;await refreshFeed();}}
}
$('feed-retry').onclick=refreshFeed;
$('feedback-share').onclick=async()=>{const text='I just helped edit a €1000 video 🎬 https://corvus.gent/compound';try{if(navigator.share)await navigator.share({text});else{await navigator.clipboard.writeText(text);toast('Copied ✅');}event('share');}catch(e){if(e.name!=='AbortError')toast(text);}};
$('handle').value=handlePreference.get();$('handle-form').onsubmit=async e=>{e.preventDefault();try{const r=await act({action:'profile',handle:$('handle').value});handlePreference.set(r.handle);toast(r.handle?'handle saved. useful chaos gets credit.':'handle removed.');await Promise.all([refreshFeed(),refresh()]);}catch(error){toast(error.message);}};
for(const [id,method]of [['donate','stripe'],['revolut','revolut']])$(id).onclick=async()=>{const b=$(id),checkout=window.open('about:blank','_blank');if(checkout)checkout.opener=null;b.disabled=true;try{const r=await act({action:'donate',method});if(checkout&&!checkout.closed)checkout.location.replace(r.url);else location.assign(r.url);}catch(e){checkout?.close();toast(e.message);}finally{b.disabled=false;}};
$('army').onclick=()=>event('army_join');$('share').onclick=async()=>{const url='https://corvus.gent/compound?utm_source=share&utm_medium=social&utm_campaign=compound-1000',text='Help this one-man army win €1000. Watch it. Roast it. Make it better. #jointhearmy';try{if(navigator.share)await navigator.share({title:'Help Gabe win €1000',text,url});else{await navigator.clipboard.writeText(text+' '+url);toast('recruitment link copied.');}event('share');}catch(e){if(e.name!=='AbortError')toast('copy this: '+url);}};
$('deep-analytics').checked=deepAllowed();$('deep-analytics').onchange=()=>{setDeep($('deep-analytics').checked);$('deep-analytics').checked=deepAllowed();toast(deepAllowed()?'cross-visit tracking on. thank you.':'cross-visit tracking off.');};
$('connection').onclick=refresh;addEventListener('pagehide',()=>cuts.forEach(c=>c.dropoff()));document.addEventListener('visibilitychange',()=>{if(document.hidden)cuts.forEach(c=>c.dropoff());else{refresh();refreshFeed();}});
activate(1);refresh();refreshFeed();setInterval(refresh,30000);setInterval(refreshFeed,10000);
setInterval(async()=>{if(document.hidden||!cuts[active-1].current)return;try{const {poll}=await api(null,'?live=1');if(poll)cuts[active-1].showPoll(poll,(poll.expires-Date.now())/1000);}catch{}},2000);
