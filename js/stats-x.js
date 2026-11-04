import {initI18n,getLang} from './i18n.js';
initI18n();
const out=document.querySelector('#section-output');
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const number=n=>new Intl.NumberFormat('en',{maximumFractionDigits:2}).format(Number(n)||0);
for(const a of document.querySelectorAll('[data-stat]')){a.href='https://stats.corvus.gent/'+(a.dataset.stat==='overview'?'':a.dataset.stat)+'?lang='+getLang();if(a.dataset.stat==='x')a.setAttribute('aria-current','page');}
document.querySelector('.stat-copy')?.addEventListener('click',async e=>{try{await navigator.clipboard.writeText('https://stats.corvus.gent/x');e.target.textContent='copied';}catch{e.target.textContent='https://stats.corvus.gent/x';}});
function section(title){const s=el('section',undefined,'st-sec');s.append(el('h2',title));return s;}
function table(headers,rows){const wrap=el('div',undefined,'x-scroll'),t=el('table'),head=el('thead'),tr=el('tr');for(const h of headers){const th=el('th',h);th.scope='col';tr.append(th);}head.append(tr);t.append(head);const body=el('tbody');for(const row of rows){const tr=el('tr');for(const value of row)tr.append(el('td',String(value)));body.append(tr);}t.append(body);wrap.append(t);return wrap;}
function metrics(title,data){const s=section(title),dl=el('dl',undefined,'x-metrics');for(const [label,value]of [['replies',data.replies],['posts',data.posts],['links used',data.links],['clicks to corvus',data.clicks],['clicks to pidgy',data.clicksPidgy],['clicks / links',data.ctr===null?'—':`${number(data.ctr*100)}%`]]){const block=el('div');block.append(el('dt',label),el('dd',typeof value==='number'?number(value):value));dl.append(block);}s.append(dl);return s;}
function render(data){
 out.replaceChildren();
 if(!data.ready){out.append(el('p','the log is empty for now'));return;}
 if(!data.all){out.append(el('p',data.state==='unavailable'?'the log is resting. try again soon.':'the crow is syncing the log. check back in a moment.'));const b=el('button','refresh','stat-copy');b.type='button';b.onclick=load;out.append(b);return;}
 const top=el('div',undefined,'bird-counts');top.append(metrics('today · brussels',data.today),metrics('all time',data.all));out.append(top);
 const voices=section('per voice');if(data.voices.length)voices.append(table(['voice','replies','clicks'],data.voices.map(v=>[v.name,number(v.replies),number(v.clicks+v.clicksPidgy)])));else voices.append(el('p','no voices logged yet.','sub'));
 if(data.bestVoice)voices.append(el('p',`best voice this week: ${data.bestVoice.name} · ${number(data.bestVoice.clicks+data.bestVoice.clicksPidgy)} clicks`,'x-highlight'));else voices.append(el('p','best voice this week: waiting for a click.','sub'));
 voices.append(el('p',`week starts ${data.weekStart} · shared slots are estimates`,'sub'));out.append(voices);
 const regions=section('eu / sf');regions.append(table(['region','replies','posts','links','clicks'],data.regions.map(r=>[r.name,number(r.replies),number(r.posts),number(r.links),number(r.clicks+r.clicksPidgy)])));out.append(regions);
 const heat=section('per hour · brussels'),strip=el('pre',undefined,'x-heat'),max=Math.max(1,...data.hours.map(h=>h.clicks+h.clicksPidgy)),levels='·▁▂▃▄▅▆▇█';strip.setAttribute('aria-label','clicks by logged hour, 00 to 23, Europe/Brussels');
 for(const h of data.hours){const n=h.clicks+h.clicksPidgy,span=el('span',levels[n?Math.max(1,Math.ceil(n/max*8)):0]);span.title=`${String(h.hour).padStart(2,'0')}:00 · ${number(n)} clicks · ${h.replies} replies`;strip.append(span);}
 heat.append(strip,el('pre','00    06    12    18   23','x-hours'));const details=el('details');details.append(el('summary','hourly numbers'),table(['hour','replies','posts','clicks'],data.hours.map(h=>[`${String(h.hour).padStart(2,'0')}:00`,number(h.replies),number(h.posts),number(h.clicks+h.clicksPidgy)])));heat.append(details,el('p','attributed to the logged hour, not the time a visitor clicked.','sub'));out.append(heat);
 const campaigns=section('top campaigns');if(data.campaigns.length)campaigns.append(table(['campaign','corvus','pidgy'],data.campaigns.map(c=>[c.campaign,number(c.clicks),number(c.clicksPidgy)])));else campaigns.append(el('p','no campaign clicks yet.','sub'));out.append(campaigns);
 const posts=section('from gabe');for(const post of data.posts){const article=el('article',undefined,'x-post');article.append(el('p',post.text));const link=el('a','read the post ↗');link.href=post.url;link.target='_blank';link.rel='noopener noreferrer';article.append(link,el('p',`${post.date} · ${number(post.clicks+post.clicksPidgy)} clicks${post.estimated?' · estimate':''}`,'sub'));posts.append(article);}if(!data.posts.length)posts.append(el('p','no own posts logged yet.','sub'));if(data.postCount>data.posts.length)posts.append(el('p',`latest ${data.posts.length} of ${data.postCount} posts. full log in the private dashboard.`,'sub'));out.append(posts);
 if(data.unmatchedClicks)out.append(el('p',`${number(data.unmatchedClicks)} clicks could not be matched to a dated region-hour slot. totals include them; voice and hour estimates do not.`,'sub'));
 out.append(el('p',`${data.stale?'last saved snapshot · ':''}updated ${new Date(data.updated).toLocaleString('en-GB',{timeZone:'Europe/Brussels'})} brussels · refreshes at most every 15 minutes`,'sub'));
}
async function load(){try{const r=await fetch('/api/x-stats',{credentials:'omit'});if(!r.ok)throw Error('unavailable');render(await r.json());}catch{out.replaceChildren(el('p','the log is resting. try again soon.'));}}
load();
