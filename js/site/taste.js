const clock = document.querySelector('.layer-clock');
const url = new URL(location.href);
if (url.searchParams.has('layer_zone')) {
  url.searchParams.delete('layer_zone');
  history.replaceState(null,'',url);
}
let remaining = Number(clock.dataset.remaining), sampled = performance.now(), generation = 0, busy = false;
async function sync(operation) {
  const revision = ++generation;
  const body = JSON.stringify({action:'layer_tick',path:location.pathname,tab:clock.dataset.tab,operation});
  try {
    const r = await fetch('/api/legion',{method:'POST',headers:{'Content-Type':'application/json'},body,keepalive:operation==='pause',cache:'no-store'});
    if (revision !== generation || document.hidden) return;
    if (!r.ok) { location.reload(); return; }
    const result = await r.json();
    if (result.admitted) { location.reload(); return; }
    remaining = result.remaining;
    sampled = performance.now();
  } catch { if (!document.hidden) location.reload(); }
}
setInterval(async()=>{
  if (document.hidden || busy) return;
  busy = true;
  try { await sync('read'); } finally { busy = false; }
},7000);
setInterval(()=>{
  if (document.hidden) return;
  const seconds = Math.max(0,Math.ceil((remaining-performance.now()+sampled)/1000));
  clock.firstElementChild.textContent=Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');
  if (!seconds) location.reload();
},250);
document.addEventListener('visibilitychange',()=>sync(document.hidden?'pause':'read'));
window.addEventListener('pagehide',()=>sync('pause'));
window.addEventListener('pageshow',e=>{if(e.persisted)location.reload();});
