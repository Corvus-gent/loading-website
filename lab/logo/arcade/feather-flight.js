const flight = document.getElementById('flight');
const feather = flight.querySelector('.wing-feather');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
let flying=false;
function launch() {
  if (reduced.matches || flight.open || document.hidden || flying) return;
  flying=true;
  const target=document.getElementById('vote-total-trigger');
  const box = (target||feather).getBoundingClientRect();
  const w = innerWidth - 52, h = innerHeight - 48;
  const x = Math.max(0, Math.min(w, box.left)), y = Math.max(0, Math.min(h, box.top));
  const flyer = document.createElement('button');
  flyer.className = 'flying-feather';
  flyer.setAttribute('aria-label','Catch the feather and see Wing fly');
  const wing = feather.innerHTML;
  flyer.innerHTML = '<svg aria-hidden="true" viewBox="0 0 50 32"><g transform="translate(1 -1) scale(.9)">'+wing+'</g><g transform="translate(49 -1) scale(-.9 .9)">'+wing+'</g><path fill="#b3792c" d="M19 15h11v3h4v9h-4v3H19v-3h-4v-9h4z"/><path fill="#ffd86e" d="M19 18h10v7H19z"/><path fill="#fff1bc" d="M19 18h5v3h-5z"/></svg>';
  document.body.append(flyer);
  feather.style.visibility='hidden';
  const points=[[x,y,-12],[w*.69,h*.26,16],[w*.88,h*.32,32],[w*.55,h*.50,-20],[w*.15,h*.22,-32],[w*.23,h*.16,8],[x,y,0]];
  const anim=flyer.animate(points.map(([a,b,r])=>({transform:'translate('+a+'px,'+b+'px) rotate('+r+'deg)',easing:'ease-in-out'})),{duration:3200});
  function finish(){flying=false;anim.cancel();flyer.remove();feather.style.visibility='';flight.removeEventListener('toggle',finish);reduced.removeEventListener('change',finish);}
  anim.onfinish=finish;
  flight.addEventListener('toggle',finish);reduced.addEventListener('change',finish);
  flyer.onclick=()=>{document.querySelector('.vote-hero')?.classList.add('caught');document.getElementById('vote-total-note').textContent='caught it. Wing is ready to fly ✦';flight.open=true;finish();flight.scrollIntoView({block:'center'});flight.querySelector('summary').focus({preventScroll:true});};
}
setTimeout(launch,16000);

const countTrigger=document.getElementById('vote-total-trigger');
countTrigger?.addEventListener('pointerenter',event=>{if(event.pointerType==='mouse')launch();});
countTrigger?.addEventListener('click',launch);
countTrigger?.addEventListener('focus',launch);
