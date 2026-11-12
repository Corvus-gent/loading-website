import {hackLiveMode} from './live-mode-config.js?v=20261108hacklive1';
import {SOCIALS,liveURL} from '../live/socials.js?v=20261108hacklive1';
const home=/^\/hack\/?$/.test(location.pathname),third=/^\/hack\/3\/?$/.test(location.pathname);
const bar=document.querySelector('#hack-stream-bar'),front=document.querySelector('#hack-live-front');
let override='auto',offset=0,active=false,streamLive=SOCIALS.some(s=>s.primary&&s.isLive),pending=false;
const topLabel=home?document.querySelector('main>nav>a'):null,originalTopLabel=topLabel?.textContent;
const originalTitle=document.title,originalMeta=[...document.querySelectorAll('meta[property="og:title"],meta[property="og:description"],meta[property="og:image"],meta[name="description"]')].map(el=>[el,el.content]);
function renderStream(){if(!bar)return;bar.classList.toggle('is-live',streamLive);bar.querySelector('[data-hack-stream-text]').textContent=streamLive?'LIVE from a robotics hackathon in SF → watch now':'next stream soon · robotics hackathon in SF → watch now';const badge=document.querySelector('.hack-run-badge');if(badge)badge.textContent=streamLive?'● LIVE NOW':'NEXT STREAM SOON';}
async function interviews(){if(document.hidden||!active)return;try{const r=await fetch('/api/compound-v2?interviews=1',{cache:'no-cache',signal:AbortSignal.timeout(6000)});if(!r.ok)return;const d=await r.json();const rows=(Array.isArray(d.interviews)?d.interviews:[]).map((v,i)=>({...v,index:i})).filter(v=>{try{const u=new URL(v.url);return u.protocol==='https:'&&!u.username&&!u.password&&v.title&&v.builder&&v.project;}catch{return false;}}).sort((a,b)=>(Date.parse(b.published_at||b.date)||0)-(Date.parse(a.published_at||a.date)||0)||b.index-a.index).slice(0,3);
 const cards=rows.map(v=>{const a=document.createElement('a');a.className='hack-robot-card';a.href=v.url;a.target='_blank';a.rel='noopener noreferrer';a.dataset.hackTrack='hack_robots_click';a.dataset.placement='interview';const h=document.createElement('h3');h.textContent=v.title;const p=document.createElement('p');p.textContent=v.builder+' · '+v.project;a.append(h,p);return a;});document.querySelector('#hack-robot-grid').replaceChildren(...cards);document.querySelector('#hack-robot-empty').hidden=cards.length>0;}catch{/* Keep the last good teaser. */}}
function apply(){
 const enabled=home&&hackLiveMode(override,Date.now()+offset).enabled;
 if(home&&active!==enabled){active=enabled;if(topLabel)topLabel.textContent=active?'CORVUS / LIVE':originalTopLabel;document.body.classList.toggle('hack-live-mode',active);document.querySelectorAll('[data-hack-live-only]').forEach(el=>el.hidden=!active);
  if(active){interviews();document.title='Live at a robotics hackathon in SF · Corvus';for(const [el]of originalMeta)el.content=el.matches('[property="og:image"]')?'https://corvus.gent/live/og.png':el.matches('[property="og:title"]')?'Live at a robotics hackathon in SF · Corvus':'One-man army. Many editors. Livestream, robot interviews, 100+ videos in 10+ languages.';}else{document.title=originalTitle;for(const[el,value]of originalMeta)el.content=value;}
 }
 if(bar)bar.hidden=home?!enabled:!third;renderStream();
}
function track(event,placement,platform=''){window.dispatchEvent(new CustomEvent('hack-action',{detail:{event,props:{hack_id:3,placement,platform}}}));}
document.addEventListener('click',e=>{const a=e.target.closest?.('[data-hack-track]');if(a)track(a.dataset.hackTrack,a.dataset.placement||'hero',a.dataset.platform||'');});
async function refresh(){if(pending||document.hidden)return;pending=true;try{const r=await fetch('/api/live?landing=1',{cache:'no-cache',signal:AbortSignal.timeout(6000)});if(!r.ok)throw Error();const d=await r.json();if(typeof d.live==='boolean')streamLive=d.live;if(d.hackMode&&['auto','on','off'].includes(d.hackMode.mode)){override=d.hackMode.mode;offset=Number.isFinite(d.hackMode.serverTime)?d.hackMode.serverTime+(Number(r.headers.get('age'))||0)*1000-Date.now():0;}apply();}catch{apply();}finally{pending=false;}}
if(home){
 const row=document.querySelector('#hack-live-platforms');for(const platform of ['twitch','tiktok','instagram','x','linkedin']){const s=SOCIALS.find(s=>s.primary&&s.platform===platform&&s.url);if(!s)continue;const a=document.createElement('a');a.href=liveURL(s,'hack_page');a.textContent=s.icon+' '+s.label;a.target='_blank';a.rel='noopener noreferrer';a.dataset.hackTrack='hack_live_click';a.dataset.placement='platform';a.dataset.platform=platform;row.append(a);}
 setInterval(interviews,30000);
}
apply();refresh();setInterval(apply,1000);setInterval(refresh,60000);document.addEventListener('visibilitychange',()=>{if(!document.hidden){apply();refresh();}});
