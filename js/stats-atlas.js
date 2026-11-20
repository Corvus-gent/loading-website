import { formatPageText, translatePageText } from './i18n/page-copy.js';
import { number } from './stats-view.js';
import { renderCountries, countryPeriod } from './stats-countries.js';
const container=document.querySelector('#visitor-map');
let visible=false,started=false,data,update,mode=null,daily,shownDay;
function mount(){
  if(update){update(data);return;}
  if(!visible||started||!data)return;
  started=true;
  const css=document.createElement('link');css.rel='stylesheet';css.href='/js/vendor/leaflet/leaflet.css';document.head.append(css);
  import('./stats-map.js?v=20261116cleanmap').then(async({initMap})=>{const initial=data;update=await initMap(initial);if(initial!==data)update?.(data);}).catch(()=>{document.querySelector('#visitor-map-status').textContent='the lantern is out.';});
}
const observer=new IntersectionObserver(entries=>{if(entries[0].isIntersecting){visible=true;observer.disconnect();mount();}});observer.observe(container);
function show(payload,day){
  data=payload; shownDay=day;
  const total = Number.isSafeInteger(data?.total) && data.total >= 0 ? data.total
    : Array.isArray(data?.countries) ? data.countries.reduce((sum, country) => sum + (Number.isSafeInteger(country.n) && country.n >= 0 ? country.n : 0), 0) : null;
  document.querySelector('#map-total').textContent = number(total);
  document.querySelector('#map-total-label').textContent = formatPageText('visitors · {period}', {period: day === 'all' ? translatePageText('all time') : countryPeriod(day)});

  document.querySelector('#countries-period').textContent=day==='all' ? formatPageText('all time · since {date}', {date: new Date('2026-11-02T12:00Z').toLocaleDateString(document.documentElement.lang)}) : countryPeriod(day);
  const list=document.querySelector('#countries');
  if (data?.countries) {
    const n = data.countries.filter(c => c.c && c.c !== '?').length;
    document.querySelector('#map-count').textContent = formatPageText(
      n === 1 ? '{count} country · {period} · city areas + country totals.'
        : '{count} countries · {period} · city areas + country totals.',
      {count: number(n), period: day === 'all' ? translatePageText('all time') : day}
    );
    renderCountries(list, data.countries);
  }
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

window.addEventListener('corvus-page-copy-ready', () => { if (shownDay) show(data, shownDay); });

// Load the all-time view immediately; the daily snapshot stays ready for switching.
document.querySelector('[data-map-period="all"]').click();
