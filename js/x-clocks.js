import {ZONES,clockPair,localInstants} from './x-time.js';
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const phase=hour=>hour<6||hour>=22?'night owl':hour<12?'first coffee':hour<18?'in the thick of it':'after hours';
export function mountXClocks(root){
 root.classList.add('x-clocks');
 const heading=el('h2','one crow. two clocks.'),mode=el('p','live now','x-clock-mode'),cards=el('div',undefined,'x-clock-pair'),parts={};
 for(const [id,name]of [['bx','brussels'],['sf','san francisco']]){
  const card=el('div',undefined,`x-clock x-${id}`),label=el('h3'),badge=el('span',id,'x-city-code'),time=el('time',''),date=el('p','','x-clock-date'),mood=el('p','','x-clock-mood');
  label.append(badge,document.createTextNode(` ${name}`));card.append(label,time,date,mood);cards.append(card);parts[id]={card,time,date,mood};
 }
 const bridge=el('p','','x-clock-bridge'),planner=el('details',undefined,'x-clock-planner'),summary=el('summary','plan across the pond ↔'),form=el('form',undefined,'x-filters');
 const city=el('select');city.setAttribute('aria-label','plan in');city.append(new Option('bx · brussels','bx'),new Option('sf · san francisco','sf'));
 const date=el('input');date.type='date';date.required=true;date.setAttribute('aria-label','planning date');
 const time=el('input');time.type='time';time.required=true;time.setAttribute('aria-label','planning time');
 const repeated=el('select');repeated.setAttribute('aria-label','repeated hour');repeated.append(new Option('first occurrence','0'),new Option('second occurrence','1'));
 const repeatLabel=el('label','clock change');repeatLabel.append(repeated);repeatLabel.hidden=true;
 for(const [title,input]of [['think in',city],['date',date],['time',time]]){const label=el('label',title);label.append(input);form.append(label);}
 const reset=el('button','back to now');reset.type='button';form.append(repeatLabel,reset);
 const message=el('p','','x-clock-message');message.setAttribute('role','status');
 planner.append(summary,form,message,el('p','csv date + hour stay on bx time. eu / sf chooses the audience, not the clock.','sub'));
 root.replaceChildren(heading,mode,cards,bridge,planner);
 let at=Date.now(),live=true,editing=false;
 function fields(){const c=clockPair(at)[city.value];date.value=c.date;time.value=c.time;}
 function paint(){
  const pair=clockPair(at);
  for(const id of ['bx','sf']){const c=pair[id],p=parts[id];p.time.textContent=c.time;p.time.dateTime=new Date(at).toISOString();p.date.textContent=c.date;p.mood.textContent=phase(c.hour);p.card.dataset.daylight=String(c.hour>=7&&c.hour<20);}
  mode.textContent=live?'live now':'your planned moment';
  bridge.textContent=`sf is ${pair.gap}h behind bx · ${pair.sf.date===pair.bx.date?'same date':'previous day in sf'}`;
 }
 function plan(){
  live=false;const matches=localInstants(date.value,time.value,ZONES[city.value]);repeatLabel.hidden=matches.length<2;
  if(!matches.length){mode.textContent='choose a valid moment';message.textContent=date.value&&time.value?'that local time does not exist. check the date or choose another time around the clock change.':'choose a date and time.';cards.hidden=true;bridge.hidden=true;return;}
  cards.hidden=false;bridge.hidden=false;
  at=matches[Math.min(Number(repeated.value),matches.length-1)];
  message.textContent=matches.length>1?'that hour happens twice when the clocks go back. choose which occurrence.':'';
  paint();
 }
 form.onsubmit=e=>e.preventDefault();
 for(const input of [date,time])input.addEventListener('change',()=>{repeated.value='0';plan();});
 repeated.addEventListener('change',plan);
 city.addEventListener('change',()=>{
  fields();const matches=localInstants(date.value,time.value,ZONES[city.value]);
  repeated.value=String(Math.max(0,matches.indexOf(Math.floor(at/60000)*60000)));repeatLabel.hidden=matches.length<2;
  message.textContent=matches.length>1?'that hour happens twice when the clocks go back. choose which occurrence.':'';
  cards.hidden=false;bridge.hidden=false;paint();
 });
 form.addEventListener('focusin',e=>{editing=e.target===date||e.target===time;});form.addEventListener('focusout',e=>{editing=e.relatedTarget===date||e.relatedTarget===time;});
 reset.onclick=()=>{live=true;at=Date.now();repeated.value='0';repeatLabel.hidden=true;message.textContent='';cards.hidden=false;bridge.hidden=false;fields();paint();};
 fields();paint();
 // One light, minute-level clock update. No requests, storage or animation loop.
 const timer=setInterval(()=>{if(!root.isConnected){clearInterval(timer);return;}if(live&&!editing&&!document.hidden){at=Date.now();fields();paint();}},30000);
}
