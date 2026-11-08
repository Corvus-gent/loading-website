// One small cached same-origin request. No external SDK, cookie, or view beacon.
const ios=/iPhone|iPad|iPod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
const banner=document.querySelector('[data-plethora-banner]');
if(banner){try{banner.hidden=localStorage.getItem('plethora.home.dismissed')==='1';}catch{}banner.querySelector('button').onclick=()=>{banner.hidden=true;try{localStorage.setItem('plethora.home.dismissed','1');}catch{}};}
export function decorate(root=document,config){
 for(const link of root.querySelectorAll('a[data-plethora]')){
  const url=new URL(link.getAttribute('href'),location.href);
  if(location.hostname==='stats.corvus.gent'&&url.pathname.startsWith('/go/plethora-')){url.hostname='corvus.gent';url.protocol='https:';link.href=url.href;}
  // iPadOS can report a Mac desktop UA. This is platform routing, not tracking.
  if(ios&&url.pathname.startsWith('/go/plethora-')){url.searchParams.set('ios','1');link.href=location.hostname==='stats.corvus.gent'?url.href:url.pathname+url.search;}
  if(config?.referralCode){let code=link.nextElementSibling;if(!code?.classList.contains('plethora-ref')){code=document.createElement('small');code.className='plethora-ref';link.after(code);}code.textContent='Use my code: '+config.referralCode;code.hidden=false;}
 }
}
decorate();
export const configReady=fetch('/api/plethora',{signal:AbortSignal.timeout(6000)}).then(r=>r.ok?r.json():{}).catch(()=>({}));
configReady.then(config=>{decorate(document,config);window.dispatchEvent(new CustomEvent('plethora-config',{detail:config}));});
// A daily result swaps its per-game placement after the shared script loads.
window.addEventListener('plethora-result',()=>configReady.then(config=>decorate(document,config)));
