// The deadline works even when a module, the API or a video is unavailable.
(() => {
 const end=Date.parse('2026-11-09T17:00:00Z'),fundEnd=Date.parse('2026-11-08T07:30:00Z');
 function tick(){
  const s=Math.max(0,Math.floor((end-Date.now())/1000));
  const parts={days:Math.floor(s/86400),hours:Math.floor(s/3600)%24,minutes:Math.floor(s/60)%60,seconds:s%60};
  for(const [key,value]of Object.entries(parts)){const el=document.querySelector(`[data-unit="${key}"]`);if(el)el.textContent=String(value).padStart(2,'0');}
  if(!s)document.getElementById('deadline-note').textContent='deadline reached. the edit lives on. keep the feedback coming.';
  const f=Math.max(0,Math.floor((fundEnd-Date.now())/1000)),clock=document.getElementById('fund-clock');
  if(clock)clock.textContent=f?`${Math.floor(f/86400)}d ${String(Math.floor(f/3600)%24).padStart(2,'0')}h ${String(Math.floor(f/60)%60).padStart(2,'0')}m ${String(f%60).padStart(2,'0')}s · sat 11:30pm sf`:'deadline passed. the result stays.';
 }
 tick();setInterval(tick,1000);
 setTimeout(()=>{if(document.documentElement.dataset.compoundReady)return;const status=document.getElementById('connection');status.textContent='the cuts are taking too long. reload to try again.';status.classList.add('error');document.getElementById('reload-cuts').hidden=false;},14000);
})();
