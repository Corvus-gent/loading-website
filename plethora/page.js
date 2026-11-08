import qrcode from './qrcode.mjs';
import {configReady,decorate} from '/js/plethora.js?v=20261108p1';
import {PLETHORA_PLACEMENTS} from '/js/plethora-config.js';
const requested=new URLSearchParams(location.search).get('placement');
const placement=Object.hasOwn(PLETHORA_PLACEMENTS,requested)?requested:'bio';
// Explicit App Store action avoids looping desktop visitors back to this page.
const download=document.getElementById('plethora-download');
download.href='/go/plethora-'+placement+'?store=1';download.dataset.plethora=placement;
const qr=qrcode(0,'M');qr.addData('https://corvus.gent/go/plethora-'+placement+'?store=1');qr.make();
document.getElementById('plethora-qr').innerHTML=qr.createSvgTag({cellSize:6,margin:24,scalable:true,alt:'Scan to get Plethora on your iPhone'});
const svg=document.querySelector('#plethora-qr svg');svg.setAttribute('role','img');svg.setAttribute('aria-label','Scan to get Plethora on your iPhone');
configReady.then(config=>{decorate(document,config);if(config.ready)document.getElementById('plethora-total').textContent='🔥 '+Number(config.total).toLocaleString()+' referral clicks sent to Plethora by the army';});
