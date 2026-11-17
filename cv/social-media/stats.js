const endpoint='/api/stats?cvSocial=1';
const visits=document.getElementById('page-visits'),total=document.getElementById('outbound-total'),top=document.getElementById('outbound-top'),since=document.getElementById('outbound-since');
function unavailable(){visits.textContent=total.textContent='Stats unavailable';top.replaceChildren();}
function render(data){visits.textContent=data.visits.toLocaleString();total.textContent=data.clicks.toLocaleString();since.textContent='Tracked since '+new Date(data.since).toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})+' · No historical outbound click data.';top.replaceChildren();if(!data.top.length){const li=document.createElement('li');li.textContent='No outbound clicks yet';top.append(li);}else for(const row of data.top){const li=document.createElement('li');li.textContent=row.name+' · '+row.clicks.toLocaleString();top.append(li);}}
async function send(body){const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),keepalive:true});if(!r.ok)throw Error();return r.json();}
send({action:'visit',id:crypto.randomUUID()}).then(render).catch(unavailable);
function track(e){if(e.type==='click'&&e.button!==0||e.type==='auxclick'&&e.button!==1)return;const a=e.target.closest?.('a[href]');if(!a)return;const u=new URL(a.href,location.href);if(!['http:','https:'].includes(u.protocol))return;const internal=u.hostname==='corvus.gent'||u.hostname.endsWith('.corvus.gent');if(internal&&u.pathname.replace(/\/$/,'')!=='/go/compound-impact')return;send({action:'click',id:crypto.randomUUID(),href:u.href}).then(render).catch(unavailable);}
document.addEventListener('click',track,true);
document.addEventListener('auxclick',track,true);
