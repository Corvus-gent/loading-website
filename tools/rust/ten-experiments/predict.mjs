// Experimental intent prefetch. Downloads fixed public build assets only, never
// executes them and never requests HTML, APIs, redirects, forms or private routes.
export function predictPublicAssets(policy,win=window){
 const doc=win.document,connection=win.navigator.connection,controllers=new Set(),timers=new Map();
 const state={routes:[],assets:[],failed:[],reservedBytes:0,completedBytes:0};
 const allowed=()=>!doc.hidden&&win.navigator.onLine!==false&&!connection?.saveData&&!/^(slow-)?2g$/.test(connection?.effectiveType||'');
 let ready=false,stopped=false,observer,settle;
 const visited=new Set(),started=new Set();
 function routeFor(a){
  if(!a||a.hasAttribute('download')||a.hasAttribute('data-no-prefetch')||a.target&&a.target!=='_self')return null;
  try{const u=new URL(a.href,win.location.href);if(u.origin!==win.location.origin||u.search||u.hash||u.username||u.password)return null;const route=u.pathname.replace(/\/$/,'')+'/';return Object.hasOwn(policy.routes,route)?route:null;}catch{return null;}
 }
 const visible=a=>a?.getClientRects().length&&!a.closest('[hidden],[inert],dialog:not([open])')&&win.getComputedStyle(a).visibility!=='hidden';
 async function predict(a){
  if(stopped||!ready||!allowed()||!visible(a))return;
  const route=routeFor(a);if(!route||visited.has(route)||visited.size>=policy.maxRoutes)return;
  visited.add(route);state.routes.push(route);
  for(const asset of policy.routes[route]){
   if(stopped||!allowed())break;
   if(!/^\/__experiments\/10-combined\/[a-zA-Z0-9_-]+\.js$/.test(asset.url)||started.has(asset.url))continue;
   // Reserve the build-known compressed bytes before making any request. The
   // response must also match this budget; a changed artifact is not trusted.
   if(!Number.isInteger(asset.bytes)||asset.bytes<=0||state.reservedBytes+asset.bytes>policy.maxBytes)continue;
   started.add(asset.url);state.reservedBytes+=asset.bytes;
   const c=new AbortController();controllers.add(c);const timeout=win.setTimeout(()=>c.abort(),10000);
   try{
    const response=await win.fetch(asset.url,{cache:'force-cache',credentials:'same-origin',redirect:'error',priority:'low',signal:c.signal});
    const bytes=Number(response.headers.get('content-length')),encoding=response.headers.get('content-encoding');
    if(!response.ok||bytes!==asset.encodings?.[encoding]||bytes>asset.bytes||!response.headers.get('content-type')?.includes('javascript'))throw Error('artifact/encoding changed: '+encoding+' '+bytes);
    await response.arrayBuffer();state.assets.push(asset.url);state.completedBytes+=bytes;
   }catch(error){c.abort();state.failed.push({url:asset.url,error:String(error.message)});}finally{win.clearTimeout(timeout);controllers.delete(c);}
  }
 }
 const cancel=a=>{win.clearTimeout(timers.get(a));timers.delete(a);};
 const schedule=(a,ms)=>{cancel(a);timers.set(a,win.setTimeout(()=>{timers.delete(a);void predict(a);},ms));};
 const hover=e=>{if(e.pointerType!=='touch'){const a=e.target.closest?.('a[href]');if(routeFor(a))schedule(a,150);}};
 const leave=e=>{const a=e.target.closest?.('a[href]');if(a&&!a.contains(e.relatedTarget))cancel(a);};
 const intent=e=>{void predict(e.target.closest?.('a[href]'));};
 function activate(){
  if(stopped||!allowed()||ready||doc.readyState!=='complete'||!win.corvusDiscoveryReady)return;
  win.clearTimeout(settle);settle=win.setTimeout(()=>{
   if(stopped||!allowed())return;ready=true;
   if(!win.IntersectionObserver)return;
   observer=new win.IntersectionObserver(entries=>{for(const e of entries)if(e.isIntersecting&&e.intersectionRatio>=.65)schedule(e.target,policy.visibleMs);else cancel(e.target);},{threshold:.65});
   for(const a of doc.querySelectorAll('main a[href]'))if(routeFor(a))observer.observe(a);
  },policy.settleMs);
 }
 function visibility(){if(!allowed()){ready=false;win.clearTimeout(settle);for(const c of controllers)c.abort();for(const a of timers.keys())cancel(a);observer?.disconnect();observer=null;}else activate();}
 function stop(){stopped=true;visibility();win.clearTimeout(settle);for(const c of controllers)c.abort();for(const a of timers.keys())cancel(a);observer?.disconnect();doc.removeEventListener('pointerover',hover);doc.removeEventListener('pointerout',leave);doc.removeEventListener('pointerdown',intent);doc.removeEventListener('focusin',intent);doc.removeEventListener('visibilitychange',visibility);connection?.removeEventListener?.('change',visibility);win.removeEventListener('load',activate);win.removeEventListener('corvus-directory-ready',activate);}
 doc.addEventListener('pointerover',hover,{passive:true});doc.addEventListener('pointerout',leave,{passive:true});doc.addEventListener('pointerdown',intent,{passive:true});doc.addEventListener('focusin',intent);doc.addEventListener('visibilitychange',visibility);connection?.addEventListener?.('change',visibility);win.addEventListener('load',activate);win.addEventListener('corvus-directory-ready',activate);win.addEventListener('pagehide',stop,{once:true});activate();return{state,stop};
}
if(typeof document!=='undefined'){
 const config=document.getElementById('corvus-experiment-prediction');
 if(config)window.corvusPrediction=predictPublicAssets(JSON.parse(config.textContent));
}
