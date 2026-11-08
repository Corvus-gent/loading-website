import { LIVE, STREAM_ID } from '../live.config.js';

// Shared with the existing Plethora banner: normal document flow, never an overlay.
if(!document.querySelector('[data-live-banner]')){
  const sheet=document.createElement('link');sheet.rel='stylesheet';sheet.href='/css/live-banner.css?v=20261108live1';document.head.append(sheet);
  const banner=document.createElement('aside');banner.className='plethora-banner site-live-banner';banner.dataset.liveBanner='';banner.hidden=true;banner.setAttribute('aria-label','live stream');
  banner.innerHTML='<div><span class="site-live-text"><span class="site-live-dot" aria-hidden="true">🔴</span> live now — building corvus on twitch &amp; instagram</span><nav aria-label="watch live"><a href="/go/twitch" target="_blank" rel="noopener noreferrer">twitch ↗</a><a href="/go/instagram" target="_blank" rel="noopener noreferrer">instagram ↗</a><a href="/go/twitter" target="_blank" rel="noopener noreferrer">x ↗</a></nav></div><button type="button" aria-label="Dismiss live banner">×</button>';
  document.body.prepend(banner);
  const promo=document.querySelector('[data-plethora-banner]');
  let state={live:LIVE===true,source:'manual',session:'manual-'+STREAM_ID},dismissed=new Set(),pending;
  const day=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles'}).format(new Date());
  const key=()=>`corvus.live.dismissed:${day()}:${state.session}`;
  function stored(k){try{return localStorage.getItem(k)==='1';}catch{return false;}}
  function size(){document.documentElement.style.setProperty('--site-live-height',banner.hidden?'0px':banner.getBoundingClientRect().height+'px');}
  function render(){
    banner.hidden=!state.live||dismissed.has(key())||stored(key());
    if(promo)promo.hidden=state.live||stored('plethora.home.dismissed');
    document.documentElement.classList.toggle('site-live-visible',!banner.hidden);size();
  }
  banner.querySelector('button').addEventListener('click',()=>{const k=key();dismissed.add(k);try{for(let i=localStorage.length-1;i>=0;i--){const old=localStorage.key(i);if(old?.startsWith('corvus.live.dismissed:')&&old!==k)localStorage.removeItem(old);}localStorage.setItem(k,'1');}catch{}render();});
  new ResizeObserver(size).observe(banner);
  // The full-height game keeps its controls inside the viewport below the banner.
  if(/^\/hack\/play(?:\/|$)/.test(location.pathname))document.documentElement.classList.add('site-live-game');
  async function refresh(){
    if(pending||document.hidden)return;
    pending=(async()=>{try{const r=await fetch('/api/live',{signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error();const d=await r.json();if(typeof d.live!=='boolean'||typeof d.session!=='string')throw Error();state=d;}catch{state={live:LIVE===true,source:'fallback',session:'manual-'+STREAM_ID};}render();})().finally(()=>pending=null);
    return pending;
  }
  render();refresh();setInterval(refresh,60000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
  window.addEventListener('storage',render);
}
