export const SOLO_START='2026-11-07T21:00:00Z';
export function remaining(at=Date.now()){const s=Math.max(0,Math.floor((Date.parse(SOLO_START)-at)/1000));return{hours:Math.floor(s/3600),minutes:Math.floor(s/60)%60,seconds:s%60,started:at>=Date.parse(SOLO_START)};}
function tick(){
 const state=remaining();
 for(const el of document.querySelectorAll('[data-clock]'))el.textContent=String(state[el.dataset.clock]).padStart(2,'0');
 if(state.started){
  const title=document.querySelector('#solo-title');if(title)title.textContent='solo run. building now.';
  const line=document.querySelector('#solo-state');if(line)line.textContent='the clock hit 1pm sf. follow along — details land here.';
  const clock=document.querySelector('#solo-clock');if(clock)clock.hidden=true;
  const label=document.querySelector('[data-run-state]');if(label)label.textContent='live: solo run / hackathon 02';
  const badge=document.querySelector('[data-next-status]');if(badge)badge.textContent='live';
 }
}
if(typeof document!=='undefined'){tick();setInterval(()=>{if(!document.hidden)tick();},1000);document.addEventListener('visibilitychange',tick);}
