import {INSPIRATIONS,dailyBrief} from './inspiration-data.js?v=20261120refs';
const $=id=>document.getElementById(id),grid=$('inspiration-grid');let variation=0;
const selected=new Set(['michael','fallen']);
try{const saved=JSON.parse(localStorage.getItem('corvus.tattoo.references.v2'));if(Array.isArray(saved)&&saved.some(id=>INSPIRATIONS.some(a=>a.id===id))){selected.clear();for(const id of saved)if(INSPIRATIONS.some(a=>a.id===id))selected.add(id);}}catch{}
for(const art of INSPIRATIONS){
 const card=document.createElement('article');card.className='inspiration-card';card.id=art.id;card.dataset.id=art.id;card.dataset.group=art.group;
 const img=new Image();img.src=art.image;img.alt=art.alt;img.loading='lazy';img.decoding='async';const tag=document.createElement('p');tag.className='art-tag';tag.textContent=art.tag;const title=document.createElement('h3');title.textContent=art.name;const line=document.createElement('p');line.textContent=art.line;const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='the meaning & the source';const lore=document.createElement('p');lore.textContent=art.lore;const source=document.createElement('a');source.href=art.source;source.textContent=art.credit;if(art.source.startsWith('https:')){source.target='_blank';source.rel='noopener noreferrer';}details.append(summary,lore,source);if(art.license){const license=document.createElement('a');license.href=art.license;license.textContent=' · license';license.target='_blank';license.rel='noopener noreferrer';details.append(license);}const use=document.createElement('button');use.type='button';use.className='include-art';use.textContent='Bring into my brief';use.onclick=()=>{selected.add(art.id);syncChecks();render();$('daily-brief').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});};card.append(img,tag,title,line,details,use);
 if(art.quote){
  line.className='art-quote';
  line.lang='fr';
  line.textContent=`« ${art.quote} »`;
 }
 (art.ai?$('ai-concept-grid'):grid).append(card);
 const label=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.value=art.id;check.checked=selected.has(art.id);check.onchange=()=>{if(check.checked)selected.add(art.id);else selected.delete(art.id);render();};label.append(check,document.createTextNode(art.name));$('brief-references').append(label);
}
function syncChecks(){document.querySelectorAll('#brief-references input').forEach(i=>i.checked=selected.has(i.value));}
function render(){const brief=dailyBrief({ids:[...selected],placement:$('placement').value,variation});$('brief-date').textContent=brief.day;$('brief-date').dateTime=brief.day;$('brief-text').value=brief.text;$('brief-status').textContent=selected.size?'':'No references selected: using Michael as the starting point.';try{localStorage.setItem('corvus.tattoo.references.v2',JSON.stringify([...selected]));}catch{}}
$('placement').onchange=render;$('remix-brief').onclick=()=>{variation++;render();$('brief-status').textContent='A different composition. Same references.';};$('copy-brief').onclick=async()=>{try{await navigator.clipboard.writeText($('brief-text').value);$('brief-status').textContent='Copied. Take it to your artist or image tool.';}catch{$('brief-text').focus();$('brief-text').select();$('brief-status').textContent='Select the prompt and copy it manually.';}};
document.querySelectorAll('[data-filter]').forEach(button=>button.onclick=()=>{document.querySelectorAll('[data-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));grid.querySelectorAll('.inspiration-card').forEach(card=>card.hidden=button.dataset.filter!=='all'&&card.dataset.group!==button.dataset.filter);});
function showLinkedArt(){const art=INSPIRATIONS.find(a=>'#'+a.id===location.hash);if(art)document.querySelector('[data-filter="all"]').click();}addEventListener('hashchange',showLinkedArt);showLinkedArt();render();
