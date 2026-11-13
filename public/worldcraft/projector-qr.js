import qrcode from './vendor/qrcode.js';
const base='https://corvus.gent',fallback=base+'/curiositycraft';let target=fallback;
try{const raw=new URLSearchParams(location.search).get('to');if(raw&&raw.length<=2048){const url=new URL(raw,base);if(['https:','http:'].includes(url.protocol)&&!url.username&&!url.password)target=url.href;}}catch{}
function make(url){const qr=qrcode(0,'M');qr.addData(url,'Byte');qr.make();return qr.createSvgTag({cellSize:8,margin:32,scalable:true});}
try{document.querySelector('#qr').innerHTML=make(target);}catch{target=fallback;document.querySelector('#qr').innerHTML=make(target);}
const svg=document.querySelector('#qr svg');svg.setAttribute('role','img');svg.setAttribute('aria-label','QR code: '+target);svg.setAttribute('shape-rendering','crispEdges');document.querySelector('#target').textContent=target.replace(/^https?:\/\//,'');document.querySelector('#target').title=target;
async function refresh(){try{const r=await fetch('/api/worldcraft',{cache:'no-store',signal:AbortSignal.timeout(8000)});if(!r.ok)throw Error();const d=await r.json();document.querySelector('#players').textContent=new Intl.NumberFormat().format(d.scoreboard.active)+' playing now';}catch{document.querySelector('#players').textContent='Live players: —';}}
refresh();setInterval(()=>{if(!document.hidden)refresh();},10000);
async function fullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{}}
document.addEventListener('click',fullscreen);document.addEventListener('keydown',e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();fullscreen();}});
