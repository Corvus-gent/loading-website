import {tags} from '/compound/client.js?v=20261107social1';
export const $=id=>document.getElementById(id);
export function node(tag,text,cls){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;}
export async function api(body,query=''){
 const response=await fetch('/api/compound-v2'+query,{method:body?'POST':'GET',credentials:'same-origin',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify({...tags(),...body}):undefined,cache:'no-store',signal:AbortSignal.timeout(12000)});
 const data=await response.json();if(!response.ok)throw Error(data.error||'Connection lost. Try again.');return data;
}
export function event(type,slug,extra={}){return fetch('/api/compound-v2',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({...tags(),action:'event',type,slug,...extra}),keepalive:true}).catch(()=>{});}
export async function copy(text){try{await navigator.clipboard.writeText(text);toast('Copied ✓');}catch{const field=node('textarea');field.value=text;field.setAttribute('aria-label','Copy this text');document.body.append(field);field.select();try{if(!document.execCommand('copy'))throw Error();toast('Copied ✓');field.remove();}catch{toast('Select and copy the text below.');field.focus();}}}
export function toast(text){const t=$('toast');t.textContent=text;t.hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.hidden=true,4000);}
export function options(select,items,all){select.replaceChildren();if(all){const o=node('option',all);o.value='';select.append(o);}for(const[k,label]of Object.entries(items)){const o=node('option',Array.isArray(label)?label[0]:label);o.value=k;select.append(o);}}
export const format=n=>Number(n||0).toLocaleString('en-US');
