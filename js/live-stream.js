import {analyticsAllowed} from './analytics-consent.js';
// Vanilla component: <live-stream channel="gabe_maxxing"></live-stream>.
// Twitch owns availability; never infer "live" from a scheduled start time.
let sdk;
function loadTwitch(){
 if(window.Twitch?.Embed)return Promise.resolve(window.Twitch);
 if(sdk)return sdk;
 sdk=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://embed.twitch.tv/embed/v1.js';script.async=true;
 const timer=setTimeout(()=>{script.remove();sdk=null;reject(Error('timeout'));},12000);
 script.onload=()=>{clearTimeout(timer);if(window.Twitch?.Embed)resolve(window.Twitch);else{sdk=null;reject(Error('unavailable'));}};
 script.onerror=()=>{clearTimeout(timer);script.remove();sdk=null;reject(Error('blocked'));};document.head.append(script);
 });return sdk;
}
export function twitchParents(host=location.hostname){return[...new Set(['corvus.gent','www.corvus.gent','localhost',...(/(^|\.)vercel\.app$/.test(host)||host==='127.0.0.1'?[host]:[])])];}
export class LiveStream extends HTMLElement{
 connectedCallback(){
  if(this.initialized)return;this.initialized=true;this.lastWidth=null;this.badgeOnly=this.hasAttribute('badge-only');this.channel=(this.getAttribute('channel')||'gabe_maxxing').toLowerCase();if(!/^[a-z0-9_]{1,25}$/.test(this.channel))return;
  this.innerHTML=`<a class="stream-live-badge" hidden><span aria-hidden="true">🔴</span> LIVE RN <span class="stream-arrow" aria-hidden="true">↓</span></a><div class="stream-entry"><button type="button" class="stream-enable">check live stream →</button><small>Twitch loads when you click and may set cookies.</small></div><small class="stream-disclosure" hidden>live status via Twitch, which may set cookies. <a href="/privacy/">privacy</a> · <button type="button" class="stream-disable">disable</button></small><div class="stream-window" aria-hidden="true" inert><div class="stream-frame"></div></div><p class="stream-status" role="status"></p><div class="stream-links" hidden><a class="stream-external" target="_blank" rel="noopener noreferrer">watch on twitch ↗</a><button type="button" class="stream-stop">close stream</button></div>`;
  this.badge=this.querySelector('.stream-live-badge');this.window=this.querySelector('.stream-window');this.mount=this.querySelector('.stream-frame');this.entry=this.querySelector('.stream-entry');this.status=this.querySelector('.stream-status');this.links=this.querySelector('.stream-links');
  this.mount.id='twitch-'+this.channel+'-'+Math.random().toString(36).slice(2,8);this.window.id=this.mount.id+'-player';this.badge.href='#'+this.window.id;this.badge.setAttribute('aria-label','Gabe is live on Twitch. Jump to the player.');this.querySelector('.stream-external').href='https://www.twitch.tv/'+this.channel;
  if(this.badgeOnly){this.badge.href='https://corvus.gent/hack';this.badge.setAttribute('aria-label','Gabe is live. Watch on corvus.gent/hack.');this.badge.querySelector('.stream-arrow').textContent='→';}else this.badge.onclick=e=>{e.preventDefault();this.window.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});this.mount.querySelector('iframe')?.focus();};
  this.querySelector('.stream-enable').onclick=()=>this.start();this.querySelector('.stream-stop').onclick=()=>this.stop();this.querySelector('.stream-disable').onclick=()=>this.stop();
  this.resize=new ResizeObserver(()=>{cancelAnimationFrame(this.resizeFrame);this.resizeFrame=requestAnimationFrame(()=>this.fit());});this.resize.observe(this);this.fit();
  this.onVisibility=()=>{if(document.hidden){try{this.embed?.getPlayer()?.pause();}catch{}}};document.addEventListener('visibilitychange',this.onVisibility);
  this.onPrivacy=()=>{if(!analyticsAllowed())this.stop();};window.addEventListener('analytics-consent-change',this.onPrivacy);
  let disabled=false;try{disabled=sessionStorage.getItem('twitch-disabled')==='1';}catch{}
  if(this.hasAttribute('auto')&&analyticsAllowed()&&!disabled)this.start();
 }
 fit(){const width=Math.max(1,this.clientWidth);if(width===this.lastWidth)return;this.lastWidth=width;const nativeWidth=Math.max(400,width),nativeHeight=Math.max(300,nativeWidth*9/16),scale=Math.min(1,width/400);this.mount.style.width=nativeWidth+'px';this.mount.style.height=nativeHeight+'px';this.mount.style.transform=`scale(${scale})`;this.style.setProperty('--stream-height',(nativeHeight*scale)+'px');}
 async start(){
  if(this.loading||this.embed)return;this.loading=true;this.generation=(this.generation||0)+1;const generation=this.generation;try{sessionStorage.removeItem('twitch-disabled');}catch{}this.entry.hidden=true;this.querySelector('.stream-disclosure').hidden=false;document.documentElement.dataset.twitchLoaded='true';window.dispatchEvent(new Event('twitch-status-change'));this.status.textContent='checking the live signal…';this.dataset.state='loading';
  try{const Twitch=await loadTwitch();if(!this.isConnected||generation!==this.generation)return;this.fit();const embed=new Twitch.Embed(this.mount.id,{channel:this.channel,parent:twitchParents(),width:'100%',height:'100%',layout:'video',theme:'dark',autoplay:false,muted:true});this.embed=embed;
   const online=()=>this.setState('online'),offline=()=>this.setState('offline');
   // The current Embed SDK exposes Player constants but forwards player events
   // on the Embed emitter. Older player APIs may also expose their own emitter.
   embed.addEventListener(Twitch.Embed.VIDEO_PLAY,online);
   embed.addEventListener(Twitch.Player?.ONLINE||Twitch.Embed.ONLINE||'online',online);
   embed.addEventListener(Twitch.Player?.OFFLINE||Twitch.Embed.OFFLINE||'offline',offline);
   embed.addEventListener(Twitch.Embed.VIDEO_READY,()=>{const player=embed.getPlayer();if(player?.addEventListener){player.addEventListener(Twitch.Player?.ONLINE||'online',online);player.addEventListener(Twitch.Player?.OFFLINE||'offline',offline);}const frame=this.mount.querySelector('iframe');if(frame){frame.title='Gabe maxxing live on Twitch';frame.allow=(frame.allow||'autoplay; fullscreen; picture-in-picture')+'; keyboard-map';}});
   embed.addEventListener(Twitch.Embed.ERROR||'error',()=>this.setState('unavailable'));
   this.signalTimer=setTimeout(()=>{if(this.dataset.state==='loading')this.setState('unavailable');},20000);
   const frame=this.mount.querySelector('iframe');if(frame){frame.title='Gabe maxxing live on Twitch';frame.allow=(frame.allow||'autoplay; fullscreen; picture-in-picture')+'; keyboard-map';}
  }catch{this.setState('unavailable');}finally{this.loading=false;}
 }
 setState(state){
  clearTimeout(this.signalTimer);this.dataset.state=state;const online=state==='online';this.badge.hidden=!online;this.window.setAttribute('aria-hidden',String(!online||this.badgeOnly));this.window.inert=!online||this.badgeOnly;
  this.links.hidden=state==='offline';this.status.textContent=online?'live from san francisco · tap play · sound starts muted':state==='offline'?'':"Twitch couldn’t connect here. open the stream directly →";
  if(!online){try{this.embed?.getPlayer()?.pause();}catch{}}this.fit();
 }
 stop(){this.generation=(this.generation||0)+1;try{sessionStorage.setItem('twitch-disabled','1');}catch{}clearTimeout(this.signalTimer);this.embed?.destroy?.();this.embed=null;this.mount.replaceChildren();this.dataset.state='closed';this.badge.hidden=true;this.window.inert=true;this.window.setAttribute('aria-hidden','true');this.links.hidden=true;this.status.textContent='';this.entry.hidden=false;this.querySelector('.stream-disclosure').hidden=true;}
 disconnectedCallback(){this.stop();this.resize?.disconnect();cancelAnimationFrame(this.resizeFrame);document.removeEventListener('visibilitychange',this.onVisibility);window.removeEventListener('analytics-consent-change',this.onPrivacy);this.initialized=false;}
}
if(!customElements.get('live-stream'))customElements.define('live-stream',LiveStream);
