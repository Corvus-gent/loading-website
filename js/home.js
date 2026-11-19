import {initI18n,t} from './i18n.js?v=20261108live1';
import {sfLocationKey} from './sf-trip.js';
import {mountSFNote} from './sf-note.js?v=20261108live1';
import './site/accessibility.js?v=20261112a11y1';
let city='Gent',noteLabels=()=>{};
function labels(){const key=sfLocationKey();document.querySelector('#loc [data-i18n]').hidden=!!key;document.getElementById('city').textContent=key?t(key):city;noteLabels();}
initI18n(labels);noteLabels=mountSFNote();labels();
fetch('/location.json',{cache:'no-store'}).then(r=>r.json()).then(data=>{city=data.city;labels();}).catch(()=>{});
const hero=document.getElementById('hero');hero.addEventListener('click',()=>{labels();document.getElementById('loc').classList.toggle('show');});
setInterval(labels,60000);document.addEventListener('visibilitychange',labels);
