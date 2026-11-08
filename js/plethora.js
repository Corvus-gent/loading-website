// Shared same-origin configuration and aggregate counter. No tracking SDK/cookie.
const ios=/iPhone|iPad|iPod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
const edition=location.pathname.includes('/do-bronx')||new URLSearchParams(location.search).get('edition')==='do-bronx';
const banner=document.querySelector('[data-plethora-banner]');
if(banner){try{banner.hidden=localStorage.getItem('plethora.home.dismissed')==='1';}catch{}banner.querySelector('button').onclick=()=>{banner.hidden=true;try{localStorage.setItem('plethora.home.dismissed','1');}catch{}};}
export function decorate(root=document,config){
 for(const link of root.querySelectorAll('a[data-plethora]')){
  if(edition&&link.dataset.plethora==='gameover'){link.dataset.plethora='celtix';link.href='/go/plethora-celtix';}
  const url=new URL(link.getAttribute('href'),location.href);
  if(location.hostname==='stats.corvus.gent'&&url.pathname.startsWith('/go/plethora-')){url.hostname='corvus.gent';url.protocol='https:';link.href=url.href;}
  if(ios&&url.pathname.startsWith('/go/plethora-')){url.searchParams.set('ios','1');link.href=location.hostname==='stats.corvus.gent'?url.href:url.pathname+url.search;}
  if(config?.referralCode){let code=link.nextElementSibling;if(!code?.classList.contains('plethora-ref')){code=document.createElement('small');code.className='plethora-ref';link.after(code);}code.textContent='Use my code: '+config.referralCode;code.hidden=false;}else if(config&&link.nextElementSibling?.classList.contains('plethora-ref'))link.nextElementSibling.hidden=true;
 }
}
export function tickCounter(el,total){
 total=Math.max(0,Number(total)||0);const previous=Number(el.dataset.total||total);el.dataset.total=total;
 cancelAnimationFrame(el._plethoraFrame);const start=performance.now(),reduced=previous===total||matchMedia('(prefers-reduced-motion: reduce)').matches;
 const paint=now=>{const p=reduced?1:Math.min(1,(now-start)/650),n=Math.round(previous+(total-previous)*(1-(1-p)**3));el.textContent='🔥 '+n.toLocaleString()+' people sent to Plethora by the army';if(p<1)el._plethoraFrame=requestAnimationFrame(paint);};paint(start);
}
const isStats=location.pathname.replace(/\/$/,'')==='/plethora/stats';
const endpoint='/api/plethora'+(isStats?'?action=stats':'');
export async function refreshConfig(){
 try{const r=await fetch(endpoint,{signal:AbortSignal.timeout(8000)}),config=r.ok?await r.json():{};decorate(document,config);if(config.ready)document.querySelectorAll('[data-plethora-live]').forEach(el=>tickCounter(el,config.total));window.dispatchEvent(new CustomEvent('plethora-config',{detail:config}));return config;}catch{const config={ready:false};window.dispatchEvent(new CustomEvent('plethora-config',{detail:config}));return config;}
}
decorate();export const configReady=refreshConfig();
// Only pages displaying live counts poll; gameplay and other pages stay quiet.
if(isStats||document.querySelector('[data-plethora-live]'))setInterval(()=>{if(!document.hidden&&(!banner||!banner.hidden))refreshConfig();},30000);
window.addEventListener('plethora-result',()=>configReady.then(config=>decorate(document,config)));
