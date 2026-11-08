import {configReady,refreshConfig} from '/js/plethora.js?v=20261108p4';
const $=id=>document.getElementById(id),node=(tag,text,cls)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el;};
const ns='http://www.w3.org/2000/svg';
function svgNode(tag,attrs,text){const el=document.createElementNS(ns,tag);for(const[k,v]of Object.entries(attrs))el.setAttribute(k,v);if(text!==undefined)el.textContent=text;return el;}
function history(data){
 const svg=svgNode('svg',{viewBox:'0 0 700 150',role:'img','aria-label':'Referral clicks in the last seven Pacific days',class:'sparkline'}),max=Math.max(1,...data.map(d=>d.total||0));
 svg.append(svgNode('line',{x1:24,y1:118,x2:676,y2:118,stroke:'#39472a'}));let points=[];
 const flush=()=>{if(points.length>1)svg.append(svgNode('polyline',{points:points.join(' '),fill:'none',stroke:'#d4ff45','stroke-width':3}));points=[];};
 data.forEach((d,i)=>{const x=48+i*100,y=d.total===null?113:110-d.total/max*84;const bar=svgNode('rect',{x:x-18,y:d.total===null?104:y,width:36,height:d.total===null?12:Math.max(3,118-y),fill:d.total===null?'#303a2c':'#d4ff4533'});bar.append(svgNode('title',{},d.day+': '+(d.total===null?'no data yet':d.total+' clicks')));svg.append(bar);if(d.total===null)flush();else{points.push(x+','+y);svg.append(svgNode('circle',{cx:x,cy:y,r:4,fill:'#d4ff45'}),svgNode('text',{x,y:Math.max(14,y-10),'text-anchor':'middle'},d.total.toLocaleString()));}svg.append(svgNode('text',{x,y:143,'text-anchor':'middle'},d.day.slice(5)));});flush();$('history-chart').replaceChildren(svg);
}
let lastGood=false;
function render(d){
 if(!d.ready||!Array.isArray(d.rows)){$('stats-status').textContent=lastGood?'connection lost. last counts shown. retry in a moment.':'counts are reconnecting. try refresh.';$('stats-status').classList.add('error');return;}
 lastGood=true;$('stats-total').textContent=d.total.toLocaleString();$('stats-day').textContent=d.last24h.toLocaleString();
 $('platforms').replaceChildren(...[['ios','iOS'],['android','Android'],['desktop','Desktop']].map(([id,label])=>{const span=node('span',label+' ');span.append(node('b',d.platforms[id].toLocaleString()));return span;}));
 $('platform-note').textContent=d.platforms.unknown?`${d.platforms.unknown.toLocaleString()} earlier clicks have no platform recorded. They remain in the total.`:'Platform is counted at the original referral click.';
 $('stats-raw').textContent=d.raw.toLocaleString();
 $('destinations').replaceChildren(...[['download','Download'],['ossman','OSSMAN']].map(([id,label])=>{const span=node('span',label+' ');span.append(node('b',d.destinations[id].toLocaleString()));return span;}));
 $('destination-note').textContent=d.destinations.unknown?`${d.destinations.unknown.toLocaleString()} earlier clicks predate these official destinations. They stay in the total.`:'Both destinations are official Plethora links.';
 history(d.history);$('history-note').textContent='Pacific days · grey = no history yet'+(d.historyStarted?' · recording since '+new Date(d.historyStarted).toLocaleString():'');
 $('stats-groups').replaceChildren(...[...d.categories].sort((a,b)=>b.total-a.total).map(group=>{const section=node('section',undefined,'stats-group'),h=node('h2',group.name);h.append(node('small',group.total.toLocaleString()+' clicks'));const header=node('div',undefined,'stats-row stats-row-head');header.append(node('span','placement'),node('span','total'),node('span','24h / raw'));section.append(h,header);for(const r of d.rows.filter(r=>r.category===group.name)){const row=node('div',undefined,'stats-row'),label=node('div',r.label);label.append(node('small',r.id));row.append(label,node('b',r.total.toLocaleString()),node('span',r.last24h.toLocaleString()+' / '+r.raw.toLocaleString()));section.append(row);}return section;}));
 $('stats-status').classList.remove('error');$('stats-status').textContent='updated '+new Date(d.updated).toLocaleTimeString()+' · refreshes every 30s';
}
window.addEventListener('plethora-config',e=>render(e.detail));configReady.then(render);
$('refresh-stats').onclick=async()=>{const b=$('refresh-stats');b.disabled=true;try{render(await refreshConfig());}finally{b.disabled=false;}};
