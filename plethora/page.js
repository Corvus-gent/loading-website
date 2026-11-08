import {configReady,decorate} from '/js/plethora.js?v=20261108p3';
import {canonicalPlacement} from '/js/plethora-config.js?v=20261108p3';
const params=new URLSearchParams(location.search),from=canonicalPlacement(params.get('from')||params.get('placement')),placement=from||'bio-x';
const mobile=/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
const landingLink=os=>'/go/plethora-'+placement+'?store=1'+(from?'&noCount=1':'')+(os?'&platform='+os:'');
for(const link of document.querySelectorAll('a[data-plethora]')){link.href=landingLink(link.dataset.store);link.dataset.plethora=placement;}
function configure(config){
 decorate(document,config);
 const android=document.getElementById('plethora-android'),ready=Boolean(config.playURL);android.setAttribute('aria-disabled',String(!ready));
 android.textContent=ready?'Google Play ↗':'Google Play · link coming soon';
 document.getElementById('android-note').hidden=ready;
 const qrCode=document.getElementById('qr-referral');qrCode.hidden=!config.referralCode;qrCode.textContent=config.referralCode?'Use my code: '+config.referralCode:'';
}
const android=document.getElementById('plethora-android');android.onclick=e=>{if(android.getAttribute('aria-disabled')==='true'){e.preventDefault();document.getElementById('android-note').focus();}};
window.addEventListener('plethora-config',e=>configure(e.detail));configReady.then(configure);
// A QR scan is a new visitor entry, attributed to QR rather than the desktop CTA.
const wrap=document.querySelector('.qr-wrap');wrap.hidden=mobile;
if(!mobile){
 try{const {default:qrcode}=await import('./qrcode.mjs');const qr=qrcode(0,'M');qr.addData('https://corvus.gent/go/plethora-qr?store=1');qr.make();document.getElementById('plethora-qr').innerHTML=qr.createSvgTag({cellSize:6,margin:24,scalable:true,alt:'Scan to get Plethora on iPhone or Android'});const svg=document.querySelector('#plethora-qr svg');svg.setAttribute('role','img');svg.setAttribute('aria-label','Scan to get Plethora on iPhone or Android');}catch{document.getElementById('plethora-qr').textContent='Open corvus.gent/go/plethora-qr on your phone.';}
}
