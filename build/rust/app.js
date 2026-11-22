import {rows,number,measurement,checkpointLabel} from './model.mjs';
const checkpoint=document.querySelector('#checkpoint'),device=document.querySelector('#device'),cache=document.querySelector('#cache'),chart=document.querySelector('#readiness-chart'),tbody=document.querySelector('#timing-rows'),note=document.querySelector('#comparison-note');
const node=(tag,text,className)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(className)el.className=className;return el;};
try{
 const response=await fetch('/build/rust/data.json');if(!response.ok)throw Error('Snapshot unavailable');
 const data=await response.json(),url=new URL(location.href);
 checkpoint.replaceChildren(...[...data.measurements].reverse().map(m=>{const option=node('option',checkpointLabel(m));option.value=m.head;return option;}));
 if(data.measurements.some(m=>m.head===url.searchParams.get('checkpoint')))checkpoint.value=url.searchParams.get('checkpoint');
 if(['mobile','desktop'].includes(url.searchParams.get('device')))device.value=url.searchParams.get('device');
 if(['cold-context','warm'].includes(url.searchParams.get('cache')))cache.value=url.searchParams.get('cache');
 function render(){
  const selected=measurement(data,checkpoint.value),values=rows(data,device.value,cache.value,selected.head),max=Math.max(1,...values.flatMap(r=>[r.legacy.metrics.ready.p50,r.rust.metrics.ready.p50]));
  const bars=document.createDocumentFragment(),table=document.createDocumentFragment();
  for(const row of values){
   const group=node('div',undefined,'chart-row');group.append(node('h3',row.label));
   for(const [engine,label] of [['legacy','JS'],['rust','Rust']]){
    const value=row[engine].metrics.ready.p50,line=node('div',undefined,'bar-row'),track=node('div',undefined,'track'),bar=node('span',undefined,'bar '+engine);
    track.setAttribute('aria-hidden','true');bar.style.setProperty('--value',Math.max(0,value/max*100)+'%');track.append(bar);
    line.append(node('span',label),track,node('output',number(value)+' ms'));group.append(line);
   }
   bars.append(group);const tr=node('tr'),th=node('th',row.label);th.scope='row';
   tr.append(th,node('td',number(row.legacy.metrics.ready.p50)+' ms'),node('td',number(row.rust.metrics.ready.p50)+' ms'),node('td',number(row.legacy.metrics.lcp.p50)+' / '+number(row.rust.metrics.lcp.p50)+' ms'));table.append(tr);
  }
  chart.replaceChildren(bars);tbody.replaceChildren(table);
  note.textContent=checkpointLabel(selected)+' · '+(device.value==='mobile'?'Mobile · throttled':'Desktop')+' · '+(cache.value==='warm'?'warm browser reload':'cold browser context')+' · median of '+selected.repeats+' runs per engine. Exploratory, not a release benchmark.';
  for(const [id,key] of [['benchmark-report','report'],['benchmark-raw','raw'],['benchmark-gate','gate']])document.getElementById(id).href=selected.evidence[key];
  const url=new URL(location.href);
  url.searchParams.set('checkpoint',selected.head);url.searchParams.set('device',device.value);url.searchParams.set('cache',cache.value);history.replaceState(null,'',url);
 }
 render();for(const control of [checkpoint,device,cache]){control.disabled=false;control.addEventListener('change',render);}
}catch{
 for(const control of [checkpoint,device,cache])control.disabled=true;note.textContent='Interactive chart unavailable. The verified mobile table remains below; all other conditions are in the downloadable dataset.';
}
