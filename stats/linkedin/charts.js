import {selectRows,seriesFor,sum,comparison} from './model.js';
const dataURL=new URL('./data.json',import.meta.url),profileURL=new URL('./profile-views.json',import.meta.url);
const labels={impressions:'Impressions',engagements:'Engagements',newFollowers:'New followers',profile:'Profile viewers'};
const number=n=>new Intl.NumberFormat('en-US').format(n);
const short=n=>new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:1}).format(n);
const date=(s,year=false)=>new Date(s+'T12:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'short',...(year?{year:'numeric'}:{}),timeZone:'UTC'});
function el(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;}
function svgEl(tag,attrs={},text){const e=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [key,value]of Object.entries(attrs))e.setAttribute(key,value);if(text!==undefined)e.textContent=text;return e;}
function axisScale(value){const raw=Math.max(1,value/4),base=10**Math.floor(Math.log10(raw)),step=[1,2,2.5,5,10].map(n=>n*base).find(n=>n>=raw);return {step,max:Math.max(step,Math.ceil(value/step)*step)};}
function plot(root,points,{bars=false,label='',unit=''}={}){
 const W=Math.max(280,root.clientWidth||640),H=W<420?240:300,left=44,right=12,top=16,bottom=42,w=W-left-right,h=H-top-bottom;
 const valid=points.filter(p=>p.value!==null);if(!valid.length){root.append(el('p','li-note','Not included in this export.'));return;}
 const {step,max}=axisScale(Math.max(...valid.map(p=>p.value)));
 const x=i=>left+(points.length===1?w/2:i*w/(points.length-1)),y=v=>top+h-v/max*h;
 const svg=svgEl('svg',{viewBox:`0 0 ${W} ${H}`,class:'li-plot',role:'img',tabindex:'0','aria-label':label+'. Use left and right arrow keys to inspect values.'});
 const title=svgEl('title',{},label);svg.append(title);
 for(let i=0;i<=Math.round(max/step);i++){const value=step*i;svg.append(svgEl('line',{x1:left,x2:W-right,y1:y(value),y2:y(value),class:'li-grid'}),svgEl('text',{x:left-10,y:y(value)+4,'text-anchor':'end',class:'li-axis'},short(value)));}
 const ticks=bars?points.map((_,i)=>i):[...new Set([0,Math.floor((points.length-1)/2),points.length-1])];
 for(const i of ticks)svg.append(svgEl('text',{x:x(i),y:H-12,'text-anchor':i===0&&points.length>1?'start':i===points.length-1&&points.length>1?'end':'middle',class:'li-axis'},points[i].label||date(points[i].date)));
 if(bars){points.forEach((p,i)=>{if(p.value!==null)svg.append(svgEl('rect',{x:x(i)-30,y:y(p.value),width:60,height:top+h-y(p.value),rx:3,class:'li-bar'}));});}
 else{
  let segment=[];const segments=[];points.forEach((p,i)=>{if(p.value===null){if(segment.length)segments.push(segment);segment=[];}else segment.push([x(i),y(p.value)]);});if(segment.length)segments.push(segment);
  for(const s of segments){const path=s.map(([a,b],i)=>(i?'L':'M')+a.toFixed(2)+','+b.toFixed(2)).join(' ');svg.append(svgEl('path',{d:path+` L${s.at(-1)[0]},${top+h} L${s[0][0]},${top+h} Z`,class:'li-area'}),svgEl('path',{d:path,class:'li-line'}));}
 }
 const cursor=svgEl('line',{y1:top,y2:top+h,class:'li-cursor'}),dot=svgEl('circle',{r:4,class:'li-dot'});svg.append(cursor,dot);root.append(svg);
 const readout=el('p','li-readout');root.append(readout);let index=points.length-1;
 function inspect(i){index=Math.max(0,Math.min(points.length-1,i));const p=points[index];readout.textContent=(p.label||date(p.date,true))+' · '+(p.value===null?'Not available':number(p.value))+' '+unit;cursor.setAttribute('x1',x(index));cursor.setAttribute('x2',x(index));dot.setAttribute('cx',x(index));dot.setAttribute('cy',p.value===null?top+h:y(p.value));dot.style.display=p.value===null?'none':'';}
 svg.addEventListener('pointermove',e=>{const rect=svg.getBoundingClientRect(),vx=(e.clientX-rect.left)/rect.width*W;inspect(Math.round((vx-left)/w*(points.length-1)));});
 svg.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();inspect(e.key==='Home'?0:e.key==='End'?points.length-1:index+(e.key==='ArrowRight'?1:-1));}});inspect(index);
}
function render(root,data,profile,metric,range,mode){
 root.replaceChildren();
 if(metric==='profile'){
  const points=profile.snapshots.slice(-5).map(s=>({date:s.end,label:date(s.start)+'–'+date(s.end,true),value:s.viewers})),latest=profile.snapshots.at(-1);
  root.append(el('div','li-value',number(latest.viewers)),el('p','li-label','Weekly profile viewers'),el('p','li-period',date(latest.start)+'–'+date(latest.end,true)));
  plot(root,points,{bars:true,label:'Observed weekly LinkedIn profile viewers',unit:'profile viewers'});
  root.append(el('p','li-insight','+'+number(latest.reportedChangePercent)+'% vs. the prior 7 days, as reported by LinkedIn.'));
  root.append(el('p','li-note','Manually transcribed LinkedIn weekly snapshot. The content export has no daily profile-view history; unreported weeks are not plotted.'));return;
 }
 const rows=selectRows(data,range),value=sum(rows,metric),points=seriesFor(rows,metric,mode);
 root.append(el('div','li-value',value===null?'Not available':number(value)),el('p','li-label',labels[metric]+(mode==='daily'?' · daily chart':' · cumulative chart')),el('p','li-period',date(rows[0].date)+'–'+date(rows.at(-1).date,true)+' · UTC'));
 plot(root,points,{label:labels[metric]+', '+mode+', '+date(rows[0].date)+' to '+date(rows.at(-1).date,true),unit:labels[metric].toLowerCase()+(mode==='cumulative'?' to date':'')});
 if(metric==='impressions'&&range==='all'){
  const c=comparison(data);if(c)root.append(el('p','li-insight',number(c.value)+' impressions in my first SF week (6–12 Nov). +'+number(Math.round(c.change))+'% vs. 30 Oct–5 Nov.'));
 }else if(value!==null){const complete=rows.filter(r=>r.date!==data.source.partialDate&&r[metric]!==null),peak=complete.reduce((a,b)=>!a||b[metric]>a[metric]?b:a,null);if(peak)root.append(el('p','li-insight','Peak day: '+date(peak.date,true)+' · '+number(peak[metric])+' '+labels[metric].toLowerCase()+'.'));}
 root.append(el('p','li-note','Source: LinkedIn aggregate export. '+(range==='all'&&data.source.partialDate?'The final date ('+date(data.source.partialDate)+') is partial and may still change.':'Recent ranges use complete days.')));
}
async function init(){
 const roots=[...document.querySelectorAll('[data-linkedin-chart]')];if(!roots.length)return;
 try{
  const [data,profile]=await Promise.all([fetch(dataURL).then(r=>{if(!r.ok)throw Error();return r.json();}),fetch(profileURL).then(r=>{if(!r.ok)throw Error();return r.json();})]);
  document.querySelectorAll('[data-li-total]').forEach(e=>{const value=data.totals[e.dataset.liTotal];e.textContent=value===null?'Not available':number(value);});
  document.querySelectorAll('[data-li-preview]').forEach(e=>e.textContent=e.dataset.liPreview==='profile'?number(profile.snapshots.at(-1).viewers):short(data.totals.impressions));
  document.querySelectorAll('[data-li-updated]').forEach(e=>e.textContent='Export: '+date(data.source.start)+'–'+date(data.source.end,true)+' · Imported '+date(data.source.importedOn,true));
  for(const root of roots){
   const fixed=root.dataset.linkedinChart;
   if(fixed!=='interactive'){const draw=()=>render(root,data,profile,fixed,'all','cumulative');const details=root.closest('details');if(details){details.addEventListener('toggle',()=>{if(details.open&&!root.children.length)draw();});if(details.open)draw();}else draw();continue;}
   const controls=el('div','li-controls'),body=el('div');root.append(controls,body);
   function select(label,options){const holder=el('label','',label),s=el('select');for(const [value,text]of options){const opt=el('option','',text);opt.value=value;s.append(opt);}holder.append(s);controls.append(holder);return s;}
   const metric=select('Metric',Object.entries(labels)),range=select('Period',[['all','Full export'],['28','Last 28 complete days'],['7','Last 7 complete days']]),mode=select('View',[['cumulative','Cumulative'],['daily','Daily']]);
   function draw(){const snapshot=metric.value==='profile';range.disabled=mode.disabled=snapshot;range.parentElement.hidden=mode.parentElement.hidden=snapshot;render(body,data,profile,metric.value,range.value,mode.value);}
   for(const s of [metric,range,mode])s.addEventListener('change',draw);draw();
  }
 }catch{document.querySelectorAll('[data-li-total]').forEach(e=>e.textContent='—');document.querySelectorAll('[data-li-updated]').forEach(e=>e.textContent='Stats unavailable');for(const root of roots)root.replaceChildren(el('p','li-error','Stats unavailable. Please try again later.'));}
}
init();
