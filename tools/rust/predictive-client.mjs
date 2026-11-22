// Page-local signals only: no analytics, visitor IDs, storage or cross-origin requests.
// Fetch bytes without executing destination scripts or starting timers/embeds/forms.
export function startPredictiveLoading(policy,win=window){
 const doc=win.document,connection=win.navigator.connection;
 const allowed=()=>!doc.hidden&&win.navigator.onLine!==false&&!connection?.saveData&&!/^(slow-)?2g$/.test(connection?.effectiveType||'');
 const pages=new Set(policy.pages),documents=new Set(),controllers=new Set(),pending=new Map();
 let ready=false,stopped=false,assetStarted=false,assetBytes=0,rules=null,observer=null,settleTimer;
 const state={documents:[],assets:[],failed:[],bytes:0}; // Memory-only diagnostics for the lab.
 const pathFor=anchor=>{
  if(!anchor||anchor.hasAttribute('download')||anchor.target&&anchor.target!=='_self'||anchor.hasAttribute('data-no-prefetch'))return null;
  try{const u=new URL(anchor.href,win.location.href);if(u.origin!==win.location.origin||u.search||u.hash||u.username||u.password)return null;return pages.has(u.pathname)?u.pathname:null;}catch{return null;}
 };
 const usable=anchor=>anchor?.getClientRects().length&&!anchor.closest('[hidden],[inert],dialog:not([open])')&&win.getComputedStyle(anchor).visibility!=='hidden';
 function documentHint(path){
  if(documents.has(path)||documents.size>=policy.maxDocuments)return false;
  documents.add(path);state.documents.push(path);
  if(win.HTMLScriptElement.supports?.('speculationrules')){
   rules?.remove();rules=doc.createElement('script');rules.type='speculationrules';
   rules.textContent=JSON.stringify({prefetch:[{source:'list',urls:[...documents]}]});doc.head.append(rules);
  }else{const link=doc.createElement('link');if(link.relList.supports?.('prefetch')){link.rel='prefetch';link.href=path;link.dataset.corvusPredictive='';doc.head.append(link);}}
  return true;
 }
 async function warmAssets(){
  if(assetStarted||!allowed()||stopped)return;assetStarted=true;
  for(const asset of policy.assets){
   if(!allowed()||stopped)break;
   // Fixed same-origin public build artifacts only. No API or redirect paths.
   if(!/^\/rust\/browser\/pkg\/core\/[a-z_]+\.(?:js|wasm)$/.test(asset))continue;
   const controller=new AbortController();controllers.add(controller);
   const timeout=win.setTimeout(()=>controller.abort(),10000);
   try{
    const response=await win.fetch(asset,{credentials:'same-origin',cache:'force-cache',redirect:'error',priority:'low',signal:controller.signal});
    const bytes=Number(response.headers.get('content-length'));
    if(!response.ok||!Number.isFinite(bytes)||bytes<=0||assetBytes+bytes>policy.maxAssetBytes){controller.abort();throw Error('budget or response');}
    assetBytes+=bytes;await response.arrayBuffer();state.bytes=assetBytes;state.assets.push(asset);
   }catch{state.failed.push(asset);}finally{win.clearTimeout(timeout);controllers.delete(controller);}
  }
 }
 function predict(anchor){
  if(!ready||stopped||!allowed()||!usable(anchor))return;
  const path=pathFor(anchor);if(!path)return;
  if(documentHint(path)||documents.has(path))void warmAssets();
 }
 function cancel(anchor){win.clearTimeout(pending.get(anchor));pending.delete(anchor);}
 function schedule(anchor,delay){cancel(anchor);pending.set(anchor,win.setTimeout(()=>{pending.delete(anchor);predict(anchor);},delay));}
 const hover=e=>{if(e.pointerType!=='touch'){const a=e.target.closest?.('a[href]');if(pathFor(a))schedule(a,180);}};
 const leave=e=>{const a=e.target.closest?.('a[href]');if(a&&!a.contains(e.relatedTarget))cancel(a);};
 const intent=e=>predict(e.target.closest?.('a[href]'));
 function observeLinks(){
  if(observer||!win.IntersectionObserver)return;
  observer=new win.IntersectionObserver(entries=>{
   for(const entry of entries){if(entry.isIntersecting&&entry.intersectionRatio>=.65)schedule(entry.target,policy.visibleMs);else cancel(entry.target);}
  },{threshold:.65});
  // Visible content doors outrank permanent navigation/footer links. Those
  // still qualify on explicit hover/focus/touch, but do not consume the budget.
  for(const a of doc.querySelectorAll('main a[href]'))if(pathFor(a))observer.observe(a);
 }
 function activate(){
  if(stopped||!allowed()||ready||!win.corvusDiscoveryReady||doc.readyState!=='complete')return;
  win.clearTimeout(settleTimer);settleTimer=win.setTimeout(()=>{if(!allowed()||stopped)return;ready=true;observeLinks();},policy.settleMs);
 }
 function visibility(){
  if(!allowed()){
   for(const c of controllers)c.abort();for(const a of pending.keys())cancel(a);
   observer?.disconnect();observer=null;ready=false;rules?.remove();rules=null;
   doc.querySelectorAll('link[data-corvus-predictive]').forEach(link=>link.remove());
  }else activate();
 }
 doc.addEventListener('pointerover',hover,{passive:true});doc.addEventListener('pointerout',leave,{passive:true});
 doc.addEventListener('pointerdown',intent,{passive:true});doc.addEventListener('focusin',intent);
 doc.addEventListener('visibilitychange',visibility);connection?.addEventListener?.('change',visibility);
 win.addEventListener('load',activate);win.addEventListener('corvus-directory-ready',activate);
 const stop=()=>{stopped=true;win.clearTimeout(settleTimer);for(const c of controllers)c.abort();for(const a of pending.keys())cancel(a);observer?.disconnect();rules?.remove();
  doc.removeEventListener('pointerover',hover);doc.removeEventListener('pointerout',leave);doc.removeEventListener('pointerdown',intent);doc.removeEventListener('focusin',intent);
  doc.removeEventListener('visibilitychange',visibility);connection?.removeEventListener?.('change',visibility);win.removeEventListener('load',activate);win.removeEventListener('corvus-directory-ready',activate);};
 win.addEventListener('pagehide',stop,{once:true});activate();return{state,stop};
}
if(typeof document!=='undefined'){
 const config=document.getElementById('corvus-predictive-policy');
 if(config)window.corvusPredictive=startPredictiveLoading(JSON.parse(config.textContent));
}
