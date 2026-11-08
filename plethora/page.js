import {configReady,decorate} from '/js/plethora.js?v=20261108live1';
configReady.then(config=>decorate(document,config));
const mobile=/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
const wrap=document.querySelector('.qr-wrap');wrap.hidden=mobile;
if(!mobile){
 try{const {default:qrcode}=await import('./qrcode.mjs');const qr=qrcode(0,'M');qr.addData('https://corvus.gent/go/plethora-qr');qr.make();document.getElementById('plethora-qr').innerHTML=qr.createSvgTag({cellSize:6,margin:24,scalable:true,alt:'Scan to download Plethora'});const svg=document.querySelector('#plethora-qr svg');svg.setAttribute('role','img');svg.setAttribute('aria-label','Scan to download Plethora');}catch{document.getElementById('plethora-qr').textContent='Open corvus.gent/go/plethora-qr on your phone.';}
}
