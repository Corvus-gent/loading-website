import qrcode from '/js/vendor/qrcode-2.0.4.mjs';
import {DEADLINE} from '/compound/v2/config.js';
const $=id=>document.getElementById(id),params=new URLSearchParams(location.search),URL='https://corvus.gent/live?utm_source=stream&utm_medium=qr';
document.body.classList.toggle('green',params.get('bg')==='green');document.body.classList.toggle('compact',params.get('compact')==='1');
function fit(){const scale=Math.min(innerWidth/1920,innerHeight/1080);$('stage').style.transform='translate('+((innerWidth-1920*scale)/2)+'px,'+((innerHeight-1080*scale)/2)+'px) scale('+scale+')';}
addEventListener('resize',fit);fit();
const qr=qrcode(0,'M');qr.addData(URL);qr.make();$('qr').innerHTML=qr.createSvgTag({cellSize:8,margin:32,scalable:true});
let lastUpdated=null,busy=false;
export function tick(){const seconds=Math.max(0,Math.ceil((Date.parse(DEADLINE)-Date.now())/1000));$('countdown').textContent=seconds?[Math.floor(seconds/86400),Math.floor(seconds/3600)%24,Math.floor(seconds/60)%60,seconds%60].map(v=>String(v).padStart(2,'0')).join(':'):'challenge ended';if(!seconds)$('countdown').style.fontSize='35px';}
tick();setInterval(tick,1000);
function state(stale){const el=$('connection');el.classList.toggle('stale',stale);el.textContent=stale?(lastUpdated?'last update '+Math.max(0,Math.floor((Date.now()-Date.parse(lastUpdated))/60000))+'m ago':'reconnecting'):'live · 15s';}
async function refresh(){if(busy)return;busy=true;try{const response=await fetch('/api/compound/summary',{credentials:'omit',signal:AbortSignal.timeout(6000)});if(!response.ok)throw Error();const data=await response.json();if(!data.ready||!Number.isFinite(data.totals?.views))throw Error();
 $('views').textContent=new Intl.NumberFormat('en-US').format(data.totals.views);$('leader').textContent=data.leader?'Leading: '+data.leader.code:'no leader yet';
 const rows=(data.latest||[]).slice(0,3).map(row=>{const el=document.createElement('p');el.textContent=(row.choice==='up'?'↑':'↓')+' '+row.code+' · voted';return el;});if(!rows.length){const el=document.createElement('p');el.textContent='the next vote could be yours.';rows.push(el);}$('events').replaceChildren(...rows);
 lastUpdated=data.updated_at;state(!!data.stale||Date.now()-Date.parse(data.updated_at)>60000);
 }catch{state(true);}finally{busy=false;}}
refresh();setInterval(refresh,15000);addEventListener('online',refresh);
