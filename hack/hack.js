// Set one canonical TikTok/X/YouTube URL, HTTPS .mp4, or same-site /video.mp4.
export const HACK_VIDEO_URL = '';
// Starter timeline copy and timestamps. Replace with the actual build moments.
export const HACK_TIMELINE = [
 {time:'00:00',title:'Pick the fight.',text:'A URL. A niche. A very short deadline.'},
 {time:'00:45',title:'Find the pattern.',text:'Hooks, formats, and the reason you stopped scrolling.'},
 {time:'02:00',title:'Turn up the volume.',text:'From competitor signals to a video concept.'},
 {time:'03:00',title:'Ship it.',text:'Less talking. More showing.'},
];
export function videoSource(value,base='https://corvus.gent'){
 if(!value)return null;let url;try{url=new URL(value,base);}catch{return null;}
 if(url.protocol!=='https:'||url.username||url.password)return null;
 const host=url.hostname.replace(/^www\./,''),path=url.pathname;
 if(/\.mp4$/i.test(path))return {provider:'video',name:'video',url:url.href};
 if(['youtube.com','m.youtube.com','youtube-nocookie.com','youtu.be'].includes(host)){
  const id=host==='youtu.be'?path.split('/')[1]:path.match(/^\/(?:shorts|embed)\/([\w-]+)/)?.[1]||url.searchParams.get('v');
  if(/^[\w-]{11}$/.test(id||''))return {provider:'iframe',name:'YouTube',url:`https://www.youtube-nocookie.com/embed/${id}?playsinline=1&autoplay=1`,original:url.href};
 }
 if(['tiktok.com','m.tiktok.com'].includes(host)){
  const id=path.match(/\/(?:video|v1)\/(\d+)/)?.[1];
  if(id)return {provider:'iframe',name:'TikTok',url:`https://www.tiktok.com/player/v1/${id}?autoplay=1`,original:url.href};
 }
 if(['x.com','twitter.com','mobile.twitter.com'].includes(host)){
  const id=path.match(/\/status\/(\d+)/)?.[1];
  if(id)return {provider:'x',name:'X',id,url:`https://twitter.com/i/status/${id}`,original:url.href};
 }
 return null;
}
const node=(tag,text)=>{const el=document.createElement(tag);if(text)el.textContent=text;return el;};
let emptyVideo;
export function mountVideo(value=HACK_VIDEO_URL){
 const root=document.getElementById('hack-video'),note=document.getElementById('video-note'),original=document.getElementById('video-original');if(!root)return;emptyVideo||=[...root.childNodes].map(n=>n.cloneNode(true));root.classList.remove('is-x');
 if(!value){root.replaceChildren(...emptyVideo.map(n=>n.cloneNode(true)));note.textContent='The build film is on its way.';original.hidden=true;return;}
 const source=videoSource(value);if(!source){note.textContent='The film link is not ready yet. Check back soon.';return;}
 original.href=source.original||source.url;original.hidden=false;
 const button=node('button');button.type='button';button.className='video-placeholder video-play';button.setAttribute('aria-label','Play the Hookjack build film via '+source.name);
 const mark=node('span','▷');mark.className='signal-cross';mark.setAttribute('aria-hidden','true');const label=node('strong','watch the build');button.append(mark,label);root.replaceChildren(button);
 note.textContent='Play loads '+source.name+' content, which may set cookies. You can also watch the original.';
 button.addEventListener('click',()=>{
  root.replaceChildren();
  if(source.provider==='video'){
   const video=node('video');video.controls=true;video.playsInline=true;video.preload='none';video.src=source.url;video.setAttribute('aria-label','Hookjack build film');video.addEventListener('error',()=>{note.textContent='The film could not load here. Try the original link.';});root.append(video);video.play().catch(()=>{});
  }else if(source.provider==='iframe'){
   const frame=node('iframe');frame.title='Hookjack build film — '+source.name;frame.referrerPolicy='strict-origin-when-cross-origin';frame.allow='autoplay; fullscreen; encrypted-media; picture-in-picture';frame.allowFullscreen=true;frame.src=source.url;root.append(frame);
  }else{
   root.classList.add('is-x');const quote=node('blockquote');quote.className='twitter-tweet';quote.dataset.theme='dark';quote.dataset.dnt='true';quote.dataset.conversation='none';const link=node('a','Watch the build on X ↗');link.href=source.url;link.target='_blank';link.rel='noopener noreferrer';quote.append(link);root.append(quote);
   const script=node('script');script.src='https://platform.twitter.com/widgets.js';script.async=true;script.onerror=()=>{note.textContent='X is blocked or unavailable here. The original link still works.';};script.onload=()=>window.twttr?.widgets?.load(root);document.head.append(script);
  }
 },{once:true});
}
if(typeof document!=='undefined'){
 const list=document.getElementById('build-timeline');if(list)list.replaceChildren(...HACK_TIMELINE.map(item=>{const li=node('li');li.append(node('time',item.time),node('h3',item.title),node('p',item.text));return li;}));
 const dial=document.getElementById('unhinged'),out=document.getElementById('dial-value');if(dial&&out)dial.addEventListener('input',()=>{out.value=dial.value+'%';const label=document.getElementById('hj-lvl');if(label)label.textContent=dial.value<25?'corporate':dial.value<50?'spicy':dial.value<80?'ragebait':'unhinged';});
 mountVideo();
 let lastVideo=HACK_VIDEO_URL,lastFeed='',loading=false;
 const safeLink=value=>{try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password?url.href:null;}catch{return null;}};
 async function loadLive(){
  if(loading)return;loading=true;
  try{
   const response=await fetch('/hack/live.json?t='+Date.now(),{cache:'no-store',signal:AbortSignal.timeout(8000)});if(!response.ok)throw Error('live');const data=await response.json();
   const video=typeof data.video==='string'?data.video:HACK_VIDEO_URL;if(video!==lastVideo){mountVideo(video);lastVideo=video;}
   for(const key of ['x','github']){const link=document.getElementById(key==='x'?'hj-x':'hj-gh'),url=safeLink(data.links?.[key]);if(url){link.href=url;link.hidden=false;}else if(key==='github')link.hidden=true;}
   const updates=Array.isArray(data.updates)?data.updates:[],signature=JSON.stringify(updates);
   if(signature!==lastFeed){document.getElementById('hj-feed').replaceChildren(...updates.slice().reverse().map(update=>{const li=node('li');li.append(node('b',String(update.t||'')),node('span',String(update.text||'')));return li;}));lastFeed=signature;}
   document.getElementById('live-status').textContent='Updates every 30 seconds.';
  }catch{document.getElementById('live-status').textContent='The live feed is taking a breath. Retrying shortly.';}
  finally{loading=false;}
 }
 loadLive();const timer=setInterval(loadLive,30000);window.addEventListener('pagehide',()=>clearInterval(timer),{once:true});
}
