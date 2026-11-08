import {getLang, t} from './i18n.js?v=20261108live1';
const panel = document.querySelector('[data-coffee]');
const state = panel.querySelector('[role=status]');
const details = panel.querySelector('[data-counts]');
let stats;

function render() {
  details.hidden = !stats?.ready;
  state.hidden = !!stats?.ready;
  if (details.hidden) {
    state.textContent = t(stats?.ready === false ? 'coffee.empty' : 'coffee.unavailable');
    return;
  }
  for (const key of ['total','supporters','month']) {
    details.querySelector('[data-' + key + ']').textContent = (key === 'supporters' && stats.supportersEstimated ? '≈ ' : '') + stats[key].toLocaleString(getLang());
  }
  const cups = Math.min(50,stats.total);
  details.querySelector('[data-cups]').textContent = '☕'.repeat(cups) + (stats.total > cups ? ' +' + (stats.total-cups) : '');
  const latest = panel.querySelector('time');
  latest.parentElement.hidden = !stats.latest;
  if (stats.latest) {
    const format = new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Brussels'});
    const days = Math.round((Date.parse(stats.latest) - Date.parse(format.format(new Date()))) / 86400000);
    latest.dateTime = stats.latest;
    latest.title = stats.latest;
    latest.textContent = new Intl.RelativeTimeFormat(getLang(),{numeric:'auto'}).format(days,'day');
  }
}
new MutationObserver(render).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
const {page,today,watch}=window.statsPage;
if(page==='coffee')watch(page,today,s=>{stats=s.data;render();});
else document.addEventListener('overview-coffee',e=>{stats=e.detail;render();});
if(page==='overview'&&window.overviewCoffee){stats=window.overviewCoffee;render();}
