import { renderCountries, countryPeriod } from './stats-countries.js';
const container=document.querySelector('#visitor-map');
let visible=false,started=false,data,update,mode='day',daily;
function mount(){
  if(update){update(data);return;}
  if(!visible||started||!data)return;
  started=true;
  const css=document.createElement('link');css.rel='stylesheet';css.href='/js/vendor/leaflet/leaflet.css';document.head.append(css);
  import('./stats-map.js?v=20261108color2').then(async({initMap})=>{const initial=data;update=await initMap(initial);if(initial!==data)update?.(data);}).catch(()=>{document.querySelector('#visitor-map-status').textContent='the lantern is out.';});
}
const observer=new IntersectionObserver(entries=>{if(entries[0].isIntersecting){visible=true;observer.disconnect();mount();}});observer.observe(container);
function show(payload,day){
  data=payload;
  document.querySelector('#countries-period').textContent=day==='all'?'all time · since 2 nov 2026':countryPeriod(day);
  const list=document.querySelector('#countries');
  if(data?.countries){const n=data.countries.filter(c=>c.c&&c.c!=='?').length;document.querySelector('#map-count').textContent=`${n} ${n===1?'country':'countries'} · ${day==='all'?'all time':day} · city areas + country totals.`;renderCountries(list,data.countries);}
  else list.textContent='country counts are unavailable. try again shortly.';
  if(!data)document.querySelector('#visitor-map-status').textContent='the lantern is out.';
  mount();
}
window.statsPage.watch('map',window.statsPage.selected||window.statsPage.today,s=>{daily=s;if(mode==='day')show(s.data,s.day||window.statsPage.today);});
for(const button of document.querySelectorAll('[data-map-period]'))button.addEventListener('click',async()=>{
  if(button.dataset.mapPeriod===mode)return;
  const next=button.dataset.mapPeriod;
  if(next==='all'){
    button.disabled=true;
    try{const r=await fetch('/api/geo?day=all&v=6tiles',{signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error();const d=await r.json();show(d,'all');mode=next;}
    catch{document.querySelector('#map-count').textContent='all-time data is unavailable. keeping the current map; try again.';}
    finally{button.disabled=false;}
  }else{mode=next;show(daily?.data,daily?.day||window.statsPage.today);}
  for(const b of document.querySelectorAll('[data-map-period]'))b.setAttribute('aria-pressed',String(b.dataset.mapPeriod===mode));
});
